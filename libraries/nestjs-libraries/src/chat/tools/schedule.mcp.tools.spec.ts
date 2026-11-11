import { readFileSync } from 'fs';
import { join } from 'path';
import { HttpException } from '@nestjs/common';

jest.mock('@gitroom/nestjs-libraries/database/prisma/posts/posts.service', () => ({
  PostsService: class PostsService {},
}));
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service',
  () => ({
    IntegrationService: class IntegrationService {},
  })
);
jest.mock('@gitroom/nestjs-libraries/integrations/integration.manager', () => ({
  IntegrationManager: class IntegrationManager {},
}));
jest.mock('@gitroom/nestjs-libraries/database/prisma/sets/sets.service', () => ({
  SetsService: class SetsService {},
}));
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/signatures/signature.service',
  () => ({
    SignatureService: class SignatureService {},
  })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/autopost/autopost.service',
  () => ({
    AutopostService: class AutopostService {},
  })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/subscriptions/entitlement.service',
  () => ({
    EntitlementService: class EntitlementService {},
  })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service',
  () => ({
    OrganizationService: class OrganizationService {},
  })
);

import { PostDateTool } from '@gitroom/nestjs-libraries/chat/tools/post.date.tool';
import { PostContentTool } from '@gitroom/nestjs-libraries/chat/tools/post.content.tool';
import { IntegrationChannelTool } from '@gitroom/nestjs-libraries/chat/tools/integration.channel.tool';
import { SetsTool } from '@gitroom/nestjs-libraries/chat/tools/sets.tool';
import { SignaturesTool } from '@gitroom/nestjs-libraries/chat/tools/signatures.tool';
import { AutopostTool } from '@gitroom/nestjs-libraries/chat/tools/autopost.tool';
import { ShortlinkPreferenceTool } from '@gitroom/nestjs-libraries/chat/tools/shortlink.preference.tool';
import { IntegrationSchedulePostTool } from '@gitroom/nestjs-libraries/chat/tools/integration.schedule.post';
import { PLANS } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';

const postsStillAttached =
  'You have to delete all the posts associated with this channel before deleting it';

const run = async (tool: { run: () => any }, input: unknown, org: Record<string, unknown> = { id: 'org-1' }) => {
  const built = tool.run();
  const store = new Map<string, string>([['organization', JSON.stringify(org)]]);
  return built.execute(input, {
    requestContext: {
      get: (key: string) => store.get(key),
      set: (key: string, value: string) => store.set(key, value),
    },
  });
};

const freePlan = () =>
  Promise.reject(
    new HttpException(
      { message: 'Free does not include this. Upgrade your plan.', upgrade: true },
      402
    )
  );

