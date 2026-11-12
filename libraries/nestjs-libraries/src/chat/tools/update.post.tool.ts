import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { EntitlementService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/entitlement.service';
import {
  organizationFromTool,
  toolFailure,
} from '@gitroom/nestjs-libraries/chat/auth.context';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

const threadItem = z.object({
  content: z
    .string()
    .describe(
      'HTML content. Each line must be wrapped in <p>. Tags: h1, h2, h3, u, strong, li, ul, p'
    ),
  attachments: z
    .array(z.string())
    .optional()
    .describe('Media URLs. Omit to keep the current media on this item'),
});

const settingItem = z.object({
  key: z.string().describe('Settings key from integrationSchema'),
  value: z.any().describe('Value of the key. Prefer an id, then a label'),
});

const channelItem = z.object({
  integrationId: z
    .string()
    .describe('Target channel id. The channel must belong to this workspace'),
  id: z
    .string()
    .optional()
    .describe('Existing main post id on this channel. Omit to add the channel'),
  group: z
    .string()
    .optional()
    .describe('Existing group for this channel. Omit when adding a channel'),
  date: z
    .string()
    .optional()
    .describe('UTC publish time for this channel, for example 2026-12-01T15:00:00'),
  settings: z.array(settingItem).optional(),
  posts: z
    .array(threadItem)
    .min(1)
    .optional()
    .describe('First item is the post. Later items are comments. Omit to keep the current text and media'),
});

type ThreadItem = {
  content: string;
  attachments?: string[];
};

type SettingItem = {
  key: string;
  value: unknown;
};

type ChannelInput = {
  integrationId: string;
  id?: string;
  group?: string;
  date?: string;
  settings?: SettingItem[];
  posts?: ThreadItem[];
};

type StoredImage = {
  id?: string;
  path: string;
  alt?: string;
  thumbnail?: string;
  thumbnailTimestamp?: number;
};

type LoadedPost = {
  id: string;
  parentPostId?: string | null;
  state: string;
  publishDate: Date | string;
  content: string;
  image: string | null;
  settings: string | null;
  group: string;
  delay?: number | null;
  integration?: { id: string; providerIdentifier: string };
  tags?: { tag?: { name?: string } }[];
};

type ValidationItem = {
  name: string;
  emptyContent?: boolean;
  valid?: boolean;
  settingsError?: string;
  errors?: true | string;
  tooLong?: boolean;
  maximumCharacters?: number;
};

type SaveType = 'draft' | 'schedule' | 'now' | 'update';

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  try {
    return JSON.parse(value || '') as T;
  } catch {
    return fallback;
  }
};

const utcStamp = (value: Date | string) =>
  dayjs.utc(value).format('YYYY-MM-DDTHH:mm:ss');

const mergedSettings = (
  existing: Record<string, unknown>,
  incoming?: SettingItem[]
) =>
  (incoming || []).reduce<Record<string, unknown>>(
    (acc, item) => ({ ...acc, [item.key]: item.value }),
    { ...existing }
  );

const imagesFrom = (incoming: string[] | undefined, existingRaw: string | null) => {
  if (incoming) {
    return incoming.map((path) => ({ id: makeId(10), path }));
  }
  return parseJson<StoredImage[]>(existingRaw, []).map((img) => ({
    id: img.id,
    path: img.path,
    ...(img.alt ? { alt: img.alt } : {}),
    ...(img.thumbnail ? { thumbnail: img.thumbnail } : {}),
    ...(img.thumbnailTimestamp !== undefined
      ? { thumbnailTimestamp: img.thumbnailTimestamp }
      : {}),
  }));
};

@Injectable()
export class UpdatePostTool implements AgentToolInterface {
  constructor(
    private _postsService: PostsService,
    private _entitlements: EntitlementService
  ) {}
  name = 'update_post';

