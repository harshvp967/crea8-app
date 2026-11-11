import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import {
  organizationFromTool,
  toolFailure,
} from '@gitroom/nestjs-libraries/chat/auth.context';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

@Injectable()
export class PostDateTool implements AgentToolInterface {
  constructor(private _postsService: PostsService) {}
  name = 'postDateTool';

  run() {
    return createTool({
      id: 'postDateTool',
      description: `Move a post on the calendar. Calls the same date change as PUT /posts/:id/date with action "update" and republish left off, so the publish time changes and a published post is not requeued. Find the post with postsListTool and pass its id. date is UTC, for example 2026-12-01T15:00:00. Confirm with the user before moving a post.`,
      inputSchema: z.object({
        id: z.string().describe('The post id'),
        date: z
          .string()
          .describe('New publish time in UTC, for example 2026-12-01T15:00:00'),
      }),
      outputSchema: z.object({
        output: z.any(),
      }),
      mcp: {
        annotations: {
          title: 'Move Post',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      execute: async (inputData, context) => {
        try {
          const org = organizationFromTool(inputData, context);
          const saved = await this._postsService.changeDate(
            org.id,
            inputData.id,
            inputData.date,
            'update',
            false
          );
          return {
            output: {
              id: saved?.id || inputData.id,
              publishDate: dayjs(saved?.publishDate || inputData.date)
                .utc()
                .format('YYYY-MM-DDTHH:mm:ss'),
              state: saved?.state,
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
