import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { HttpException, Injectable } from '@nestjs/common';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { UsersService } from '@gitroom/nestjs-libraries/database/prisma/users/users.service';
import {
  organizationFromTool,
  toolFailure,
} from '@gitroom/nestjs-libraries/chat/auth.context';
import { accountActor } from '@gitroom/nestjs-libraries/chat/tools/account.actor';

const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

@Injectable()
export class WorkspaceProfileTool implements AgentToolInterface {
  constructor(
    private _organizations: OrganizationService,
    private _users: UsersService
  ) {}
  name = 'workspaceProfileTool';

  run() {
    return createTool({
      id: 'workspaceProfileTool',
      description: `Read or update the signed-in profile and the workspace name. action "read" returns name, bio, and picture, plus the workspace name. "update" saves fullname, bio, and picture through the same path as POST /user/personal. Pass picture as { id } from the media library, or null to clear it. Omit picture to leave it. "rename" sets the workspace name through PUT /user/workspace. Only the workspace owner can rename; anyone else is refused. An API key acts as the workspace owner. This does not change a password, log anyone out, or delete an account. Confirm with the user before update or rename.`,
      inputSchema: z.object({
        action: z.enum(['read', 'update', 'rename']),
        fullname: z
          .string()
          .optional()
          .describe('Profile name, at least 3 characters. Required for update'),
        bio: z.string().optional(),
        picture: z
          .object({
            id: z.string(),
            path: z.string().optional(),
          })
          .nullable()
          .optional()
          .describe('Media id to use as the picture. Null clears it'),
        name: z
          .string()
          .optional()
          .describe('New workspace name. Required for rename'),
      }),
      outputSchema: z.object({
        output: z.any(),
      }),
      mcp: {
        annotations: {
          title: 'Workspace and Profile',
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
          if (inputData.action === 'rename') {
            const name = (inputData.name || '').trim();
            if (!name) {
              throw new HttpException('Enter a workspace name', 400);
            }
            return {
              output: plain(
                await this._organizations.renameWorkspace(
                  org.id,
                  actor.user.id,
                  name
                )
              ),
            };
          }
          if (inputData.action === 'read') {
            const [profile, overview] = await Promise.all([
              this._users.getPersonal(actor.user.id),
              this._organizations.getAccountOverview(org.id),
            ]);
            return {
              output: plain({
                profile,
                workspace: {
                  id: org.id,
                  name: overview?.organization?.name || actor.organization.name,
                },
              }),
            };
          }
          const fullname = (inputData.fullname || '').trim();
          if (fullname.length < 3) {
            return {
              output: {
                error: 'fullname must be longer than or equal to 3 characters',
              },
            };
          }
          const current = await this._users.getPersonal(actor.user.id);
          const saved = await this._users.changePersonal(actor.user.id, {
            fullname,
            bio: inputData.bio !== undefined ? inputData.bio : current?.bio || '',
            ...(inputData.picture !== undefined
              ? { picture: inputData.picture }
              : {}),
          });
          return { output: plain(saved) };
        } catch (err) {
          const failure = toolFailure(err);
          if (failure) return failure;
          throw err;
        }
      },
    });
  }
}
