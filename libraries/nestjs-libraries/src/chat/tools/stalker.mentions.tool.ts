import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  organizationFromTool,
  toolFailure,
} from '@gitroom/nestjs-libraries/chat/auth.context';
import {
  isStalkerEnabled,
  StalkerService,
} from '@gitroom/nestjs-libraries/database/prisma/stalker/stalker.service';

@Injectable()
export class StalkerMentionsTool implements AgentToolInterface {
  constructor(private _stalkerService: StalkerService) {}
  name = 'stalkerMentionsTool';
  available() {
    return isStalkerEnabled();
  }

  run() {
    return createTool({
      id: 'stalkerMentionsTool',
      description: `Read Stalker mentions for one project. Get the project id from stalkerProjectsTool. Returns the newest mentions first, with a nextCursor when more remain. Off-topic mentions stay hidden unless offTopic is "include".`,
      inputSchema: z.object({
        projectId: z.string().describe('Stalker project id'),
        date: z.enum(['24h', '7d', '30d', 'all']).optional(),
        source: z.string().optional().describe('youtube, reddit, x, linkedin, or a comma-separated list'),
        q: z.string().optional().describe('Search text or author'),
        status: z.enum(['NEW', 'REPLIED', 'IGNORED', 'DONE', 'FOLLOW_UP']).optional(),
        sentiment: z.string().optional(),
        keywordId: z.string().optional(),
        cursor: z.string().optional(),
        take: z.number().int().min(1).max(50).optional(),
        offTopic: z.enum(['include']).optional(),
      }),
      outputSchema: z.object({
        output: z.any(),
      }),
      mcp: {
        annotations: {
          title: 'Read Stalker Mentions',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      execute: async (inputData, context) => {
        try {
          const org = organizationFromTool(inputData, context);
          const page = await this._stalkerService.mentions(org.id, {
            projectId: inputData.projectId,
            date: inputData.date,
            source: inputData.source,
            q: inputData.q,
            status: inputData.status,
            sentiment: inputData.sentiment,
            keywordId: inputData.keywordId,
            cursor: inputData.cursor,
            take: inputData.take,
            offTopic: inputData.offTopic,
          });
          return {
            output: {
              nextCursor: page.nextCursor,
              hiddenOffTopic: page.hiddenOffTopic,
              mentions: page.mentions.map((row) => ({
                id: row.id,
                createdAt: row.createdAt.toISOString(),
                source: row.source,
                authorName: row.authorName,
                authorHandle: row.authorHandle,
                text: (row.text || '').slice(0, 500),
                url: row.url || '',
                sentiment: row.sentiment,
                status: row.status,
                category: row.categoryDef?.name || row.category || '',
                keyword: row.keyword?.phrase || '',
                matchKind: row.matchKind || '',
                matchLabel: row.matchLabel || '',
              })),
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
