import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  organizationFromTool,
  toolFailure,
} from '@gitroom/nestjs-libraries/chat/auth.context';
import { LinkService } from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.service';

const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

@Injectable()
export class LinkAnalyticsTool implements AgentToolInterface {
  constructor(private _linkService: LinkService) {}
  name = 'linkAnalyticsTool';

  run() {
    return createTool({
      id: 'linkAnalyticsTool',
      description: `Read Link-in-Bio analytics, or export the CSV the analytics screen downloads. range is 7d, 28d, 30d, 90d, 365d, or 12m. Optional from and to are YYYY-MM-DD for a custom window. format "csv" returns the same file as GET /link-in-bio/analytics.csv for that range. A free page is refused the export. Omit format to read the analytics.`,
      inputSchema: z.object({
        range: z.enum(['7d', '28d', '30d', '90d', '365d', '12m']).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        format: z
          .enum(['json', 'csv'])
          .optional()
          .describe('csv is the screen download. Omit it, or pass json, to read analytics'),
      }),
      outputSchema: z.object({
        output: z.any(),
      }),
      mcp: {
        annotations: {
          title: 'Link-in-Bio Analytics',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      execute: async (inputData, context) => {
        try {
          const org = organizationFromTool(inputData, context);
          const range = inputData.range || '30d';
          const from = inputData.from || '';
          const to = inputData.to || '';
          if (inputData.format === 'csv') {
            const csv = await this._linkService.exportAnalytics(org, range, from, to);
            return { output: { csv, filename: 'crea8-analytics.csv' } };
          }
          return {
            output: plain(await this._linkService.analytics(org, range, from, to)),
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
