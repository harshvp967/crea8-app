import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  organizationFromTool,
  toolFailure,
} from '@gitroom/nestjs-libraries/chat/auth.context';
import { LinkService } from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.service';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';

const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

@Injectable()
export class LinkLeadsTool implements AgentToolInterface {
  constructor(
    private _linkService: LinkService,
    private _organizationService: OrganizationService
  ) {}
  name = 'linkLeadsTool';

  run() {
    return createTool({
      id: 'linkLeadsTool',
      description: `Read Link-in-Bio leads, or delete one lead. action "read" lists them. status filters to CONFIRMED or PENDING. q searches name and email. action "delete" removes one lead id through the same owner check as the leads screen. Only the workspace owner can delete a lead. This does not delete the page. Confirm with the user before delete.`,
      inputSchema: z.object({
        action: z.enum(['read', 'delete']).optional().describe('Defaults to read'),
        status: z.enum(['CONFIRMED', 'PENDING', '']).optional(),
        q: z.string().optional(),
        id: z.string().optional().describe('Lead id, required for delete'),
      }),
      outputSchema: z.object({
        output: z.any(),
      }),
      mcp: {
        annotations: {
          title: 'Link-in-Bio Leads',
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      execute: async (inputData, context) => {
        try {
          const org = organizationFromTool(inputData, context);
          if (inputData.action === 'delete') {
            if (!inputData.id) {
              return { output: { error: 'id is required' } };
            }
            const removed = await this._linkService.deleteLead(
              org.id,
              await this.actingUser(org),
              inputData.id
            );
            return { output: plain(removed) };
          }
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

  // OAuth carries the signed-in user. An API key is the workspace credential,
  // so the owner check runs as the workspace owner. The service still refuses
  // anyone who is not that owner.
  private async actingUser(org: { id: string; userId?: string }) {
    if (org.userId) {
      return org.userId;
    }
    const team = await this._organizationService.getTeam(org.id);
    const owner = team?.users.find((member) => member.role === 'SUPERADMIN');
    return owner?.user.id || '';
  }
}