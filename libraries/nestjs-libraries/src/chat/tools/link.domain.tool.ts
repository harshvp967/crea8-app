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
export class LinkDomainTool implements AgentToolInterface {
  constructor(private _linkService: LinkService) {}
  name = 'linkDomainTool';

  run() {
    return createTool({
      id: 'linkDomainTool',
      description: `Connect, check, or remove the Link-in-Bio custom domain, the same calls as the settings screen. action "connect" saves a domain and returns its status and DNS records. "check" refreshes that status. "remove" disconnects it. A page without the custom-domain add-on is refused with the same payment-required error as the screen. Confirm with the user before connect or remove.`,
      inputSchema: z.object({
        action: z.enum(['connect', 'check', 'remove']),
        domain: z
          .string()
          .optional()
          .describe('Hostname to connect, such as links.example.com. Required for connect'),
      }),
      outputSchema: z.object({
        output: z.any(),
      }),
      mcp: {
        annotations: {
          title: 'Link-in-Bio Domain',
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      execute: async (inputData, context) => {
        try {
          const org = organizationFromTool(inputData, context);
          if (inputData.action === 'connect') {
            if (!inputData.domain?.trim()) {
              return { output: { error: 'domain is required' } };
            }
            return {
              output: plain(await this._linkService.connectDomain(org, inputData.domain)),
            };
          }
          if (inputData.action === 'check') {
            return { output: plain(await this._linkService.checkDomain(org)) };
          }
          return { output: plain(await this._linkService.removeDomain(org)) };
        } catch (err) {
          const failure = toolFailure(err);
          if (failure) return failure;
          throw err;
        }
      },
    });
  }
}