describe('schedule MCP tools', () => {
  it('registers the schedule tools by class with no name prefix', () => {
    const list = readFileSync(join(__dirname, 'tool.list.ts'), 'utf8');
    for (const name of [
      'PostDateTool',
      'PostContentTool',
      'IntegrationChannelTool',
      'SetsTool',
      'SignaturesTool',
      'AutopostTool',
      'ShortlinkPreferenceTool',
    ]) {
      expect(list).toContain(name);
    }
    expect(new PostDateTool({} as any).name).toBe('postDateTool');
    expect(new PostContentTool({} as any).name).toBe('postContentTool');
    expect(new IntegrationChannelTool({} as any, {} as any).name).toBe(
      'integrationChannelTool'
    );
    expect(new SetsTool({} as any, {} as any).name).toBe('setsTool');
    expect(new SignaturesTool({} as any, {} as any).name).toBe('signaturesTool');
    expect(new AutopostTool({} as any, {} as any).name).toBe('autopostTool');
    expect(new ShortlinkPreferenceTool({} as any).name).toBe(
      'shortlinkPreferenceTool'
    );
  });

  describe('post date', () => {
    const posts = { changeDate: jest.fn() };
    const tool = new PostDateTool(posts as any);

    beforeEach(() => posts.changeDate.mockReset());

    it('moves an unpublished post with action update and republish off', async () => {
      posts.changeDate.mockImplementation(
        async (_org: string, id: string, date: string, action: string) => ({
          id,
          publishDate: new Date(`${date}Z`),
          state: action === 'schedule' ? 'QUEUE' : 'DRAFT',
        })
      );

      const result = await run(tool, {
        id: 'post-1',
        date: '2026-12-01T15:00:00',
      });

      expect(posts.changeDate).toHaveBeenCalledWith(
        'org-1',
        'post-1',
        '2026-12-01T15:00:00',
        'update',
        false
      );
      expect(result.output).toMatchObject({
        id: 'post-1',
        publishDate: '2026-12-01T15:00:00',
        state: 'DRAFT',
      });
    });

    it('does not requeue a published post', async () => {
      posts.changeDate.mockImplementation(
        async (_org: string, id: string, date: string, action: string, republish: boolean) => ({
          id,
          publishDate: new Date(`${date}Z`),
          state: action === 'schedule' || republish ? 'QUEUE' : 'PUBLISHED',
        })
      );

      const result = await run(tool, {
        id: 'published-1',
        date: '2026-12-02T09:30:00',
      });

      expect(posts.changeDate).toHaveBeenCalledWith(
        'org-1',
        'published-1',
        '2026-12-02T09:30:00',
        'update',
        false
      );
      expect(result.output.state).toBe('PUBLISHED');
      expect(result.output.publishDate).toBe('2026-12-02T09:30:00');
    });
  });

  describe('post content', () => {
    const posts = {
      getPostsRecursively: jest.fn(),
      validatePosts: jest.fn(),
      mapTypeToPost: jest.fn(),
      createPost: jest.fn(),
    };
    const tool = new PostContentTool(posts as any);
    const existingDate = new Date('2026-11-20T10:00:00.000Z');

    const existing = (state: string) => [
      {
        id: 'post-1',
        state,
        publishDate: existingDate,
        content: '<p>old</p>',
        image: JSON.stringify([
          { id: 'img-old', path: 'https://uploads.example/old.jpg' },
        ]),
        settings: JSON.stringify({ title: 'keep' }),
        group: 'group-1',
        integration: { id: 'int-1', providerIdentifier: 'linkedin', token: 'channel-token' },
        tags: [{ tag: { name: 'news' } }],
        delay: 0,
      },
    ];

    beforeEach(() => {
      posts.getPostsRecursively.mockReset();
      posts.validatePosts.mockReset();
      posts.mapTypeToPost.mockReset();
      posts.createPost.mockReset();
      posts.validatePosts.mockResolvedValue([
        { valid: true, errors: true, emptyContent: false, tooLong: false, name: 'LinkedIn' },
      ]);
      posts.mapTypeToPost.mockImplementation(async (body: unknown) => body);
      posts.createPost.mockResolvedValue([{ postId: 'post-1', integration: 'int-1' }]);
    });

    it.each(['DRAFT', 'QUEUE'])(
      'changes text and media of a %s post and keeps the date',
      async (state) => {
        posts.getPostsRecursively.mockResolvedValue(existing(state));

        const result = await run(tool, {
          id: 'post-1',
          posts: [
            {
              content: '<p>new</p>',
              attachments: ['https://uploads.example/new.jpg'],
            },
          ],
        });

        expect(posts.mapTypeToPost).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'update',
            date: '2026-11-20T10:00:00',
            shortLink: false,
            posts: [
              expect.objectContaining({
                group: 'group-1',
                value: [
                  expect.objectContaining({
                    id: 'post-1',
                    content: '<p>new</p>',
                    image: [
                      expect.objectContaining({
                        path: 'https://uploads.example/new.jpg',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          'org-1'
        );
        const saved = posts.createPost.mock.calls[0];
        expect(saved[0]).toBe('org-1');
        expect(saved[1].type).toBe('update');
        expect(saved[1].date).toBe('2026-11-20T10:00:00');
        expect(saved[2]).toBe('MCP');
        expect(saved[3]).toBe(true);
        expect(JSON.stringify(result)).not.toContain('channel-token');
        expect(result.output).toEqual({
          postId: 'post-1',
          publishDate: '2026-11-20T10:00:00',
        });
      }
    );

    it('refuses a published post', async () => {
      posts.getPostsRecursively.mockResolvedValue(existing('PUBLISHED'));

      const result = await run(tool, {
        id: 'post-1',
        posts: [{ content: '<p>new</p>' }],
      });

      expect(result.output.error).toBe(
        'Only scheduled posts that were not published yet (or drafts) can be updated'
      );
      expect(posts.createPost).not.toHaveBeenCalled();
      expect(posts.mapTypeToPost).not.toHaveBeenCalled();
    });
  });

  describe('channel', () => {
    const integration = {
      disableChannel: jest.fn(),
      enableChannel: jest.fn(),
      getPostsForChannel: jest.fn(),
      deleteChannel: jest.fn(),
      getIntegrationById: jest.fn(),
      updateNameAndUrl: jest.fn(),
      setTimes: jest.fn(),
    };
    const nickname = jest.fn();
    const manager = {
      getSocialIntegration: jest.fn(() => ({ changeNickname: nickname })),
    };
    const tool = new IntegrationChannelTool(integration as any, manager as any);
    const org = { id: 'org-1', subscription: { totalChannels: 5 } };

    beforeEach(() => {
      Object.values(integration).forEach((fn) => fn.mockReset());
      nickname.mockReset();
      manager.getSocialIntegration.mockClear();
    });

    it('disables a channel and then enables it', async () => {
      await run(tool, { action: 'disable', id: 'ch-1' }, org);
      await run(tool, { action: 'enable', id: 'ch-1' }, org);

      expect(integration.disableChannel).toHaveBeenCalledWith('org-1', 'ch-1');
      expect(integration.enableChannel).toHaveBeenCalledWith('org-1', 5, 'ch-1');
    });

    it('returns the channel-menu conflict when posts are still attached', async () => {
      integration.getPostsForChannel.mockResolvedValue([{ group: 'g1' }]);

      const result = await run(tool, { action: 'delete', id: 'ch-1' }, org);

      expect(result.output.error).toBe(postsStillAttached);
      expect(integration.deleteChannel).not.toHaveBeenCalled();
    });

    it('saves a nickname without returning the channel token', async () => {
      const token = 'oauth-token-secret';
      integration.getIntegrationById.mockResolvedValue({
        id: 'ch-1',
        internalId: 'internal',
        providerIdentifier: 'discord',
        token,
      });
      nickname.mockResolvedValue({ name: 'Desk' });
      integration.updateNameAndUrl.mockResolvedValue({
        id: 'ch-1',
        name: 'Desk',
        picture: '',
        token,
        refreshToken: 'refresh-secret',
      });

      const result = await run(
        tool,
        { action: 'nickname', id: 'ch-1', name: 'Desk' },
        org
      );

      expect(nickname).toHaveBeenCalledWith('internal', token, 'Desk');
      expect(integration.updateNameAndUrl).toHaveBeenCalledWith('ch-1', 'Desk', '');
      expect(result.output).toEqual({ id: 'ch-1', name: 'Desk', picture: '' });
      expect(JSON.stringify(result)).not.toContain(token);
      expect(JSON.stringify(result)).not.toContain('refresh-secret');
    });

    it('stores time slots through setTimes', async () => {
      const result = await run(
        tool,
        { action: 'slots', id: 'ch-1', slots: [540, 900] },
        org
      );

      expect(integration.setTimes).toHaveBeenCalledWith('org-1', 'ch-1', {
        time: [{ time: 540 }, { time: 900 }],
      });
      expect(result.output.time).toEqual([{ time: 540 }, { time: 900 }]);
    });
  });

  describe('sets', () => {
    const saved: any[] = [];
    const sets = {
      getSets: jest.fn(async () => saved),
      createSet: jest.fn(async (_org: string, body: any) => {
        const row = { id: body.id || 'set-1', name: body.name, content: body.content };
        const index = saved.findIndex((item) => item.id === row.id);
        if (index === -1) saved.push(row);
        else saved[index] = row;
        return { id: row.id };
      }),
      deleteSet: jest.fn(),
    };
    const entitlements = { assertFeature: jest.fn() };
    const tool = new SetsTool(sets as any, entitlements as any);

    beforeEach(() => {
      saved.length = 0;
      sets.createSet.mockClear();
      sets.deleteSet.mockClear();
      entitlements.assertFeature.mockReset();
      entitlements.assertFeature.mockResolvedValue(undefined);
    });

    it('saves a set that then shows up in the list', async () => {
      await run(tool, { action: 'create', name: 'Launch', content: 'Hello' });
      const listed = await run(tool, { action: 'list' });

      expect(sets.createSet).toHaveBeenCalledWith('org-1', {
        id: undefined,
        name: 'Launch',
        content: 'Hello',
      });
      expect(listed.output).toEqual([
        { id: 'set-1', name: 'Launch', content: 'Hello' },
      ]);
    });

    it('refuses a free workspace', async () => {
      entitlements.assertFeature.mockImplementation(freePlan);

      const result = await run(tool, {
        action: 'create',
        name: 'Launch',
        content: 'Hello',
      });

      expect(result.output.error).toBe(
        'Free does not include this. Upgrade your plan.'
      );
      expect(sets.createSet).not.toHaveBeenCalled();
    });
  });

  describe('signatures', () => {
    const signatures = {
      getSignaturesByOrgId: jest.fn(),
      getDefaultSignature: jest.fn(),
      createOrUpdateSignature: jest.fn(),
      deleteSignature: jest.fn(),
    };
    const entitlements = { assertFeature: jest.fn() };
    const tool = new SignaturesTool(signatures as any, entitlements as any);

    beforeEach(() => {
      Object.values(signatures).forEach((fn) => fn.mockReset());
      entitlements.assertFeature.mockReset();
      entitlements.assertFeature.mockResolvedValue(undefined);
    });

    it('returns the same default signature as GET /signatures/default', async () => {
      const row = { id: 'sig-1', content: '— Harsh', autoAdd: true };
      signatures.getDefaultSignature.mockResolvedValue(row);

      const result = await run(tool, { action: 'default' });

      expect(signatures.getDefaultSignature).toHaveBeenCalledWith('org-1');
      expect(result.output).toEqual(row || {});
    });

    it('returns an empty object when there is no default signature', async () => {
      signatures.getDefaultSignature.mockResolvedValue(null);

      const result = await run(tool, { action: 'default' });

      expect(result.output).toEqual({});
    });

    it('refuses a free workspace', async () => {
      entitlements.assertFeature.mockImplementation(freePlan);

      const result = await run(tool, { action: 'default' });

      expect(result.output.error).toBe(
        'Free does not include this. Upgrade your plan.'
      );
      expect(signatures.getDefaultSignature).not.toHaveBeenCalled();
    });
  });

  describe('autopost', () => {
    const autopost = {
      getAutoposts: jest.fn(),
      createAutopost: jest.fn(),
      deleteAutopost: jest.fn(),
      changeActive: jest.fn(),
      loadXML: jest.fn(),
    };
    const entitlements = { limits: jest.fn() };
    const tool = new AutopostTool(autopost as any, entitlements as any);

    beforeEach(() => {
      Object.values(autopost).forEach((fn) => fn.mockReset());
      entitlements.limits.mockReset();
    });

    it.each(['FREE', 'STANDARD'] as const)(
      'refuses a %s workspace because autopost is off',
      async (tier) => {
        entitlements.limits.mockResolvedValue({ plan: PLANS[tier], tier });

        const result = await run(tool, {
          action: 'send',
          url: 'https://example.com/feed.xml',
        });

        expect(result.output.error).toBe(
          `${PLANS[tier].displayName} does not include this. Upgrade your plan.`
        );
        expect(autopost.loadXML).not.toHaveBeenCalled();
        expect(autopost.createAutopost).not.toHaveBeenCalled();
      }
    );

    it('sends a test through the same loadXML path as POST /autopost/send', async () => {
      entitlements.limits.mockResolvedValue({ plan: PLANS.TEAM, tier: 'TEAM' });
      autopost.loadXML.mockResolvedValue({
        success: true,
        url: 'https://example.com/post',
      });

      const result = await run(tool, {
        action: 'send',
        url: 'https://example.com/feed.xml',
      });

      expect(autopost.loadXML).toHaveBeenCalledWith('https://example.com/feed.xml');
      expect(result.output).toEqual({
        success: true,
        url: 'https://example.com/post',
      });
    });
  });

  describe('shortlink preference', () => {
    let current = 'ASK';
    const organization = {
      getShortlinkPreference: jest.fn(async () => ({ shortlink: current })),
      updateShortlinkPreference: jest.fn(async (_org: string, value: string) => {
        current = value;
        return { id: 'org-1', apiKey: 'stored-api-key', shortlink: value };
      }),
    };
    const tool = new ShortlinkPreferenceTool(organization as any);

    beforeEach(() => {
      current = 'ASK';
      organization.getShortlinkPreference.mockClear();
      organization.updateShortlinkPreference.mockClear();
    });

    it.each([
      ['ask', 'ASK'],
      ['always', 'YES'],
      ['never', 'NO'],
    ] as const)(
      'updates %s and then reads the same value as GET /settings/shortlink',
      async (preference, stored) => {
        const updated = await run(tool, { action: 'update', preference });
        const read = await run(tool, { action: 'read' });

        expect(organization.updateShortlinkPreference).toHaveBeenCalledWith(
          'org-1',
          stored
        );
        expect(updated.output).toEqual({ shortlink: stored });
        expect(read.output).toEqual({ shortlink: stored });
        expect(JSON.stringify(updated)).not.toContain('stored-api-key');
        expect(JSON.stringify(read)).not.toContain('stored-api-key');
      }
    );

    it('leaves the per-post shortLink flag on integrationSchedulePostTool', () => {
      const schedule = new IntegrationSchedulePostTool({} as any, {} as any).run() as any;
      const shape =
        typeof schedule.inputSchema?._def?.shape === 'function'
          ? schedule.inputSchema._def.shape()
          : schedule.inputSchema?.shape;
      const post = shape.socialPost.element.shape;
      expect(post.shortLink).toBeDefined();
      expect(String(post.shortLink.description || '')).toContain('short link');
    });
  });
});
