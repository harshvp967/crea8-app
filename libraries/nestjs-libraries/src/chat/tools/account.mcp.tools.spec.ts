import { readFileSync } from 'fs';
import { join } from 'path';
import { HttpException } from '@nestjs/common';

jest.mock('@gitroom/nestjs-libraries/database/prisma/users/users.service', () => ({
  UsersService: class UsersService {},
}));
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service',
  () => ({
    OrganizationService: class OrganizationService {},
  })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/subscriptions/entitlement.service',
  () => ({
    EntitlementService: class EntitlementService {},
  })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/webhooks/webhooks.service',
  () => ({
    WebhooksService: class WebhooksService {},
  })
);
jest.mock('@gitroom/nestjs-libraries/database/prisma/oauth/oauth.service', () => ({
  OAuthService: class OAuthService {},
}));
jest.mock('@gitroom/nestjs-libraries/dtos/webhooks/webhook.url.validator', () => ({
  isSafePublicHttpsUrl: jest.fn(
    async (value: unknown) =>
      typeof value === 'string' && value.startsWith('https://')
  ),
}));

import { TeamMembersTool } from '@gitroom/nestjs-libraries/chat/tools/team.members.tool';
import { WorkspaceProfileTool } from '@gitroom/nestjs-libraries/chat/tools/workspace.profile.tool';
import { EmailNotificationsTool } from '@gitroom/nestjs-libraries/chat/tools/email.notifications.tool';
import { WebhooksTool } from '@gitroom/nestjs-libraries/chat/tools/webhooks.tool';
import { ApprovedAppsTool } from '@gitroom/nestjs-libraries/chat/tools/approved.apps.tool';
import { DeveloperTool } from '@gitroom/nestjs-libraries/chat/tools/developer.tool';
import { PLANS } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';
import { pricing } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';
import { webhookQuota } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';
import { webhookUpgradeMessage } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.rules';

const run = async (
  tool: { run: () => any },
  input: unknown,
  org: Record<string, unknown> = { id: 'org-1', userId: 'user-1' }
) => {
  const built = tool.run();
  const store = new Map<string, string>([['organization', JSON.stringify(org)]]);
  return built.execute(input, {
    requestContext: {
      get: (key: string) => store.get(key),
      set: (key: string, value: string) => store.set(key, value),
    },
  });
};

const refuse = (message: string, status = 402) =>
  new HttpException({ message, upgrade: true }, status);

const gate = (tier: keyof typeof PLANS) => ({
  tier,
  plan: PLANS[tier],
  pricing: pricing[tier],
});

const teamMessage = (tier: keyof typeof PLANS) =>
  `${PLANS[tier].displayName} includes ${PLANS[tier].teamMemberLimit} team member. Upgrade to invite more.`;

const userRecord = (id: string) => ({
  id,
  email: `${id}@example.com`,
  name: id,
  password: 'hashed-password',
});

const membership = (role: string) => ({
  id: 'org-1',
  name: 'Workspace',
  users: [{ role, disabled: false }],
});

