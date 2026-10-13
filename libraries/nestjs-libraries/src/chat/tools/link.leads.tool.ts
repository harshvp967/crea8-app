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
export class LinkLeadsTool implements AgentToolInterface {
  constructor(private _linkService: LinkService) {}
  name = 'linkLeadsTool';

  run() {
    return createTool({
      id: 'linkLeadsTool',
      description: `Read Link-in-Bio leads captured from the page. status filters to CONFIRMED or PENDING. q searches name and email.`,
      inputSchema: z.object({
        status: z.enum(['CONFIRMED', 'PENDING', '']).optional(),
        q: z.string().optional(),
      }),
      outputSchema: z.object({
        output: z.any(),
      }),
      mcp: {
        annotations: {
          title: 'Link-in-Bio Leads',
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
              await this._linkService.leads(org, inputData.status || '', inputData.q || '')
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