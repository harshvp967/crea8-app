import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { OAuthService } from '@gitroom/nestjs-libraries/database/prisma/oauth/oauth.service';
import { UsersService } from '@gitroom/nestjs-libraries/database/prisma/users/users.service';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import {
  organizationFromTool,
  toolFailure,
} from '@gitroom/nestjs-libraries/chat/auth.context';
import { accountActor } from '@gitroom/nestjs-libraries/chat/tools/account.actor';

const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

type ApprovedRow = {
  id: string;
  createdAt?: Date | string;
  accessToken?: string | null;
  authorizationCode?: string | null;
  codeChallenge?: string | null;
  oauthApp?: {
    id?: string;
    name?: string;
    description?: string | null;
    clientId?: string;
    clientSecret?: string | null;
    picture?: { id?: string; path?: string } | null;
  } | null;
};

// The Approved Apps screen shows the name, description, picture, and date.
function publicApprovedApp(row: ApprovedRow) {
  const picture = row.oauthApp?.picture?.path
    ? { id: row.oauthApp.picture.id, path: row.oauthApp.picture.path }
    : null;
  return {
    id: row.id,
    createdAt: row.createdAt,
    name: row.oauthApp?.name || null,
    description: row.oauthApp?.description || null,
    picture,
  };
}

@Injectable()
export class ApprovedAppsTool implements AgentToolInterface {
  constructor(
    private _oauth: OAuthService,
    private _users: UsersService,
    private _organizations: OrganizationService
  ) {}
  name = 'approvedAppsTool';

  run() {
    return createTool({
      id: 'approvedAppsTool',
      description: `List apps this user has approved, or revoke one. action "list" matches GET /user/approved-apps. action "revoke" matches DELETE /user/approved-apps/:id and takes that authorization id. Does not return a client secret, access token, or API key, and does not create an OAuth client. An API key acts as the workspace owner. Confirm with the user before revoke.`,
      inputSchema: z.object({
        action: z.enum(['list', 'revoke']),
        id: z
          .string()
          .optional()
          .describe('Approved-app authorization id. Required for revoke'),
      }),
      outputSchema: z.object({
        output: z.any(),
      }),
      mcp: {
        annotations: {
          title: 'Approved Apps',
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
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
          if (inputData.action === 'list') {
            const rows = await this._oauth.getApprovedApps(actor.user.id);
            return {
              output: plain(
                (rows as ApprovedRow[]).map((row) => publicApprovedApp(row))
              ),
            };
          }
          if (!inputData.id) {
            return { output: { error: 'id is required' } };
          }
          return {
            output: plain(
              await this._oauth.revokeApp(actor.user.id, inputData.id)
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