describe('account MCP tools', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('registers the account tools by class with no name prefix', () => {
    const list = readFileSync(join(__dirname, 'tool.list.ts'), 'utf8');
    for (const name of [
      'TeamMembersTool',
      'WorkspaceProfileTool',
      'EmailNotificationsTool',
      'WebhooksTool',
      'ApprovedAppsTool',
      'DeveloperTool',
    ]) {
      expect(list).toContain(name);
    }
    expect(new TeamMembersTool({} as any, {} as any, {} as any).name).toBe(
      'teamMembersTool'
    );
    expect(new WorkspaceProfileTool({} as any, {} as any).name).toBe(
      'workspaceProfileTool'
    );
    expect(new EmailNotificationsTool({} as any, {} as any).name).toBe(
      'emailNotificationsTool'
    );
    expect(new WebhooksTool({} as any, {} as any).name).toBe('webhooksTool');
    expect(new ApprovedAppsTool({} as any, {} as any, {} as any).name).toBe(
      'approvedAppsTool'
    );
    expect(
      new DeveloperTool({} as any, {} as any, {} as any, {} as any).name
    ).toBe('developerTool');
  });

  describe('team members', () => {
    const organizations = {
      getOrgsByUserId: jest.fn(async (id: string) => [
        membership(id === 'user-member' ? 'USER' : 'SUPERADMIN'),
      ]),
      getAccountOverview: jest.fn(async () => ({
        organization: { id: 'org-1', name: 'Workspace' },
        owner: { id: 'owner-1' },
      })),
      getTeam: jest.fn(),
      listPendingInvites: jest.fn(),
      inviteTeamMember: jest.fn(),
      resendInvite: jest.fn(),
      copyInviteLink: jest.fn(),
      revokeInvite: jest.fn(),
      updateTeamMemberRole: jest.fn(),
      deleteTeamMember: jest.fn(),
    };
    const users = {
      getUserById: jest.fn(async (id: string) => userRecord(id)),
    };
    const entitlements = {
      limits: jest.fn(),
      assertCanAddMember: jest.fn(),
    };
    const tool = new TeamMembersTool(
      organizations as any,
      users as any,
      entitlements as any
    );

    beforeEach(() => {
      Object.values(organizations).forEach((fn) => fn.mockClear());
      users.getUserById.mockClear();
      entitlements.limits.mockReset();
      entitlements.assertCanAddMember.mockReset();
      entitlements.assertCanAddMember.mockResolvedValue(true);
      organizations.getTeam.mockResolvedValue({
        users: [{ role: 'SUPERADMIN', user: { id: 'owner-1', email: 'owner-1@example.com' } }],
      });
      organizations.listPendingInvites.mockResolvedValue([]);
    });

    it.each(['FREE', 'STANDARD'] as const)(
      'refuses %s, including a blocked subscription reported as that plan',
      async (tier) => {
        entitlements.limits.mockResolvedValue(gate(tier));

        const listed = await run(tool, { action: 'list' });
        const invited = await run(tool, {
          action: 'invite',
          email: 'new@example.com',
          role: 'USER',
        });

        expect(listed.output.error).toBe(teamMessage(tier));
        expect(invited.output.error).toBe(teamMessage(tier));
        expect(entitlements.assertCanAddMember).not.toHaveBeenCalled();
        expect(organizations.getTeam).not.toHaveBeenCalled();
        expect(organizations.inviteTeamMember).not.toHaveBeenCalled();
      }
    );

    it('allows a Team plan to invite, and a member cannot', async () => {
      entitlements.limits.mockResolvedValue(gate('TEAM'));
      organizations.inviteTeamMember.mockResolvedValue({
        url: 'https://app.crea8.one/?org=invite-token',
        sent: true,
      });

      const invited = await run(tool, {
        action: 'invite',
        email: 'new@example.com',
        role: 'ADMIN',
        sendEmail: false,
      });

      expect(entitlements.assertCanAddMember).toHaveBeenCalledWith('org-1');
      expect(organizations.inviteTeamMember).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'org-1', name: 'Workspace' }),
        expect.objectContaining({ id: 'user-1', email: 'user-1@example.com' }),
        { email: 'new@example.com', role: 'ADMIN', sendEmail: false }
      );
      expect(invited.output).toEqual({
        url: 'https://app.crea8.one/?org=invite-token',
        sent: true,
      });
      expect(JSON.stringify(invited)).not.toContain('hashed-password');

      organizations.inviteTeamMember.mockClear();
      const member = await run(
        tool,
        { action: 'invite', email: 'new@example.com', role: 'USER' },
        { id: 'org-1', userId: 'user-member' }
      );
      expect(member.output.error).toBe('You do not have permission to do this');
      expect(organizations.inviteTeamMember).not.toHaveBeenCalled();
    });

    it('resends, copies a link, cancels, changes a role, and removes through the team handlers', async () => {
      entitlements.limits.mockResolvedValue(gate('PRO'));
      organizations.resendInvite.mockResolvedValue({ url: 'https://app.crea8.one/?org=again', sent: true });
      organizations.copyInviteLink.mockResolvedValue({ url: 'https://app.crea8.one/?org=link', sent: false });
      organizations.revokeInvite.mockResolvedValue({ revoked: true });
      organizations.updateTeamMemberRole.mockResolvedValue({ role: 'ADMIN' });
      organizations.deleteTeamMember.mockResolvedValue({ id: 'membership' });

      await run(tool, { action: 'resend', id: 'invite-1' });
      await run(tool, { action: 'link', id: 'invite-1' });
      await run(tool, { action: 'cancel', id: 'invite-1' });
      await run(tool, { action: 'role', id: 'user-9', role: 'ADMIN' });
      const removed = await run(tool, { action: 'remove', id: 'user-9' });

      expect(organizations.resendInvite).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'org-1' }),
        expect.objectContaining({ id: 'user-1' }),
        'invite-1'
      );
      expect(organizations.copyInviteLink).toHaveBeenCalledWith('org-1', 'invite-1');
      expect(organizations.revokeInvite).toHaveBeenCalledWith('org-1', 'invite-1');
      expect(organizations.updateTeamMemberRole).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'org-1',
          users: [{ role: 'SUPERADMIN' }],
        }),
        'user-9',
        'ADMIN'
      );
      expect(organizations.deleteTeamMember).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'org-1' }),
        'user-9'
      );
      expect(removed.output).toEqual({ id: 'membership' });
    });
  });

  describe('workspace and profile', () => {
    const organizations = {
      getOrgsByUserId: jest.fn(async () => [membership('ADMIN')]),
      getAccountOverview: jest.fn(async () => ({
        organization: { id: 'org-1', name: 'Workspace' },
        owner: { id: 'owner-1' },
      })),
      renameWorkspace: jest.fn(async (_org: string, userId: string, name: string) => {
        if (userId !== 'owner-1') {
          throw new HttpException('Only the workspace owner can rename it', 403);
        }
        return { id: 'org-1', name };
      }),
    };
    const users = {
      getUserById: jest.fn(async (id: string) => userRecord(id)),
      getPersonal: jest.fn(async () => ({
        id: 'user-1',
        name: 'Harsh',
        bio: 'Hello',
        picture: null,
      })),
      changePersonal: jest.fn(async (_id: string, body: unknown) => ({
        id: 'user-1',
        ...(body as object),
        picture: { id: 'media-1', path: 'https://cdn.example/a.png' },
      })),
    };
    const tool = new WorkspaceProfileTool(organizations as any, users as any);

    beforeEach(() => {
      organizations.renameWorkspace.mockClear();
      users.changePersonal.mockClear();
      users.getPersonal.mockClear();
    });

    it('updates name, bio, and picture, and refuses a rename that the service refuses', async () => {
      const updated = await run(tool, {
        action: 'update',
        fullname: 'Harsh V',
        bio: 'Builds crea8.one',
        picture: { id: 'media-1' },
      });

      expect(users.changePersonal).toHaveBeenCalledWith('user-1', {
        fullname: 'Harsh V',
        bio: 'Builds crea8.one',
        picture: { id: 'media-1' },
      });
      expect(updated.output.fullname).toBe('Harsh V');
      expect(JSON.stringify(updated)).not.toContain('hashed-password');

      const refused = await run(tool, { action: 'rename', name: 'Studio' });
      expect(organizations.renameWorkspace).toHaveBeenCalledWith(
        'org-1',
        'user-1',
        'Studio'
      );
      expect(refused.output.error).toBe('Only the workspace owner can rename it');
    });

    it('lets the workspace owner behind an API key rename', async () => {
      const renamed = await run(
        tool,
        { action: 'rename', name: 'Studio' },
        { id: 'org-1' }
      );

      expect(organizations.renameWorkspace).toHaveBeenCalledWith(
        'org-1',
        'owner-1',
        'Studio'
      );
      expect(renamed.output).toEqual({ id: 'org-1', name: 'Studio' });
    });
  });

  describe('email notifications', () => {
    let saved = {
      sendSuccessEmails: true,
      sendFailureEmails: true,
      sendStreakEmails: true,
    };
    const users = {
      getUserById: jest.fn(async (id: string) => userRecord(id)),
      getEmailNotifications: jest.fn(async () => saved),
      updateEmailNotifications: jest.fn(async (_id: string, body: typeof saved) => {
        saved = body;
      }),
    };
    const organizations = {
      getOrgsByUserId: jest.fn(async () => [membership('USER')]),
      getAccountOverview: jest.fn(),
    };
    const tool = new EmailNotificationsTool(users as any, organizations as any);

    beforeEach(() => {
      saved = {
        sendSuccessEmails: true,
        sendFailureEmails: true,
        sendStreakEmails: true,
      };
      users.updateEmailNotifications.mockClear();
    });

    it('saves the toggles and reads them back', async () => {
      const updated = await run(tool, {
        action: 'update',
        sendSuccessEmails: false,
        sendFailureEmails: true,
        sendStreakEmails: false,
      });
      const read = await run(tool, { action: 'read' });

      expect(users.updateEmailNotifications).toHaveBeenCalledWith('user-1', {
        sendSuccessEmails: false,
        sendFailureEmails: true,
        sendStreakEmails: false,
      });
      expect(updated.output).toEqual(saved);
      expect(read.output).toEqual(saved);
      expect(JSON.stringify(read)).not.toContain('hashed-password');
    });
  });

  describe('webhooks', () => {
    const webhooks = {
      getWebhooks: jest.fn(),
      createWebhook: jest.fn(),
      deleteWebhook: jest.fn(),
    };
    const entitlements = {
      limits: jest.fn(),
      countWebhooks: jest.fn(),
      assertCanAddWebhook: jest.fn(),
    };
    const tool = new WebhooksTool(webhooks as any, entitlements as any);

    beforeEach(() => {
      Object.values(webhooks).forEach((fn) => fn.mockReset());
      entitlements.limits.mockReset();
      entitlements.countWebhooks.mockReset();
      entitlements.assertCanAddWebhook.mockReset();
      entitlements.assertCanAddWebhook.mockResolvedValue(undefined);
      entitlements.countWebhooks.mockResolvedValue(1);
      global.fetch = jest.fn(async () => ({ ok: true })) as unknown as typeof fetch;
    });

    it('lists webhooks with webhookQuota and omits the signing secret', async () => {
      entitlements.limits.mockResolvedValue(gate('STANDARD'));
      webhooks.getWebhooks.mockResolvedValue([
        {
          id: 'hook-1',
          name: 'Launch',
          url: 'https://example.com/hook',
          signingSecret: 'sign-secret',
        },
      ]);

      const result = await run(tool, { action: 'list' });

      expect(result.output.quota).toBe(webhookQuota(1, PLANS.STANDARD.webhooks));
      expect(result.output.webhooks).toEqual([
        { id: 'hook-1', name: 'Launch', url: 'https://example.com/hook' },
      ]);
      expect(JSON.stringify(result)).not.toContain('sign-secret');
    });

    it.each(['FREE', 'STANDARD'] as const)(
      'refuses a create on %s and allows it on a higher plan',
      async (tier) => {
        entitlements.assertCanAddWebhook.mockRejectedValueOnce(
          refuse(webhookUpgradeMessage(tier))
        );

        const blocked = await run(tool, {
          action: 'create',
          name: 'Launch',
          url: 'https://example.com/hook',
        });

        expect(blocked.output.error).toBe(webhookUpgradeMessage(tier));
        expect(webhooks.createWebhook).not.toHaveBeenCalled();

        entitlements.assertCanAddWebhook.mockResolvedValueOnce(undefined);
        webhooks.createWebhook.mockResolvedValueOnce({ id: 'hook-2' });
        const allowed = await run(tool, {
          action: 'create',
          name: 'Launch',
          url: 'https://example.com/hook',
        });

        expect(entitlements.assertCanAddWebhook).toHaveBeenCalledWith('org-1');
        expect(webhooks.createWebhook).toHaveBeenCalledWith(
          'org-1',
          expect.objectContaining({
            name: 'Launch',
            url: 'https://example.com/hook',
          })
        );
        expect(allowed.output).toEqual({ id: 'hook-2' });
      }
    );

    it('updates and tests without the create quota, using the send sample', async () => {
      webhooks.createWebhook.mockResolvedValue({ id: 'hook-1' });

      await run(tool, {
        action: 'update',
        id: 'hook-1',
        name: 'Launch',
        url: 'https://example.com/hook',
      });
      const tested = await run(tool, {
        action: 'test',
        url: 'https://example.com/hook',
      });

      expect(entitlements.assertCanAddWebhook).not.toHaveBeenCalled();
      expect(webhooks.createWebhook).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ id: 'hook-1' })
      );
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/hook',
        expect.objectContaining({ method: 'POST' })
      );
      const body = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body as string
      );
      expect(body[0].content).toBe('This is the first post to instagram');
      expect(tested.output).toEqual({ send: true });
    });
  });

  describe('approved apps', () => {
    const oauth = {
      getApprovedApps: jest.fn(),
      revokeApp: jest.fn(),
    };
    const users = {
      getUserById: jest.fn(async (id: string) => userRecord(id)),
    };
    const organizations = {
      getOrgsByUserId: jest.fn(async () => [membership('USER')]),
      getAccountOverview: jest.fn(async () => ({
        organization: { id: 'org-1', name: 'Workspace' },
        owner: { id: 'owner-1' },
      })),
    };
    const tool = new ApprovedAppsTool(
      oauth as any,
      users as any,
      organizations as any
    );

    beforeEach(() => {
      oauth.getApprovedApps.mockReset();
      oauth.revokeApp.mockReset();
    });

    it('lists and revokes without a secret or token', async () => {
      oauth.getApprovedApps.mockResolvedValue([
        {
          id: 'auth-1',
          createdAt: '2026-11-01T00:00:00.000Z',
          accessToken: 'pos_secret_token',
          authorizationCode: 'code-secret',
          oauthApp: {
            id: 'app-1',
            name: 'Claude',
            description: 'Connector',
            clientId: 'pca_public',
            clientSecret: 'pcs_secret',
            picture: { id: 'pic-1', path: 'https://cdn.example/claude.png' },
          },
        },
      ]);
      oauth.revokeApp.mockResolvedValue({ success: true });

      const listed = await run(tool, { action: 'list' });
      const revoked = await run(tool, { action: 'revoke', id: 'auth-1' });

      expect(oauth.getApprovedApps).toHaveBeenCalledWith('user-1');
      expect(listed.output).toEqual([
        {
          id: 'auth-1',
          createdAt: '2026-11-01T00:00:00.000Z',
          name: 'Claude',
          description: 'Connector',
          picture: { id: 'pic-1', path: 'https://cdn.example/claude.png' },
        },
      ]);
      expect(JSON.stringify(listed)).not.toContain('pos_secret_token');
      expect(JSON.stringify(listed)).not.toContain('pcs_secret');
      expect(JSON.stringify(listed)).not.toContain('code-secret');
      expect(oauth.revokeApp).toHaveBeenCalledWith('user-1', 'auth-1');
      expect(revoked.output).toEqual({ success: true });
    });
  });

  describe('developer info', () => {
    const organizations = {
      getOrgsByUserId: jest.fn(async (id: string) => [
        membership(id === 'user-member' ? 'USER' : 'ADMIN'),
      ]),
      getAccountOverview: jest.fn(),
      getOrgById: jest.fn(async () => ({
        id: 'org-1',
        apiKey: 'sk_live_do_not_return',
        name: 'Workspace',
      })),
      updateApiKey: jest.fn(),
    };
    const users = {
      getUserById: jest.fn(async (id: string) => userRecord(id)),
    };
    const oauth = {
      getApp: jest.fn(async () => ({
        id: 'app-1',
        name: 'My app',
        description: 'Public',
        redirectUrl: 'https://example.com/callback',
        clientId: 'pca_public',
        clientSecret: 'pcs_do_not_return',
        picture: { id: 'pic-1', path: 'https://cdn.example/app.png' },
      })),
      createApp: jest.fn(),
      rotateSecret: jest.fn(),
    };
    const entitlements = { limits: jest.fn() };
    const tool = new DeveloperTool(
      organizations as any,
      users as any,
      oauth as any,
      entitlements as any
    );

    beforeEach(() => {
      organizations.updateApiKey.mockClear();
      oauth.createApp.mockClear();
      oauth.rotateSecret.mockClear();
      entitlements.limits.mockReset();
    });

    it('names a Free plan and still does not return the stored key', async () => {
      entitlements.limits.mockResolvedValue(gate('FREE'));

      const result = await run(tool, {});

      expect(result.output.error).toBe('Free does not include the public API.');
      expect(result.output.publicApi).toBe(false);
      expect(result.output.hasApiKey).toBe(true);
      expect(result.output.oauthApp.clientId).toBe('pca_public');
      expect(JSON.stringify(result)).not.toContain('sk_live_do_not_return');
      expect(JSON.stringify(result)).not.toContain('pcs_do_not_return');
      expect(organizations.updateApiKey).not.toHaveBeenCalled();
      expect(oauth.rotateSecret).not.toHaveBeenCalled();
      expect(oauth.createApp).not.toHaveBeenCalled();
    });

    it('allows a higher plan to read the public fields and refuses a member', async () => {
      entitlements.limits.mockResolvedValue(gate('TEAM'));

      const allowed = await run(tool, {});
      const member = await run(tool, {}, { id: 'org-1', userId: 'user-member' });

      expect(allowed.output.publicApi).toBe(true);
      expect(allowed.output.error).toBeUndefined();
      expect(allowed.output.plan).toBe('Team');
      expect(JSON.stringify(allowed)).not.toContain('sk_live_do_not_return');
      expect(member.output.error).toBe('You do not have permission to do this');
    });
  });
});
