import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { HttpException, Injectable } from '@nestjs/common';
import { isEmail } from 'class-validator';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { UsersService } from '@gitroom/nestjs-libraries/database/prisma/users/users.service';
import { EntitlementService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/entitlement.service';
import {
  organizationFromTool,
  toolFailure,
} from '@gitroom/nestjs-libraries/chat/auth.context';
import {
  accountActor,
  assertWorkspaceAdmin,
} from '@gitroom/nestjs-libraries/chat/tools/account.actor';

const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

@Injectable()
export class TeamMembersTool implements AgentToolInterface {
  constructor(
    private _organizations: OrganizationService,
    private _users: UsersService,
    private _entitlements: EntitlementService
  ) {}
  name = 'teamMembersTool';

  run() {
    return createTool({
      id: 'teamMembersTool',
      description: `Manage workspace members, the same records as the Workspace team block. action "list" returns members and pending invites. "invite" sends or returns an invite (email, role USER or ADMIN, sendEmail). "resend" emails an invite id again. "link" returns a fresh invite link. "cancel" revokes an invite id. "role" changes a member user id to USER or ADMIN. "remove" removes a member user id. A workspace whose plan does not include team members is refused with that plan limit. Only an admin or the workspace owner can do this. An API key acts as the workspace owner. Confirm with the user before invite, resend, link, cancel, role, or remove.`,
      inputSchema: z.object({
        action: z.enum([
          'list',
          'invite',
          'resend',
          'link',
          'cancel',
          'role',
          'remove',
        ]),
        id: z
          .string()
          .optional()
          .describe('Invite id for resend, link, and cancel. Member user id for role and remove'),
        email: z.string().optional().describe('Email to invite'),
        role: z.enum(['USER', 'ADMIN']).optional(),
        sendEmail: z
          .boolean()
          .optional()
          .describe('Invite emails the link when true. Defaults to true'),
      }),
      outputSchema: z.object({
        output: z.any(),
      }),
      mcp: {
        annotations: {
          title: 'Workspace Members',
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      execute: async (inputData, context) => {
        try {
          const org = organizationFromTool(inputData, context);
          await this.assertTeam(org.id);
          const actor = await accountActor(
            this._users,
            this._organizations,
            org
          );
          assertWorkspaceAdmin(actor);
          if (inputData.action === 'list') {
            const [team, invites] = await Promise.all([
              this._organizations.getTeam(org.id),
              this._organizations.listPendingInvites(org.id),
            ]);
            return {
              output: plain({
                users: team?.users || [],
                invites,
              }),
            };
          }
          if (inputData.action === 'invite') {
            if (!inputData.email || !inputData.role) {
              return { output: { error: 'email and role are required' } };
            }
            if (!isEmail(inputData.email)) {
              return { output: { error: 'email must be an email' } };
            }
            return {
              output: plain(
                await this._organizations.inviteTeamMember(
                  actor.organization,
                  actor.user,
                  {
                    email: inputData.email,
                    role: inputData.role,
                    sendEmail: inputData.sendEmail ?? true,
                  }
                )
              ),
            };
          }
          if (!inputData.id) {
            return { output: { error: 'id is required' } };
          }
          if (inputData.action === 'resend') {
            return {
              output: plain(
                await this._organizations.resendInvite(
                  actor.organization,
                  actor.user,
                  inputData.id
                )
              ),
            };
          }
          if (inputData.action === 'link') {
            return {
              output: plain(
                await this._organizations.copyInviteLink(org.id, inputData.id)
              ),
            };
          }
          if (inputData.action === 'cancel') {
            return {
              output: plain(
                await this._organizations.revokeInvite(org.id, inputData.id)
              ),
            };
          }
          if (inputData.action === 'role') {
            if (!inputData.role) {
              return { output: { error: 'role is required' } };
            }
            return {
              output: plain(
                await this._organizations.updateTeamMemberRole(
                  actor.organization,
                  inputData.id,
                  inputData.role
                )
              ),
            };
          }
          return {
            output: plain(
              await this._organizations.deleteTeamMember(
                actor.organization,
                inputData.id
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

  // tier.team_members is the Workspace team block. assertCanAddMember is the
  // invite cap the settings route already calls. Neither rule is reimplemented.
  private async assertTeam(orgId: string) {
    const limits = await this._entitlements.limits(orgId);
    if (limits && !limits.pricing.team_members) {
      throw new HttpException(
        {
          message: `${limits.plan.displayName} includes ${limits.plan.teamMemberLimit} team member. Upgrade to invite more.`,
          upgrade: true,
        },
        402
      );
    }
    await this._entitlements.assertCanAddMember(orgId);
  }
}
