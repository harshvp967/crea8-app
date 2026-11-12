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
import { EntitlementService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/entitlement.service';

const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

@Injectable()
export class StalkerAnalyticsTool implements AgentToolInterface {
  constructor(
    private _stalkerService: StalkerService,
    private _entitlements: EntitlementService
  ) {}
  name = 'stalkerAnalyticsTool';
  available() {
    return isStalkerEnabled();
  }

  run() {
    return createTool({
      id: 'stalkerAnalyticsTool',
      description: `Read Stalker analytics for one project. Same payload as GET /stalker/analytics and the analytics screen: series, totals, and accounts. Get the project id from stalkerProjectsTool. date defaults to 30d. Pass start and end as YYYY-MM-DD, plus tz, to use the same calendar window as the screen. group is brand, competitors, or compare. This is Stalker's own analytics, not provider insights.`,
      inputSchema: z.object({
        projectId: z.string().describe('Stalker project id'),
        date: z.enum(['24h', '7d', '30d', 'all']).optional().describe('Defaults to 30d'),
        start: z.string().optional().describe('YYYY-MM-DD, the screen calendar start'),
        end: z.string().optional().describe('YYYY-MM-DD, the screen calendar end'),
        tz: z.number().int().min(-840).max(840).optional(),
        source: z.string().optional(),
        engagement: z.string().optional(),
        from: z.string().optional(),
        keywordId: z.string().optional(),
        categoryId: z.string().optional(),
        sentiment: z.string().optional(),
        status: z.enum(['NEW', 'REPLIED', 'IGNORED', 'DONE', 'FOLLOW_UP']).optional(),
        group: z.enum(['brand', 'competitors', 'compare']).optional(),
      }),
      outputSchema: z.object({
        output: z.any(),
      }),
      mcp: {
        annotations: {
          title: 'Stalker Analytics',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      execute: async (inputData, context) => {
        try {
          const org = organizationFromTool(inputData, context);
          await this._entitlements.assertCanUseStalker(org.id);
          const date = inputData.date || '30d';
          await this._stalkerService.assertMentionHistory(org.id, {
            date,
            start: inputData.start,
            surface: 'analytics',
          });
          const query = {
            projectId: inputData.projectId,
            date,
            start: inputData.start,
            end: inputData.end,
            tz: inputData.tz,
            source: inputData.source,
            engagement: inputData.engagement,
            from: inputData.from,
            keywordId: inputData.keywordId,
            categoryId: inputData.categoryId,
            sentiment: inputData.sentiment,
            status: inputData.status,
            group: inputData.group,
          };
          return {
            output: plain(
              await this._stalkerService.analytics(org.id, inputData.projectId, date, query)
            ),
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
