import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Organization } from '@prisma/client';
import { IdeaPostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/idea.posts.service';
import {
  organizationFromTool,
  toolFailure,
} from '@gitroom/nestjs-libraries/chat/auth.context';

@Injectable()
export class GeneratePostsTool implements AgentToolInterface {
  constructor(private _ideaPosts: IdeaPostsService) {}
  name = 'generatePostsTool';

  run() {
    return createTool({
      id: 'generatePostsTool',
      description: `Turn one idea into a draft for every connected channel, the same generation as Schedule "One idea, every platform".
Pass format and voice when the user names them. format defaults to short: short is one short post, long is one long post, thread_short is a thread of short posts, thread_long is a thread of long posts. A channel that supports threads gets several posts for a thread format. Any other channel gets one post inside its character limit.
voice defaults to personal. Personal uses "I am happy to announce". Company uses "We are happy to announce".
This uses the same credit and plan check as the Schedule panel and does not add a charge. It does not schedule, publish, attach media, or generate an image. The result field voice is true only when a saved brand voice was applied.`,
      inputSchema: z.object({
        idea: z.string().min(3).max(4000).describe('The idea, or a link to turn into drafts'),
        customer: z
          .string()
          .max(80)
          .optional()
          .describe('Limit the drafts to one customer group id. Omit for every connected channel'),
        format: z
          .enum(['short', 'long', 'thread_short', 'thread_long'])
          .optional()
          .describe(
            'Default short. short is one short post, long is one long post, thread_short is a thread of short posts, thread_long is a thread of long posts'
          ),
        voice: z
          .enum(['personal', 'company'])
          .optional()
          .describe(
            'Default personal. Personal uses "I am happy to announce". Company uses "We are happy to announce"'
          ),
      }),
      outputSchema: z.object({
        voice: z.boolean().optional(),
        error: z.string().optional(),
        drafts: z
          .array(
            z.object({
              integrationId: z.string(),
              provider: z.string(),
              name: z.string(),
              picture: z.string().nullable().optional(),
              content: z.string(),
              posts: z.array(z.string()),
              publishAt: z.string(),
              settings: z.record(z.string(), z.any()),
              maxLength: z.number(),
            })
          )
          .optional(),
      }),
      execute: async (inputData, context) => {
        const org = organizationFromTool(inputData, context);
        try {
          const result = await this._ideaPosts.generate(
            { id: org.id } as Organization,
            {
              idea: inputData.idea,
              ...(inputData.customer ? { customer: inputData.customer } : {}),
              ...(inputData.format ? { format: inputData.format } : {}),
              ...(inputData.voice ? { voice: inputData.voice } : {}),
            }
          );
          if (result.error) {
            return {
              ...(result.voice === undefined ? {} : { voice: result.voice }),
              error: result.error,
            };
          }
          return {
            voice: !!result.voice,
            drafts: (result.drafts || []).map((draft) => ({
              integrationId: draft.integrationId,
              provider: draft.provider,
              name: draft.name,
              picture: draft.picture || null,
              content: draft.content,
              posts: draft.posts,
              publishAt: draft.publishAt,
              settings: draft.settings || {},
              maxLength: draft.maxLength,
            })),
          };
        } catch (err) {
          const failure = toolFailure(err);
          if (failure) {
            return { error: failure.output.error };
          }
          throw err;
        }
      },
    });
  }
}
