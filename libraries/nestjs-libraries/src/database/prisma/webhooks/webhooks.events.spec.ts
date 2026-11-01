import { readFileSync } from 'fs';
import { join } from 'path';
import { WebhooksRepository } from '@gitroom/nestjs-libraries/database/prisma/webhooks/webhooks.repository';
import {
  deliverLoadedSchedulePost,
  WebhooksService,
} from '@gitroom/nestjs-libraries/database/prisma/webhooks/webhooks.service';
import { postWebhookHeaders } from '@gitroom/nestjs-libraries/database/prisma/webhooks/webhook.signature';
import {
  eventsOrScheduleDefault,
  SCHEDULE_WEBHOOK_EVENTS,
  WEBHOOK_EVENT,
  webhookEventsWrite,
} from '@gitroom/nestjs-libraries/database/prisma/webhooks/webhook.events';

const root = join(__dirname, '../../../../../..');

function hook(
  id: string,
  events: string[],
  url: string,
  integrations: { integration: { id: string } }[]
) {
  return { id, events, url, integrations, deletedAt: null as Date | null };
}

describe('workspace webhook events', () => {
  const previousSecret = process.env.POST_WEBHOOK_SECRET;
  const previousSsrf = process.env.DISABLE_SSRF_PROTECTION;
  const fetchMock = jest.fn().mockResolvedValue({ ok: true });
  const originalFetch = global.fetch;

  const rows = [
    hook('schedule', ['post.published', 'post.failed'], 'https://hooks.example.com/schedule', []),
    hook('stalker', ['stalker.match'], 'https://hooks.example.com/stalker', []),
    hook('click', ['link.click'], 'https://hooks.example.com/click', []),
    hook('form', ['link.submission'], 'https://hooks.example.com/form', []),
    hook(
      'other-channel',
      ['post.published', 'post.failed'],
      'https://hooks.example.com/other-channel',
      [{ integration: { id: 'other' } }]
    ),
    hook('mine', ['post.published'], 'https://hooks.example.com/mine', [
      { integration: { id: 'int-1' } },
    ]),
  ];

  const repository = {
    getWebhooksForEvent: jest.fn(async (_org: string, event: string) =>
      rows.filter((row) => row.events.includes(event))
    ),
    getWebhooks: jest.fn(),
    getTotal: jest.fn(),
    createWebhook: jest.fn(),
    deleteWebhook: jest.fn(),
  };
  const service = new WebhooksService(repository as never);

  beforeEach(() => {
    process.env.POST_WEBHOOK_SECRET = 'root-secret';
    delete process.env.DISABLE_SSRF_PROTECTION;
    fetchMock.mockClear();
    global.fetch = fetchMock as never;
  });

  afterAll(() => {
    global.fetch = originalFetch;
    if (previousSecret === undefined) {
      delete process.env.POST_WEBHOOK_SECRET;
    } else {
      process.env.POST_WEBHOOK_SECRET = previousSecret;
    }
    if (previousSsrf === undefined) {
      delete process.env.DISABLE_SSRF_PROTECTION;
    } else {
      process.env.DISABLE_SSRF_PROTECTION = previousSsrf;
    }
  });

  function callsTo(url: string) {
    return fetchMock.mock.calls.filter((call) => call[0] === url);
  }

  it('maps a missing selection to Schedule post published and post failed', () => {
    expect(SCHEDULE_WEBHOOK_EVENTS).toEqual(['post.published', 'post.failed']);
    expect(eventsOrScheduleDefault(null)).toEqual(['post.published', 'post.failed']);
    expect(eventsOrScheduleDefault(undefined)).toEqual(['post.published', 'post.failed']);
    expect(eventsOrScheduleDefault([])).toEqual([]);
    expect(webhookEventsWrite(undefined)).toEqual({});
    expect(webhookEventsWrite(null)).toEqual({});
    expect(webhookEventsWrite(['stalker.match', 'post.published', 'stalker.match', 'nope'])).toEqual({
      events: ['post.published', 'stalker.match'],
    });

    const schema = readFileSync(
      join(root, 'libraries/nestjs-libraries/src/database/prisma/schema.prisma'),
      'utf8'
    );
    expect(schema).toContain('events         String[]               @default(["post.published", "post.failed"])');
    const sql = readFileSync(
      join(
        root,
        'libraries/nestjs-libraries/src/database/prisma/migrations/20261101120000_workspace_webhook_events/migration.sql'
      ),
      'utf8'
    );
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "events"');
    expect(sql).toContain("ARRAY['post.published', 'post.failed']");
    expect(sql.toLowerCase()).not.toContain('drop ');
  });

  it('posts the same Schedule body and headers as sendWebhooks', async () => {
    const post = [
      {
        id: 'post-1',
        content: 'Hello',
        state: 'PUBLISHED',
        releaseURL: 'https://x.com/ada/1',
        publishDate: '2026-11-01T00:00:00.000Z',
        integration: {
          id: 'int-1',
          name: 'Ada',
          providerIdentifier: 'x',
          picture: '',
          type: 'social',
        },
      },
    ];
    const payload = JSON.stringify(post);
    await service.deliverSchedule('org-1', 'int-1', WEBHOOK_EVENT.postPublished, payload);

    const urls = fetchMock.mock.calls.map((call) => call[0]).sort();
    expect(urls).toEqual([
      'https://hooks.example.com/mine',
      'https://hooks.example.com/schedule',
    ]);

    for (const id of ['schedule', 'mine']) {
      const init = callsTo(`https://hooks.example.com/${id}`)[0][1];
      expect(init.method).toBe('POST');
      expect(init.body).toBe(payload);
      expect(JSON.parse(init.body)).toEqual(post);
      expect(init.body).not.toContain('"event"');
      expect(init.signal).toBeUndefined();
      expect(init.dispatcher).toBeDefined();
      expect(init.headers).toEqual({
        'Content-Type': 'application/json',
        ...postWebhookHeaders(payload, id),
      });
    }

    expect(callsTo('https://hooks.example.com/stalker')).toHaveLength(0);
    expect(callsTo('https://hooks.example.com/click')).toHaveLength(0);
    expect(callsTo('https://hooks.example.com/form')).toHaveLength(0);
    expect(callsTo('https://hooks.example.com/other-channel')).toHaveLength(0);
  });

  it('sends post failed with the same post JSON only to webhooks that selected it', async () => {
    const post = [{ id: 'post-1', content: 'Hello', state: 'ERROR' }];
    await deliverLoadedSchedulePost(
      service,
      post,
      'org-1',
      'int-1',
      WEBHOOK_EVENT.postFailed
    );
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      'https://hooks.example.com/schedule',
    ]);
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify(post));
    expect(fetchMock.mock.calls[0][1].signal).toBeUndefined();

    fetchMock.mockClear();
    await deliverLoadedSchedulePost(service, [], 'org-1', 'int-1', WEBHOOK_EVENT.postFailed);
    expect(fetchMock).not.toHaveBeenCalled();

    await deliverLoadedSchedulePost(service, [], 'org-1', 'int-1', WEBHOOK_EVENT.postPublished);
    expect(fetchMock.mock.calls.map((call) => call[0]).sort()).toEqual([
      'https://hooks.example.com/mine',
      'https://hooks.example.com/schedule',
    ]);
    expect(fetchMock.mock.calls.every((call) => call[1].body === '[]')).toBe(true);
  });

  it('emits Stalker and Link in Bio only for a webhook that selected them', async () => {
    const mention = { id: 'mention-1', text: 'crea8' };
    await service.emitAll('org-1', WEBHOOK_EVENT.stalkerMatch, [
      { event: 'stalker.match', projectId: 'proj-1', mention },
    ]);
    await service.emit('org-1', WEBHOOK_EVENT.linkClick, {
      event: 'link.click',
      slug: 'ada',
      blockId: 'block-1',
    });
    await service.emit('org-1', WEBHOOK_EVENT.linkSubmission, {
      event: 'link.submission',
      kind: 'contact',
      email: 'ada@example.com',
    });

    expect(callsTo('https://hooks.example.com/schedule')).toHaveLength(0);
    expect(callsTo('https://hooks.example.com/mine')).toHaveLength(0);
    expect(callsTo('https://hooks.example.com/other-channel')).toHaveLength(0);
    expect(callsTo('https://hooks.example.com/stalker')).toHaveLength(1);
    expect(callsTo('https://hooks.example.com/click')).toHaveLength(1);
    expect(callsTo('https://hooks.example.com/form')).toHaveLength(1);

    const stalker = callsTo('https://hooks.example.com/stalker')[0][1];
    expect(JSON.parse(stalker.body)).toEqual({
      event: 'stalker.match',
      projectId: 'proj-1',
      mention,
    });
    expect(stalker.headers['Content-Type']).toBe('application/json');
    expect(stalker.headers['X-Crea8-Signature']).toMatch(/^sha256=/);
    expect(stalker.signal).toBeInstanceOf(AbortSignal);

    expect(JSON.parse(callsTo('https://hooks.example.com/click')[0][1].body).event).toBe('link.click');
    expect(JSON.parse(callsTo('https://hooks.example.com/form')[0][1].body)).toMatchObject({
      event: 'link.submission',
      kind: 'contact',
    });

    fetchMock.mockClear();
    await service.emit('org-1', WEBHOOK_EVENT.postPublished, { event: 'post.published' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('leaves the column unset when events are omitted and stores a selection when sent', async () => {
    const model = {
      upsert: jest.fn().mockResolvedValue({ id: 'hook-1' }),
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    };
    const stored = new WebhooksRepository({ model: { webhooks: model } } as never);
    await stored.createWebhook('org-1', {
      id: 'hook-1',
      name: 'Schedule',
      url: 'https://hooks.example.com/schedule',
      integrations: [{ id: 'int-1' }],
    });
    expect(model.upsert.mock.calls[0][0].create).not.toHaveProperty('events');
    expect(model.upsert.mock.calls[0][0].update).not.toHaveProperty('events');
    expect(model.upsert.mock.calls[0][0].create).toMatchObject({
      organizationId: 'org-1',
      url: 'https://hooks.example.com/schedule',
      name: 'Schedule',
    });

    await stored.createWebhook('org-1', {
      id: 'hook-2',
      name: 'Stalker',
      url: 'https://hooks.example.com/stalker',
      integrations: [],
      events: ['stalker.match'],
    });
    expect(model.upsert.mock.calls[1][0].create.events).toEqual(['stalker.match']);
    expect(model.upsert.mock.calls[1][0].update.events).toEqual(['stalker.match']);

    await stored.getWebhooksForEvent('org-1', 'link.click');
    expect(model.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-1',
          deletedAt: null,
          events: { has: 'link.click' },
        },
      })
    );
  });

  it('keeps v1.1.2 on sendWebhooks and points new runs at v1.1.3', () => {
    const previous = readFileSync(
      join(root, 'apps/orchestrator/src/workflows/post-workflows/post.workflow.v1.1.2.ts'),
      'utf8'
    );
    const next = readFileSync(
      join(root, 'apps/orchestrator/src/workflows/post-workflows/post.workflow.v1.1.3.ts'),
      'utf8'
    );
    const activity = readFileSync(
      join(root, 'apps/orchestrator/src/activities/post.activity.ts'),
      'utf8'
    );
    const starter = readFileSync(
      join(root, 'libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts'),
      'utf8'
    );

    expect(previous).toContain('await sendWebhooks(');
    expect(previous).not.toContain('sendScheduleWebhooks');
    expect(previous).toContain('postWorkflowV112');
    expect(next).toContain("sendScheduleWebhooks(");
    expect(next).toContain("'post.published'");
    expect(next).toContain("'post.failed'");
    expect(next).not.toContain('await sendWebhooks(');
    expect(next).toContain('postWorkflowV113');
    expect(activity).toContain(
      'async sendWebhooks(postId: string, orgId: string, integrationId: string)'
    );
    expect(activity).toContain('const payload = JSON.stringify(post)');
    expect(activity).toContain('postWebhookHeaders(payload, webhook.id)');
    expect(activity).toContain("signalWithStart('postWorkflowV113'");
    expect(activity).not.toContain('postWorkflowV112');
    expect(starter).toContain("workflow.start('postWorkflowV114'");
    expect(starter).not.toContain("workflow.start('postWorkflowV113'");
    expect(starter).not.toContain('postWorkflowV112');
  });
});
