import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { UsersService } from '@gitroom/nestjs-libraries/database/prisma/users/users.service';
import { OAuthService } from '@gitroom/nestjs-libraries/database/prisma/oauth/oauth.service';
import { EntitlementService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/entitlement.service';
import { PLANS } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';
import {
  organizationFromTool,
  toolFailure,
} from '@gitroom/nestjs-libraries/chat/auth.context';
import {
  accountActor,
  assertWorkspaceAdmin,
} from '@gitroom/nestjs-libraries/chat/tools/account.actor';

const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

type StoredApp = {
  id?: string;
  name?: string;
  description?: string | null;
  redirectUrl?: string;
  clientId?: string;
  clientSecret?: string | null;
  picture?: { id?: string; path?: string } | null;
};

// GET /user/oauth-app already drops clientSecret. Pick the fields the Apps
// screen shows so a stored key or secret cannot ride along.
function publicOAuthApp(app: StoredApp | false | null | undefined) {
  if (!app) {
    return null;
  }
  return {
    id: app.id,
    name: app.name,
    description: app.description ?? null,
    redirectUrl: app.redirectUrl,
    clientId: app.clientId,
    picture: app.picture?.path
      ? { id: app.picture.id, path: app.picture.path }
      : null,
  };
}

@Injectable()
export class DeveloperTool implements AgentToolInterface {
  constructor(
    private _organizations: OrganizationService,
    private _users: UsersService,
    private _oauth: OAuthService,
    private _entitlements: EntitlementService
  ) {}
  name = 'developerTool';

  run() {
    return createTool({
      id: 'developerTool',
      description: `Read developer info for this workspace. Returns whether the plan includes the public API, whether an API key is stored, and the OAuth app's public fields (name, description, redirect URL, client id, picture). Same audience as the Developers screen: an admin or the workspace owner. An API key acts as the owner. Does not return or rotate the API key or the client secret, and does not create an OAuth app.`,
      inputSchema: z.object({}),
      outputSchema: z.object({
        output: z.any(),
      }),
      mcp: {
        annotations: {
          title: 'Developer Info',
          readOnlyHint: true,
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
          assertWorkspaceAdmin(actor);
          const [limits, stored, app] = await Promise.all([
            this._entitlements.limits(org.id),
            this._organizations.getOrgById(org.id),
            this._oauth.getApp(org.id),
          ]);
          const plan = limits?.plan || PLANS.ULTIMATE;
          const publicApi = !!plan.publicApi;
          return {
            output: plain({
              plan: plan.displayName,
              publicApi,
              hasApiKey: !!stored?.apiKey,
              oauthApp: publicOAuthApp(app as StoredApp | false),
              ...(publicApi
                ? {}
                : {
                    error: `${plan.displayName} does not include the public API.`,
                  }),
            }),
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
