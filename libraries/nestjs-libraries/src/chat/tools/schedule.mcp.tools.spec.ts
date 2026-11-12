import { readFileSync } from 'fs';
import { join } from 'path';
import { HttpException, NotFoundException } from '@nestjs/common';

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
import { UpdatePostTool } from '@gitroom/nestjs-libraries/chat/tools/update.post.tool';
import { DeletePostTool } from '@gitroom/nestjs-libraries/chat/tools/delete.post.tool';
import { IntegrationChannelTool } from '@gitroom/nestjs-libraries/chat/tools/integration.channel.tool';
import { SetsTool } from '@gitroom/nestjs-libraries/chat/tools/sets.tool';
import { SignaturesTool } from '@gitroom/nestjs-libraries/chat/tools/signatures.tool';
import { AutopostTool } from '@gitroom/nestjs-libraries/chat/tools/autopost.tool';
import { ShortlinkPreferenceTool } from '@gitroom/nestjs-libraries/chat/tools/shortlink.preference.tool';
import { IntegrationSchedulePostTool } from '@gitroom/nestjs-libraries/chat/tools/integration.schedule.post';
import { PLANS } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';
import {
  autopostUpgradeMessage,
  channelUpgradeMessage,
  postsUpgradeMessage,
  webhookUpgradeMessage,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.rules';

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
      'UpdatePostTool',
      'DeletePostTool',
      'IntegrationChannelTool',
      'SetsTool',
      'SignaturesTool',
      'AutopostTool',
      'ShortlinkPreferenceTool',
    ]) {
      expect(list).toContain(name);
    }
    expect(list).not.toContain('PostContentTool');
    expect(new PostDateTool({} as any).name).toBe('postDateTool');
    expect(new UpdatePostTool({} as any, {} as any).name).toBe('update_post');
    expect(new DeletePostTool({} as any, {} as any).name).toBe('delete_post');
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

  describe('update_post', () => {
    const posts = {
      getPostsRecursively: jest.fn(),
      validatePosts: jest.fn(),
      mapTypeToPost: jest.fn(),
      createPost: jest.fn(),
    };
    const entitlements = { assertPostsThisPeriod: jest.fn() };
    const tool = new UpdatePostTool(posts as any, entitlements as any);
    const existingDate = new Date('2026-11-20T10:00:00.000Z');

    const existing = (state: string, id = 'post-1', integrationId = 'int-1') => [
      {
        id,
        state,
        publishDate: existingDate,
        content: '<p>old</p>',
        image: JSON.stringify([
          { id: 'img-old', path: 'https://uploads.example/old.jpg' },
        ]),
        settings: JSON.stringify({ title: 'keep' }),
        group: id === 'post-1' ? 'group-1' : 'group-2',
        integration: {
          id: integrationId,
          providerIdentifier: 'linkedin',
          token: 'channel-token',
        },
        tags: [{ tag: { name: 'news' } }],
        delay: 0,
      },
    ];

    beforeEach(() => {
      posts.getPostsRecursively.mockReset();
      posts.validatePosts.mockReset();
      posts.mapTypeToPost.mockReset();
      posts.createPost.mockReset();
      entitlements.assertPostsThisPeriod.mockReset();
      entitlements.assertPostsThisPeriod.mockResolvedValue(undefined);
      posts.getPostsRecursively.mockImplementation(async (id: string) =>
        existing('QUEUE', id)
      );
      posts.validatePosts.mockResolvedValue([
        { valid: true, errors: true, emptyContent: false, tooLong: false, name: 'LinkedIn' },
      ]);
      posts.mapTypeToPost.mockImplementation(async (body: unknown) => body);
      posts.createPost.mockImplementation(async (_org: string, body: any) => [
        {
          postId: body.posts[0].value[0].id,
          integration: body.posts[0].integration.id,
        },
      ]);
    });

    it('updates content, media, scheduled time, and the target channel', async () => {
      const result = await run(tool, {
        id: 'post-1',
        date: '2026-12-01T15:00:00',
        integrationId: 'int-2',
        posts: [
          {
            content: '<p>new</p>',
            attachments: ['https://uploads.example/new.jpg'],
          },
        ],
      });

      expect(posts.getPostsRecursively).toHaveBeenCalledWith(
        'post-1',
        true,
        'org-1',
        true
      );
      expect(posts.validatePosts).toHaveBeenCalledWith(
        'org-1',
        [
          expect.objectContaining({
            integration: { id: 'int-2' },
            value: [
              expect.objectContaining({
                content: '<p>new</p>',
                image: [expect.objectContaining({ path: 'https://uploads.example/new.jpg' })],
              }),
            ],
          }),
        ]
      );
      const saved = posts.createPost.mock.calls[0];
      expect(saved[0]).toBe('org-1');
      expect(saved[1]).toMatchObject({
        type: 'update',
        date: '2026-12-01T15:00:00',
        shortLink: false,
        posts: [
          expect.objectContaining({
            group: 'group-1',
            integration: { id: 'int-2' },
            value: [
              expect.objectContaining({
                id: 'post-1',
                content: '<p>new</p>',
              }),
            ],
          }),
        ],
      });
      expect(saved[1].republish).toBeUndefined();
      expect(saved[2]).toBe('MCP');
      expect(saved[3]).toBe(true);
      expect(JSON.stringify(result)).not.toContain('channel-token');
      expect(result.output).toEqual({
        postId: 'post-1',
        integration: 'int-2',
        publishDate: '2026-12-01T15:00:00',
        type: 'update',
      });
    });

    it('saves one post per target channel', async () => {
      posts.getPostsRecursively.mockImplementation(async (id: string) =>
        existing(id === 'post-2' ? 'DRAFT' : 'QUEUE', id, id === 'post-2' ? 'int-2' : 'int-1')
      );

      await run(tool, {
        id: 'post-1',
        date: '2026-12-01T15:00:00',
        channels: [
          {
            integrationId: 'int-1',
            id: 'post-1',
            group: 'group-1',
            posts: [{ content: '<p>one</p>' }],
          },
          {
            integrationId: 'int-2',
            id: 'post-2',
            group: 'group-2',
            date: '2026-12-02T09:00:00',
            posts: [{ content: '<p>two</p>', attachments: ['https://uploads.example/two.jpg'] }],
          },
        ],
      });

      const body = posts.createPost.mock.calls[0][1];
      expect(body.posts).toEqual([
        expect.objectContaining({
          integration: { id: 'int-1' },
          group: 'group-1',
          value: [expect.objectContaining({ id: 'post-1', content: '<p>one</p>' })],
        }),
        expect.objectContaining({
          integration: { id: 'int-2' },
          group: 'group-2',
          date: '2026-12-02T09:00:00',
          value: [
            expect.objectContaining({
              id: 'post-2',
              content: '<p>two</p>',
              image: [expect.objectContaining({ path: 'https://uploads.example/two.jpg' })],
            }),
          ],
        }),
      ]);
      expect(posts.getPostsRecursively).toHaveBeenCalledWith('post-2', true, 'org-1', true);
    });

    it('keeps the date and channel when they are omitted', async () => {
      const result = await run(tool, {
        id: 'post-1',
        posts: [{ content: '<p>new</p>' }],
      });

      expect(posts.createPost.mock.calls[0][1]).toMatchObject({
        type: 'update',
        date: '2026-11-20T10:00:00',
        posts: [
          expect.objectContaining({
            integration: { id: 'int-1' },
            value: [
              expect.objectContaining({
                content: '<p>new</p>',
                image: [expect.objectContaining({ path: 'https://uploads.example/old.jpg' })],
              }),
            ],
          }),
        ],
      });
      expect(result.output.publishDate).toBe('2026-11-20T10:00:00');
    });

    it('updates a published post with type update and does not republish', async () => {
      posts.getPostsRecursively.mockResolvedValue(existing('PUBLISHED'));

      const result = await run(tool, {
        id: 'post-1',
        posts: [{ content: '<p>details</p>' }],
      });

      expect(posts.createPost.mock.calls[0][1].type).toBe('update');
      expect(posts.createPost.mock.calls[0][1].republish).toBeUndefined();
      expect(result.output).toMatchObject({ postId: 'post-1', type: 'update' });
    });

    it('passes republish through only when the caller sets it', async () => {
      posts.getPostsRecursively.mockResolvedValue(existing('PUBLISHED'));
      posts.createPost.mockRejectedValueOnce(
        new HttpException(
          'This post was already published. To edit without republishing, use type update. To intentionally publish again, pass republish: true.',
          400
        )
      );

      const refused = await run(tool, {
        id: 'post-1',
        type: 'schedule',
        date: '2026-12-01T15:00:00',
        posts: [{ content: '<p>again</p>' }],
      });

      expect(posts.createPost.mock.calls[0][1].type).toBe('schedule');
      expect(posts.createPost.mock.calls[0][1].republish).toBeUndefined();
      expect(refused.output.error).toContain('republish: true');

      posts.createPost.mockResolvedValueOnce([
        { postId: 'post-1', integration: 'int-1' },
      ]);
      const allowed = await run(tool, {
        id: 'post-1',
        type: 'schedule',
        republish: true,
        date: '2026-12-01T15:00:00',
        posts: [{ content: '<p>again</p>' }],
      });

      expect(posts.createPost.mock.calls[1][1].republish).toBe(true);
      expect(allowed.output.postId).toBe('post-1');
    });

    it('blocks a post or target channel from another workspace', async () => {
      posts.getPostsRecursively.mockResolvedValueOnce([]);

      const missing = await run(tool, {
        id: 'other-workspace-post',
        posts: [{ content: '<p>new</p>' }],
      });

      expect(missing.output.error).toBe('Post not found');
      expect(posts.createPost).not.toHaveBeenCalled();
      expect(posts.getPostsRecursively).toHaveBeenCalledWith(
        'other-workspace-post',
        true,
        'org-1',
        true
      );

      posts.getPostsRecursively.mockImplementation(async (id: string) =>
        existing('QUEUE', id)
      );
      posts.validatePosts.mockRejectedValueOnce(
        new HttpException('Integration with id int-foreign not found', 400)
      );
      const foreignChannel = await run(tool, {
        id: 'post-1',
        integrationId: 'int-foreign',
        posts: [{ content: '<p>new</p>' }],
      });

      expect(posts.validatePosts).toHaveBeenCalledWith(
        'org-1',
        [expect.objectContaining({ integration: { id: 'int-foreign' } })]
      );
      expect(foreignChannel.output.error).toContain('int-foreign');
      expect(posts.createPost).not.toHaveBeenCalled();
    });

    it('blocks a lower plan and an expired, cancelled, or empty subscription', async () => {
      entitlements.assertPostsThisPeriod.mockRejectedValueOnce(
        new HttpException({ message: postsUpgradeMessage('FREE'), upgrade: true }, 402)
      );

      const blocked = await run(tool, {
        id: 'post-1',
        posts: [{ content: '<p>new</p>' }],
      });

      expect(blocked.output.error).toBe(postsUpgradeMessage('FREE'));
      expect(posts.getPostsRecursively).not.toHaveBeenCalled();
      expect(posts.createPost).not.toHaveBeenCalled();

      entitlements.assertPostsThisPeriod.mockResolvedValueOnce(undefined);
      const allowed = await run(tool, {
        id: 'post-1',
        posts: [{ content: '<p>new</p>' }],
      });

      expect(entitlements.assertPostsThisPeriod).toHaveBeenCalledWith('org-1');
      expect(posts.createPost).toHaveBeenCalled();
      expect(allowed.output.postId).toBe('post-1');
    });
  });

  describe('delete_post', () => {
    const posts = {
      getPostsRecursively: jest.fn(),
      getPostsByGroup: jest.fn(),
      deletePost: jest.fn(),
    };
    const entitlements = { assertPostsThisPeriod: jest.fn() };
    const tool = new DeletePostTool(posts as any, entitlements as any);

    beforeEach(() => {
      posts.getPostsRecursively.mockReset();
      posts.getPostsByGroup.mockReset();
      posts.deletePost.mockReset();
      entitlements.assertPostsThisPeriod.mockReset();
      entitlements.assertPostsThisPeriod.mockResolvedValue(undefined);
      posts.getPostsRecursively.mockResolvedValue([{ id: 'post-1', group: 'group-1' }]);
      posts.getPostsByGroup.mockResolvedValue({
        group: 'group-1',
        siblings: [{ group: 'group-2' }],
      });
      posts.deletePost.mockResolvedValue({ error: true });
    });

    it('deletes the post group', async () => {
      const byId = await run(tool, { id: 'post-1', confirm: true });

      expect(posts.getPostsRecursively).toHaveBeenCalledWith(
        'post-1',
        false,
        'org-1',
        true
      );
      expect(posts.deletePost).toHaveBeenCalledTimes(1);
      expect(posts.deletePost).toHaveBeenCalledWith('org-1', 'group-1');
      expect(byId.output).toEqual({ deleted: true, groups: ['group-1'] });

      posts.deletePost.mockClear();
      const byGroup = await run(tool, { group: 'group-9', confirm: true });

      expect(posts.getPostsByGroup).toHaveBeenCalledWith('org-1', 'group-9');
      expect(posts.deletePost).toHaveBeenCalledWith('org-1', 'group-9');
      expect(byGroup.output.groups).toEqual(['group-9']);
    });

    it('deletes every channel when allChannels is true', async () => {
      const result = await run(tool, {
        id: 'post-1',
        allChannels: true,
        confirm: true,
      });

      expect(posts.getPostsByGroup).toHaveBeenCalledWith('org-1', 'group-1');
      expect(posts.deletePost.mock.calls.map((call) => call[1])).toEqual([
        'group-1',
        'group-2',
      ]);
      expect(result.output).toEqual({
        deleted: true,
        groups: ['group-1', 'group-2'],
      });
    });

    it.each([
      ['missing', {}],
      ['not true', { confirm: false }],
    ] as const)('refuses a delete when confirm is %s', async (_label, extra) => {
      const result = await run(tool, { id: 'post-1', ...extra });

      expect(result.error).toBe(true);
      expect(result.message).toContain('confirm');
      expect(result.output).toBeUndefined();
      expect(posts.deletePost).not.toHaveBeenCalled();
      expect(posts.getPostsRecursively).not.toHaveBeenCalled();
      expect(entitlements.assertPostsThisPeriod).not.toHaveBeenCalled();
    });

    it('requires confirm true in the schema and tells the client to confirm first', () => {
      const built = tool.run() as any;
      const shape =
        typeof built.inputSchema?._def?.shape === 'function'
          ? built.inputSchema._def.shape()
          : built.inputSchema?.shape;

      expect(shape.confirm._def.typeName).toBe('ZodLiteral');
      expect(shape.confirm._def.value).toBe(true);
      expect(built.description).toMatch(/Confirm with the user before calling/i);
      expect(built.description).toMatch(/refused unless confirm is true/i);
    });

    it('blocks a post or group from another workspace', async () => {
      posts.getPostsRecursively.mockResolvedValueOnce([]);

      const byId = await run(tool, { id: 'other-workspace-post', confirm: true });

      expect(byId.output.error).toBe('Post not found');
      expect(posts.getPostsRecursively).toHaveBeenCalledWith(
        'other-workspace-post',
        false,
        'org-1',
        true
      );
      expect(posts.deletePost).not.toHaveBeenCalled();

      posts.getPostsByGroup.mockRejectedValueOnce(new NotFoundException('Post not found'));
      const byGroup = await run(tool, { group: 'other-group', confirm: true });

      expect(posts.getPostsByGroup).toHaveBeenCalledWith('org-1', 'other-group');
      expect(byGroup.output.error).toBe('Post not found');
      expect(posts.deletePost).not.toHaveBeenCalled();
    });

    it('blocks a lower plan and an expired, cancelled, or empty subscription', async () => {
      entitlements.assertPostsThisPeriod.mockRejectedValueOnce(
        new HttpException({ message: postsUpgradeMessage('FREE'), upgrade: true }, 402)
      );

      const blocked = await run(tool, { id: 'post-1', confirm: true });

      expect(blocked.output.error).toBe(postsUpgradeMessage('FREE'));
      expect(posts.deletePost).not.toHaveBeenCalled();
      expect(posts.getPostsRecursively).not.toHaveBeenCalled();

      entitlements.assertPostsThisPeriod.mockResolvedValueOnce(undefined);
      const allowed = await run(tool, { id: 'post-1', confirm: true });

      expect(entitlements.assertPostsThisPeriod).toHaveBeenCalledWith('org-1');
      expect(posts.deletePost).toHaveBeenCalledWith('org-1', 'group-1');
      expect(allowed.output.deleted).toBe(true);
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

    it('blocks enable on a lower plan and allows it on a higher plan', async () => {
      integration.enableChannel.mockRejectedValueOnce(
        new HttpException(
          { message: channelUpgradeMessage('STANDARD'), upgrade: true },
          402
        )
      );

      const blocked = await run(tool, { action: 'enable', id: 'ch-1' }, org);

      expect(blocked.output.error).toBe(channelUpgradeMessage('STANDARD'));
      expect(blocked.output.disabled).toBeUndefined();

      integration.enableChannel.mockResolvedValueOnce(undefined);
      const higher = { id: 'org-1', subscription: { totalChannels: PLANS.TEAM.channels } };
      const allowed = await run(tool, { action: 'enable', id: 'ch-1' }, higher);

      expect(integration.enableChannel).toHaveBeenLastCalledWith(
        'org-1',
        PLANS.TEAM.channels,
        'ch-1'
      );
      expect(allowed.output).toEqual({ id: 'ch-1', disabled: false });
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

    it('blocks a free plan and allows a paid plan to save a set', async () => {
      entitlements.assertFeature.mockImplementationOnce(freePlan);

      const blocked = await run(tool, {
        action: 'create',
        name: 'Launch',
        content: 'Hello',
      });

      expect(blocked.output.error).toBe(
        'Free does not include this. Upgrade your plan.'
      );
      expect(sets.createSet).not.toHaveBeenCalled();

      entitlements.assertFeature.mockResolvedValueOnce(undefined);
      const allowed = await run(tool, {
        action: 'create',
        name: 'Launch',
        content: 'Hello',
      });

      expect(entitlements.assertFeature).toHaveBeenCalledWith('org-1', 'postingSets');
      expect(sets.createSet).toHaveBeenCalled();
      expect(allowed.output).toEqual({ id: 'set-1' });
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

    it('blocks a free plan and allows a paid plan to read the default', async () => {
      entitlements.assertFeature.mockImplementationOnce(freePlan);

      const blocked = await run(tool, { action: 'default' });

      expect(blocked.output.error).toBe(
        'Free does not include this. Upgrade your plan.'
      );
      expect(signatures.getDefaultSignature).not.toHaveBeenCalled();

      const row = { id: 'sig-1', content: '— Harsh', autoAdd: true };
      entitlements.assertFeature.mockResolvedValueOnce(undefined);
      signatures.getDefaultSignature.mockResolvedValueOnce(row);
      const allowed = await run(tool, { action: 'default' });

      expect(entitlements.assertFeature).toHaveBeenCalledWith('org-1', 'postingSets');
      expect(allowed.output).toEqual(row);
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
    const entitlements = {
      assertCanAutopost: jest.fn(),
      assertCanAddWebhook: jest.fn(),
    };
    const tool = new AutopostTool(autopost as any, entitlements as any);

    beforeEach(() => {
      Object.values(autopost).forEach((fn) => fn.mockReset());
      entitlements.assertCanAutopost.mockReset();
      entitlements.assertCanAddWebhook.mockReset();
      entitlements.assertCanAutopost.mockResolvedValue(undefined);
      entitlements.assertCanAddWebhook.mockResolvedValue(undefined);
    });

    it.each(['FREE', 'STANDARD'] as const)(
      'refuses a %s workspace because autopost is off',
      async (tier) => {
        entitlements.assertCanAutopost.mockRejectedValue(
          new HttpException({ message: autopostUpgradeMessage(tier), upgrade: true }, 402)
        );

        const result = await run(tool, {
          action: 'send',
          url: 'https://example.com/feed.xml',
        });

        expect(result.output.error).toBe(autopostUpgradeMessage(tier));
        expect(entitlements.assertCanAddWebhook).not.toHaveBeenCalled();
        expect(autopost.loadXML).not.toHaveBeenCalled();
        expect(autopost.createAutopost).not.toHaveBeenCalled();
      }
    );

    it('blocks a create past the webhook limit and allows it on a higher plan', async () => {
      entitlements.assertCanAddWebhook.mockRejectedValueOnce(
        new HttpException({ message: webhookUpgradeMessage('TEAM'), upgrade: true }, 402)
      );

      const blocked = await run(tool, {
        action: 'create',
        title: 'Feed',
        url: 'https://example.com/feed.xml',
      });

      expect(blocked.output.error).toBe(webhookUpgradeMessage('TEAM'));
      expect(autopost.createAutopost).not.toHaveBeenCalled();

      entitlements.assertCanAddWebhook.mockResolvedValueOnce(undefined);
      autopost.createAutopost.mockResolvedValueOnce({ id: 'auto-1' });
      const allowed = await run(tool, {
        action: 'create',
        title: 'Feed',
        url: 'https://example.com/feed.xml',
      });

      expect(entitlements.assertCanAutopost).toHaveBeenCalledWith('org-1');
      expect(entitlements.assertCanAddWebhook).toHaveBeenCalledWith('org-1');
      expect(autopost.createAutopost).toHaveBeenCalled();
      expect(allowed.output).toEqual({ id: 'auto-1' });
    });

    it('sends a test through the same loadXML path as POST /autopost/send', async () => {
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

  describe('schedule post quota', () => {
    const posts = {
      validatePosts: jest.fn(),
      createPost: jest.fn(),
    };
    const integrations = { getIntegrationById: jest.fn() };
    const entitlements = { assertPostsThisPeriod: jest.fn() };
    const tool = new IntegrationSchedulePostTool(
      posts as any,
      integrations as any,
      entitlements as any
    );
    const input = {
      socialPost: [
        {
          integrationId: 'ch-1',
          isPremium: false,
          date: '2026-12-01T15:00:00',
          shortLink: false,
          type: 'draft' as const,
          postsAndComments: [{ content: '<p>Hi</p>', attachments: [] as string[] }],
          settings: [] as { key: string; value: string }[],
        },
      ],
    };

    beforeEach(() => {
      posts.validatePosts.mockReset();
      posts.createPost.mockReset();
      integrations.getIntegrationById.mockReset();
      entitlements.assertPostsThisPeriod.mockReset();
    });

    it('blocks a lower plan and allows a higher plan to create a draft', async () => {
      entitlements.assertPostsThisPeriod.mockRejectedValueOnce(
        new HttpException({ message: postsUpgradeMessage('FREE'), upgrade: true }, 402)
      );

      const blocked = await run(tool, input);

      expect(blocked.output.errors).toBe(postsUpgradeMessage('FREE'));
      expect(posts.createPost).not.toHaveBeenCalled();
      expect(integrations.getIntegrationById).not.toHaveBeenCalled();

      entitlements.assertPostsThisPeriod.mockResolvedValueOnce(undefined);
      integrations.getIntegrationById.mockResolvedValue({
        id: 'ch-1',
        providerIdentifier: 'linkedin',
      });
      posts.validatePosts.mockResolvedValue([
        { valid: true, errors: true, emptyContent: false, tooLong: false, name: 'LinkedIn' },
      ]);
      posts.createPost.mockResolvedValue([{ postId: 'post-1', integration: 'ch-1' }]);

      const allowed = await run(tool, input);

      expect(entitlements.assertPostsThisPeriod).toHaveBeenCalledWith('org-1');
      expect(posts.createPost).toHaveBeenCalled();
      expect(allowed.output).toEqual([{ postId: 'post-1', integration: 'ch-1' }]);
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
      const schedule = new IntegrationSchedulePostTool({} as any, {} as any, {} as any).run() as any;
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
