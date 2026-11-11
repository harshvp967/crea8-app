import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import {
  organizationFromTool,
  toolFailure,
} from '@gitroom/nestjs-libraries/chat/auth.context';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  try {
    return JSON.parse(value || '') as T;
  } catch {
    return fallback;
  }
};

@Injectable()
export class PostContentTool implements AgentToolInterface {
  constructor(private _postsService: PostsService) {}
  name = 'postContentTool';

  run() {
    return createTool({
      id: 'postContentTool',
      description: `Edit the text and media of a draft or scheduled post that was not published yet. Saves through the same posts path as the composer POST /posts with type "update", so the publish date does not change. A published post is refused. Find the post with postsListTool. The first posts item is the post; later items are comments. Omit attachments on an item to keep its current media. Confirm with the user before saving.`,
      inputSchema: z.object({
        id: z.string().describe('The id of the main post'),
        posts: z
          .array(
            z.object({
              content: z
                .string()
                .describe(
                  'HTML content. Each line must be wrapped in <p>. Tags: h1, h2, h3, u, strong, li, ul, p'
                ),
              attachments: z
                .array(z.string())
                .optional()
                .describe('Media URLs. Omit to keep the current media'),
            })
          )
          .min(1),
      }),
      outputSchema: z.object({
        output: z.any(),
      }),
      mcp: {
        annotations: {
          title: 'Edit Post Content',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      execute: async (inputData, context) => {
        try {
          const org = organizationFromTool(inputData, context);
          const ordered = await this._postsService.getPostsRecursively(
            inputData.id,
            true,
            org.id,
            true
          );
          const root = ordered[0] as any;
          if (!root) {
            throw new BadRequestException('Post not found');
          }
          if (root.parentPostId) {
            throw new BadRequestException(
              'This id belongs to a comment, pass the id of the main post'
            );
          }
          if (root.state !== 'QUEUE' && root.state !== 'DRAFT') {
            throw new BadRequestException(
              'Only scheduled posts that were not published yet (or drafts) can be updated'
            );
          }

          const integration = root.integration;
          if (!integration?.id) {
            throw new BadRequestException('Post not found');
          }

          const date = dayjs.utc(root.publishDate).format('YYYY-MM-DDTHH:mm:ss');
          const settings = {
            ...parseJson<Record<string, unknown>>(root.settings, {}),
            __type: integration.providerIdentifier,
          };
          const count = Math.max(ordered.length, inputData.posts.length);
          const value = [...new Array(count)].map((_: unknown, index: number) => {
            const existing = ordered[index] as any;
            const incoming = inputData.posts[index];
            const image = incoming?.attachments
              ? incoming.attachments.map((path: string) => ({ id: makeId(10), path }))
              : parseJson<any[]>(existing?.image, []).map((img: any) => ({
                  id: img.id,
                  path: img.path,
                  ...(img.alt ? { alt: img.alt } : {}),
                  ...(img.thumbnail ? { thumbnail: img.thumbnail } : {}),
                }));
            return {
              id: existing?.id || makeId(10),
              content: incoming?.content ?? existing?.content ?? '',
              delay: existing?.delay || 0,
              image,
            };
          });
          const posts = [
            {
              integration: { id: integration.id },
              group: root.group,
              settings,
              value,
            },
          ];
          const validation = await this._postsService.validatePosts(org.id, posts);
          for (const item of validation) {
            if (item.emptyContent) {
              throw new BadRequestException(
                `${item.name}: Your post should have at least one character or one image.`
              );
            }
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
                `${item.name}: post is too long, please fix it`
              );
            }
          }

          const body = await this._postsService.mapTypeToPost(
            {
              type: 'update',
              date,
              shortLink: false,
              tags: (root.tags || []).map((tag: any) => ({
                value: tag.tag?.name,
                label: tag.tag?.name,
              })),
              posts,
            } as any,
            org.id
          );
          const [output] = await this._postsService.createPost(
            org.id,
            body,
            'MCP',
            true
          );
          if (!output) {
            throw new BadRequestException('Failed to update the post');
          }
          return {
            output: {
              postId: output.postId,
              publishDate: date,
            },
          };
        } catch (err) {
          const failure = toolFailure(err);
          if (failure) return failure;
          throw err;
        }
      },
    });
  }
}
