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

const confirmMessage =
  'confirm must be true. Confirm with the user before deleting a post.';

type LoadedGroup = {
  group?: string;
  siblings?: { group?: string }[];
};

@Injectable()
export class DeletePostTool implements AgentToolInterface {
  constructor(
    private _postsService: PostsService,
    private _entitlements: EntitlementService
  ) {}
  name = 'delete_post';

  run() {
    return createTool({
      id: 'delete_post',
      description: `Delete a post or a whole post group the same way as the Schedule calendar. Pass the post id or its group. That deletes the channel group: the post and its comments. Pass allChannels true to also delete the other channels created with it, the same as Delete from all channels. Confirm with the user before calling. The call is refused unless confirm is true.`,
      inputSchema: z.object({
        id: z
          .string()
          .optional()
          .describe('The post id from postsListTool. Deletes that post group'),
        group: z
          .string()
          .optional()
          .describe('The post group. Deletes that channel post and its comments'),
        allChannels: z
          .boolean()
          .optional()
          .describe(
            'Also delete the other channels created with this post. Omit to delete only this group'
          ),
        confirm: z
          .literal(true)
          .describe(
            'Must be true. Confirm with the user before calling. The call is refused when this is missing or not true'
          ),
      }),
      outputSchema: z.object({
        output: z.any(),
      }),
      mcp: {
        annotations: {
          title: 'Delete Post',
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      execute: async (inputData, context) => {
        try {
          if (inputData.confirm !== true) {
            return { output: { error: confirmMessage } };
          }
          const org = organizationFromTool(inputData, context);
          await this._entitlements.assertPostsThisPeriod(org.id);
          const groups = await this.groupsToDelete(
            org.id,
            inputData.id,
            inputData.group,
            !!inputData.allChannels
          );
          for (const group of groups) {
            await this._postsService.deletePost(org.id, group);
          }
          return { output: { deleted: true, groups } };
        } catch (err) {
          const failure = toolFailure(err);
          if (failure) return failure;
          throw err;
        }
      },
    });
  }

  private async groupsToDelete(
    orgId: string,
    id: string | undefined,
    group: string | undefined,
    allChannels: boolean
  ) {
    let resolved = group;
    if (id) {
      const ordered = await this._postsService.getPostsRecursively(
        id,
        false,
        orgId,
        true
      );
      const root = ordered[0] as { group?: string } | undefined;
      if (!root?.group) {
        throw new BadRequestException('Post not found');
      }
      resolved = root.group;
    }
    if (!resolved) {
      throw new BadRequestException('Pass the post id or the group');
    }
    if (!allChannels) {
      if (!id) {
        await this._postsService.getPostsByGroup(orgId, resolved);
      }
      return [resolved];
    }
    const loaded = (await this._postsService.getPostsByGroup(
      orgId,
      resolved
    )) as LoadedGroup;
    const siblings = (loaded.siblings || [])
      .map((item) => item.group)
      .filter((item): item is string => !!item && item !== (loaded.group || resolved));
    return [loaded.group || resolved, ...siblings];
  }
}
