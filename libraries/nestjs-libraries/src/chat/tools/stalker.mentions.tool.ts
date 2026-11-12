import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import { StalkerMentionStatus } from '@prisma/client';
import { z } from 'zod';
import {
  organizationFromTool,
  toolFailure,
} from '@gitroom/nestjs-libraries/chat/auth.context';
import {
  isStalkerEnabled,
  StalkerService,
} from '@gitroom/nestjs-libraries/database/prisma/stalker/stalker.service';
import { EntitlementService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/entitlement.service';

const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

const mentionStatus = z.enum(['NEW', 'REPLIED', 'IGNORED', 'DONE', 'FOLLOW_UP']);

const viewFilters = z.object({
  date: z.enum(['24h', '7d', '30d', 'all']).optional(),
  source: z.string().optional(),
  sources: z.string().optional(),
  from: z.string().optional(),
  keywordId: z.string().optional(),
  categoryId: z.string().optional(),
  sentiment: z.string().optional(),
  status: z.enum(['NEW', 'REPLIED', 'IGNORED', 'DONE', 'FOLLOW_UP', '']).optional(),
  q: z.string().optional(),
  match: z.enum(['BRAND', 'ALIAS', 'HANDLE', 'KEYWORD']).optional(),
  offTopic: z.enum(['include', '']).optional(),
  preset: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  engagement: z.string().optional(),
  tz: z.string().optional(),
});

const viewOutput = (row: any) => ({
  id: row.id,
  name: row.name,
  filters: row.filters || {},
});

@Injectable()
export class StalkerMentionsTool implements AgentToolInterface {
  constructor(
    private _stalkerService: StalkerService,
    private _entitlements: EntitlementService
  ) {}
  name = 'stalkerMentionsTool';
  available() {
    return isStalkerEnabled();
  }

  run() {
    return createTool({
      id: 'stalkerMentionsTool',
      description: `Read and update Stalker mentions for one project. Get the project id from stalkerProjectsTool. action "list" (the default) returns the newest mentions first, with a nextCursor when more remain. Off-topic and ignored mentions stay hidden unless offTopic is "include", the same default as the mentions screen. "status" sets NEW, REPLIED, IGNORED, DONE, or FOLLOW_UP on a mention id. "relevant" sets relevant true or false; false marks it ignored and hides it from the default list. "delete" removes a mention id. "views" lists saved filter views. "saveView" stores a name and filters. "deleteView" removes a saved view id. This tool does not reply. Confirm with the user before status, relevant, delete, saveView, or deleteView.`,
      inputSchema: z.object({
        action: z
          .enum(['list', 'status', 'relevant', 'delete', 'views', 'saveView', 'deleteView'])
          .optional()
          .describe('Defaults to list. There is no reply action'),
        projectId: z.string().optional().describe('Required for list, views, and saveView'),
        id: z
          .string()
          .optional()
          .describe('Mention id for status, relevant, and delete. View id for deleteView'),
        date: z.enum(['24h', '7d', '30d', 'all']).optional(),
        start: z.string().optional().describe('YYYY-MM-DD. A start older than the plan history is refused'),
        end: z.string().optional(),
        source: z.string().optional().describe('youtube, reddit, x, linkedin, or a comma-separated list'),
        q: z.string().optional().describe('Search text or author'),
        status: mentionStatus
          .optional()
          .describe('List filter, or the status to set when action is status'),
        sentiment: z.string().optional(),
        keywordId: z.string().optional(),
        cursor: z.string().optional(),
        take: z.number().int().min(1).max(50).optional(),
        offTopic: z.enum(['include']).optional(),
        relevant: z
          .boolean()
          .optional()
          .describe('Required for action relevant. false marks the mention ignored'),
        name: z.string().optional().describe('Saved view name, required for saveView'),
        filters: viewFilters.optional().describe('Saved view filters, required for saveView'),
      }),
      outputSchema: z.object({
        output: z.any(),
      }),
      mcp: {
        annotations: {
          title: 'Stalker Mentions',
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      execute: async (inputData, context) => {
        try {
          const org = organizationFromTool(inputData, context);
          await this._entitlements.assertCanUseStalker(org.id);
          const action = inputData.action || 'list';
          if (action === 'list') {
            if (!inputData.projectId) {
              return { output: { error: 'projectId is required' } };
            }
            if (inputData.date || inputData.start) {
              await this._stalkerService.assertMentionHistory(org.id, {
                date: inputData.date,
                start: inputData.start,
                surface: 'mentions',
              });
            }
            const page = await this._stalkerService.mentions(org.id, {
              projectId: inputData.projectId,
              date: inputData.date,
              start: inputData.start,
              end: inputData.end,
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
          }
          if (action === 'views') {
            if (!inputData.projectId) {
              return { output: { error: 'projectId is required' } };
            }
            const rows = await this._stalkerService.views(org.id, inputData.projectId);
            return { output: { views: plain(rows).map(viewOutput) } };
          }
          if (action === 'saveView') {
            if (!inputData.projectId || !inputData.name) {
              return { output: { error: 'projectId and name are required' } };
            }
            if (!inputData.filters) {
              return { output: { error: 'filters are required' } };
            }
            const saved = await this._stalkerService.createView(org.id, {
              projectId: inputData.projectId,
              name: inputData.name,
              filters: inputData.filters,
            });
            return { output: viewOutput(saved) };
          }
          if (!inputData.id) {
            return { output: { error: 'id is required' } };
          }
          if (action === 'status') {
            if (!inputData.status) {
              return { output: { error: 'status is required' } };
            }
            return {
              output: await this._stalkerService.setMentionStatus(
                org.id,
                inputData.id,
                inputData.status as StalkerMentionStatus
              ),
            };
          }
          if (action === 'relevant') {
            if (typeof inputData.relevant !== 'boolean') {
              return { output: { error: 'relevant is required' } };
            }
            return {
              output: await this._stalkerService.setMentionRelevant(
                org.id,
                inputData.id,
                inputData.relevant
              ),
            };
          }
          if (action === 'deleteView') {
            return { output: await this._stalkerService.deleteView(org.id, inputData.id) };
          }
          return { output: await this._stalkerService.deleteMention(org.id, inputData.id) };
        } catch (err) {
          const failure = toolFailure(err);
          if (failure) return failure;
          throw err;
        }
      },
    });
  }
}
