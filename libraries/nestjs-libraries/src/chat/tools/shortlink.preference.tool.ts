import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { ShortLinkPreference } from '@prisma/client';
import {
  organizationFromTool,
  toolFailure,
} from '@gitroom/nestjs-libraries/chat/auth.context';

const preferences = {
  ask: ShortLinkPreference.ASK,
  always: ShortLinkPreference.YES,
  never: ShortLinkPreference.NO,
  ASK: ShortLinkPreference.ASK,
  YES: ShortLinkPreference.YES,
  NO: ShortLinkPreference.NO,
} as const;

@Injectable()
export class ShortlinkPreferenceTool implements AgentToolInterface {
  constructor(private _organizationService: OrganizationService) {}
  name = 'shortlinkPreferenceTool';

  run() {
    return createTool({
      id: 'shortlinkPreferenceTool',
      description: `Read or update the workspace shortlink preference, the same value as GET and POST /settings/shortlink. action "read" returns ask (ASK), always (YES), or never (NO). action "update" sets it. This does not change the per-post shortLink flag on integrationSchedulePostTool. Confirm with the user before update.`,
      inputSchema: z.object({
        action: z.enum(['read', 'update']),
        preference: z
          .enum(['ask', 'always', 'never', 'ASK', 'YES', 'NO'])
          .optional()
          .describe('ask, always, or never. Required for update'),
      }),
      outputSchema: z.object({
        output: z.any(),
      }),
      mcp: {
        annotations: {
          title: 'Shortlink Preference',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      execute: async (inputData, context) => {
        try {
          const org = organizationFromTool(inputData, context);
          if (inputData.action === 'update') {
            if (!inputData.preference) {
              return { output: { error: 'preference is required' } };
            }
            const preference = inputData.preference as keyof typeof preferences;
            await this._organizationService.updateShortlinkPreference(
              org.id,
              preferences[preference]
            );
          }
          const saved = await this._organizationService.getShortlinkPreference(
            org.id
          );
          return {
            output: saved?.shortlink ? { shortlink: saved.shortlink } : saved,
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
