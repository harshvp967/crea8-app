import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { UsersService } from '@gitroom/nestjs-libraries/database/prisma/users/users.service';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import {
  organizationFromTool,
  toolFailure,
} from '@gitroom/nestjs-libraries/chat/auth.context';
import { accountActor } from '@gitroom/nestjs-libraries/chat/tools/account.actor';

const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

@Injectable()
export class EmailNotificationsTool implements AgentToolInterface {
  constructor(
    private _users: UsersService,
    private _organizations: OrganizationService
  ) {}
  name = 'emailNotificationsTool';

  run() {
    return createTool({
      id: 'emailNotificationsTool',
      description: `Read or update email notification toggles, the same fields as the Notifications tab. action "read" returns sendSuccessEmails, sendFailureEmails, and sendStreakEmails. action "update" sets all three through POST /user/email-notifications. An API key acts as the workspace owner. Confirm with the user before update.`,
      inputSchema: z.object({
        action: z.enum(['read', 'update']),
        sendSuccessEmails: z.boolean().optional(),
        sendFailureEmails: z.boolean().optional(),
        sendStreakEmails: z.boolean().optional(),
      }),
      outputSchema: z.object({
        output: z.any(),
      }),
      mcp: {
        annotations: {
          title: 'Email Notifications',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      execute: async (inputData, context) => {
        try {
          const org = organizationFromTool(inputData, context);
          const actor = await accountActor(
            this._users,
            this._organizations,
            org
          );
          if (inputData.action === 'update') {
            if (
              inputData.sendSuccessEmails == null ||
              inputData.sendFailureEmails == null ||
              inputData.sendStreakEmails == null
            ) {
              return {
                output: {
                  error:
                    'sendSuccessEmails, sendFailureEmails, and sendStreakEmails are required',
                },
              };
            }
            await this._users.updateEmailNotifications(actor.user.id, {
              sendSuccessEmails: inputData.sendSuccessEmails,
              sendFailureEmails: inputData.sendFailureEmails,
              sendStreakEmails: inputData.sendStreakEmails,
            });
          }
          return {
            output: plain(
              await this._users.getEmailNotifications(actor.user.id)
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
