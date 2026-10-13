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
      description: `Read Link-in-Bio analytics. range is 7d, 28d, 30d, 90d, 365d, or 12m. Optional from and to are YYYY-MM-DD for a custom window.`,
      inputSchema: z.object({
        range: z.enum(['7d', '28d', '30d', '90d', '365d', '12m']).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
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
          return {
            output: plain(
              await this._linkService.analytics(
                org,
                inputData.range || '30d',
                inputData.from || '',
                inputData.to || ''
              )
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