  run() {
    return createTool({
      id: 'update_post',
      description: `Edit an existing post the same way as the Schedule composer: content, media, scheduled time, and target channels. Find the post with postsListTool and pass its id. type defaults to update, which saves the details and does not publish the post again, including a post that was already published. Pass type schedule or now to schedule it or post it now. Publishing an already-published post again requires republish true; without it the save is refused, the same as the composer. Omit date, posts, or integrationId to keep the current time, text, media, or channel. Omit attachments on a posts item to keep its media. Pass channels to save one entry per target channel in this call. Each channel must belong to this workspace. Confirm with the user before saving.`,
      inputSchema: z.object({
        id: z.string().describe('The id of the main post'),
        date: z
          .string()
          .optional()
          .describe(
            'New publish time in UTC, for example 2026-12-01T15:00:00. Omit to keep the current time'
          ),
        integrationId: z
          .string()
          .optional()
          .describe(
            'Target channel id. Omit to keep the current channel. The channel must belong to this workspace'
          ),
        type: z
          .enum(['draft', 'schedule', 'now', 'update'])
          .optional()
          .describe(
            'Defaults to update. update saves details without publishing again. schedule and now publish, and an already-published post then needs republish true'
          ),
        republish: z
          .boolean()
          .optional()
          .describe(
            'Pass true with type schedule or now to publish an already-published post again'
          ),
        shortLink: z
          .boolean()
          .optional()
          .describe('Shorten links in the post. Omit to leave them as written'),
        settings: z
          .array(settingItem)
          .optional()
          .describe('Settings keys to change. Omitted keys stay as they are'),
        posts: z
          .array(threadItem)
          .min(1)
          .optional()
          .describe(
            'First item is the post. Later items are comments. Omit to keep the current text and media'
          ),
        channels: z
          .array(channelItem)
          .min(1)
          .optional()
          .describe(
            'One entry per target channel to save in this call, the same posts array as the composer. Omit to edit only the post in id'
          ),
      }),
      outputSchema: z.object({
        output: z.any(),
      }),
      mcp: {
        annotations: {
          title: 'Update Post',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      execute: async (inputData, context) => {
        try {
          const org = organizationFromTool(inputData, context);
          await this._entitlements.assertPostsThisPeriod(org.id);
          const saved = await this.save(org.id, inputData);
          return { output: saved };
        } catch (err) {
          const failure = toolFailure(err);
          if (failure) return failure;
          throw err;
        }
      },
    });
  }

  private async save(
    orgId: string,
    input: {
      id: string;
      date?: string;
      integrationId?: string;
      type?: SaveType;
      republish?: boolean;
      shortLink?: boolean;
      settings?: SettingItem[];
      posts?: ThreadItem[];
      channels?: ChannelInput[];
    }
  ) {
    const ordered = await this.loadOwned(orgId, input.id);
    const root = ordered[0];
    const type: SaveType = input.type || 'update';
    const date = input.date || utcStamp(root.publishDate);
    const channels: ChannelInput[] = input.channels?.length
      ? input.channels
      : [
          {
            integrationId: input.integrationId || root.integration?.id || '',
            id: root.id,
            group: root.group,
            settings: input.settings,
            posts: input.posts,
          },
        ];

    const posts = [];
    for (const channel of channels) {
      posts.push(await this.channelPost(orgId, channel, ordered));
    }

    const validation = (await this._postsService.validatePosts(
      orgId,
      posts.map((post) => ({
        integration: post.integration,
        settings: post.settings,
        value: post.value.map((item) => ({
          content: item.content,
          image: item.image,
        })),
      }))
    )) as ValidationItem[];
    this.assertValid(validation, type);

    const body = await this._postsService.mapTypeToPost(
      {
        type,
        date,
        shortLink: input.shortLink ?? false,
        ...(input.republish ? { republish: true } : {}),
        tags: (root.tags || []).map((tag) => ({
          value: tag.tag?.name,
          label: tag.tag?.name,
        })),
        posts,
      } as any,
      orgId
    );
    const [output] = await this._postsService.createPost(orgId, body, 'MCP', true);
    if (!output) {
      throw new BadRequestException('Failed to update the post');
    }
    return {
      postId: output.postId,
      integration: output.integration,
      publishDate: date,
      type,
    };
  }

  private async channelPost(
    orgId: string,
    channel: ChannelInput,
    anchor: LoadedPost[]
  ) {
    if (!channel.integrationId) {
      throw new BadRequestException('Post not found');
    }
    const existing =
      channel.id && channel.id !== anchor[0].id
        ? await this.loadOwned(orgId, channel.id)
        : channel.id
        ? anchor
        : [];
    if (channel.id && !existing.length) {
      throw new BadRequestException('Post not found');
    }
    if (!channel.id && !channel.posts?.length) {
      throw new BadRequestException('posts are required when adding a channel');
    }
    const root = existing[0];
    const count = Math.max(existing.length, channel.posts?.length || 0);
    const value = [...new Array(count)].map((_: unknown, index: number) => {
      const current = existing[index];
      const incoming = channel.posts?.[index];
      return {
        id: current?.id || makeId(10),
        content: incoming?.content ?? current?.content ?? '',
        delay: current?.delay || 0,
        image: imagesFrom(incoming?.attachments, current?.image || null),
      };
    });
    return {
      integration: { id: channel.integrationId },
      group: channel.group || root?.group,
      ...(channel.date ? { date: channel.date } : {}),
      settings: mergedSettings(
        parseJson<Record<string, unknown>>(root?.settings, {}),
        channel.settings
      ),
      value,
    };
  }

  private async loadOwned(orgId: string, id: string) {
    const ordered = (await this._postsService.getPostsRecursively(
      id,
      true,
      orgId,
      true
    )) as LoadedPost[];
    const root = ordered[0];
    if (!root) {
      throw new BadRequestException('Post not found');
    }
    if (root.parentPostId) {
      throw new BadRequestException(
        'This id belongs to a comment, pass the id of the main post'
      );
    }
    if (!root.integration?.id) {
      throw new BadRequestException('Post not found');
    }
    return ordered;
  }

  // Same checks as POST /posts: empty content always, and settings, provider
  // rules, and length unless the save is a draft.
  private assertValid(validation: ValidationItem[], type: SaveType) {
    for (const item of validation) {
      if (item.emptyContent) {
        throw new BadRequestException(
          `${item.name}: Your post should have at least one character or one image.`
        );
      }
    }
    if (type === 'draft') {
      return;
    }
    for (const item of validation) {
      if (!item.valid) {
        throw new BadRequestException(
          `${item.name}: ${item.settingsError || 'Please fix your settings'}`
        );
      }
      if (item.errors !== true) {
        throw new BadRequestException(`${item.name}: ${item.errors}`);
      }
      if (item.tooLong) {
        throw new BadRequestException(
          `${item.name}: The maximum characters is ${item.maximumCharacters}`
        );
      }
    }
  }
}
