jest.mock('@gitroom/nestjs-libraries/services/email.service', () => ({
  EmailService: class EmailService {},
}));
jest.mock('@gitroom/nestjs-libraries/newsletter/newsletter.service', () => ({
  NewsletterService: { register: jest.fn() },
}));

import { HttpException } from '@nestjs/common';
import { Organization, OrganizationInviteStatus } from '@prisma/client';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { AddTeamMemberDto } from '@gitroom/nestjs-libraries/dtos/settings/add.team.member.dto';
import {
  OrganizationInviteClaims,
  OrganizationService,
} from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';

describe('organization invites', () => {
  const previousSecret = process.env.JWT_SECRET;
  const previousStripe = process.env.STRIPE_PUBLISHABLE_KEY;
  const previousFront = process.env.FRONTEND_URL;

  beforeAll(() => {
    process.env.JWT_SECRET = 'invite-test-secret';
    process.env.FRONTEND_URL = 'https://app.crea8.one';
  });

  afterAll(() => {
    process.env.JWT_SECRET = previousSecret;
    process.env.FRONTEND_URL = previousFront;
    if (previousStripe === undefined) {
      delete process.env.STRIPE_PUBLISHABLE_KEY;
    } else {
      process.env.STRIPE_PUBLISHABLE_KEY = previousStripe;
    }
  });

  beforeEach(() => {
    delete process.env.STRIPE_PUBLISHABLE_KEY;
  });

  function harness(hasEmailProvider = false) {
    const invites = new Map<string, Record<string, unknown>>();
    const sendEmail = jest.fn();
    const repository = {
      createOrganizationInvite: jest.fn(async (data) => {
        invites.set(data.id, { ...data, status: 'PENDING' });
        return invites.get(data.id);
      }),
      updateOrganizationInvite: jest.fn(async (id, data) => {
        const current = invites.get(id);
        invites.set(id, { ...current, ...data });
        return invites.get(id);
      }),
      getOrganizationInvite: jest.fn(async (id) => invites.get(id) || null),
      findReusableInvite: jest.fn(async (orgId: string, email: string) => {
        return (
          [...invites.values()].find(
            (invite) =>
              invite.organizationId === orgId &&
              invite.email === email &&
              (invite.status === 'PENDING' || invite.status === 'EXPIRED')
          ) || null
        );
      }),
      listPendingInvites: jest.fn(async (orgId: string, now: Date) => {
        return [...invites.values()].filter(
          (invite) =>
            invite.organizationId === orgId &&
            invite.status === 'PENDING' &&
            (invite.expiresAt as Date) > now
        );
      }),
      getSubscriptionTier: jest.fn().mockResolvedValue(null),
      getOrgMember: jest.fn().mockResolvedValue(null),
      addUserToOrg: jest.fn().mockResolvedValue({ organizationId: 'org-1' }),
      getOrgsByUserId: jest.fn().mockResolvedValue([]),
      deleteTeamMember: jest.fn().mockResolvedValue({ id: 'membership' }),
      updateTeamMemberRole: jest.fn().mockResolvedValue({ role: 'ADMIN' }),
    };
    const service = new OrganizationService(
      repository as never,
      {
        hasEmailProvider: () => hasEmailProvider,
        sendEmail,
      } as never,
      { assertCanAddMember: jest.fn().mockResolvedValue(true) } as never
    );
    const org = {
      id: 'org-1',
      name: 'Acme',
      users: [{ role: 'SUPERADMIN' }],
    } as unknown as Organization;
    const user = {
      id: 'user-1',
      email: 'owner@example.com',
      name: 'Owner',
    } as never;
    return { invites, repository, service, org, user, sendEmail };
  }

  function claimsFrom(url: string): OrganizationInviteClaims {
    const token = new URL(url).searchParams.get('org') || '';
    return AuthService.verifyJWT(token) as OrganizationInviteClaims;
  }

  async function invite(
    service: OrganizationService,
    org: Organization,
    user: never,
    sendEmail: boolean
  ) {
    return service.inviteTeamMember(
      org,
      user,
      Object.assign(new AddTeamMemberDto(), {
        email: 'Person@example.com',
        role: 'USER',
        sendEmail,
      })
    );
  }

  it('signs only the invite fields and ties the link to the invited email', async () => {
    const { service, org, user } = harness();
    const sign = jest.spyOn(AuthService, 'signJWT');
    let result: { url: string; sent: boolean };
    try {
      result = await invite(service, org, user, false);
    } finally {
      const payload = sign.mock.calls[0][0] as Record<string, unknown>;
      sign.mockRestore();
      expect(Object.keys(payload).sort()).toEqual([
        'email',
        'id',
        'orgId',
        'role',
        'timeLimit',
        'token',
      ]);
      expect(payload).not.toHaveProperty('sendEmail');
      expect(payload.email).toBe('person@example.com');
    }

    expect(result.sent).toBe(false);
    expect(result.url).toContain('https://app.crea8.one/?org=');

    const claims = claimsFrom(result.url);
    await expect(
      service.addUserToOrg('member-1', 'other@example.com', claims)
    ).rejects.toMatchObject({
      message: 'This invite is for a different email',
    });
  });

  it('returns the link and a clear error when no email provider is configured', async () => {
    const { service, org, user, sendEmail } = harness(false);
    const result = await invite(service, org, user, true);
    expect(result.sent).toBe(false);
    expect(result.error).toMatch(/not configured/i);
    expect(result.url).toContain('?org=');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('sends the email only when a provider is configured', async () => {
    const { service, org, user, sendEmail } = harness(true);
    const result = await invite(service, org, user, true);
    expect(result.sent).toBe(true);
    expect(result.error).toBeUndefined();
    expect(sendEmail).toHaveBeenCalledWith(
      'person@example.com',
      expect.stringContaining('Acme'),
      expect.stringContaining(result.url)
    );
  });

  it('lists, resends, copies, and revokes a pending invite', async () => {
    const { service, org, user, sendEmail, invites } = harness(false);
    const created = await invite(service, org, user, false);
    const listed = await service.listPendingInvites(org.id);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      email: 'person@example.com',
      role: 'USER',
      status: 'PENDING',
    });

    const resent = await service.resendInvite(org, user, listed[0].id);
    expect(resent.sent).toBe(false);
    expect(resent.error).toMatch(/not configured/i);
    expect(resent.url).not.toBe(created.url);
    expect(sendEmail).not.toHaveBeenCalled();

    const copied = await service.copyInviteLink(org.id, listed[0].id);
    expect(copied).toEqual({ url: expect.any(String), sent: false });
    expect(copied.url).not.toBe(resent.url);

    await expect(service.revokeInvite(org.id, listed[0].id)).resolves.toEqual({
      revoked: true,
    });
    expect(invites.get(listed[0].id)?.status).toBe(
      OrganizationInviteStatus.REVOKED
    );
    await expect(service.listPendingInvites(org.id)).resolves.toEqual([]);
    await expect(service.revokeInvite(org.id, listed[0].id)).rejects.toBeInstanceOf(
      HttpException
    );
  });

  it('rejects a used link, an expired link, and a plan that already disallows members', async () => {
    const { service, org, user, repository } = harness();
    const created = await invite(service, org, user, false);
    const claims = claimsFrom(created.url);

    await expect(
      service.addUserToOrg('member-1', claims.email, claims)
    ).resolves.toEqual({ organizationId: 'org-1' });

    await expect(
      service.addUserToOrg('member-2', claims.email, claims)
    ).rejects.toMatchObject({
      message: 'This invite link has already been used',
    });

    const expired = await invite(service, org, user, false);
    const expiredClaims = claimsFrom(expired.url);
    const row = await repository.getOrganizationInvite(expiredClaims.id);
    await repository.updateOrganizationInvite(expiredClaims.id, {
      expiresAt: new Date('2000-01-01T00:00:00.000Z'),
      tokenHash: row.tokenHash,
    });
    await expect(
      service.addUserToOrg('member-3', expiredClaims.email, expiredClaims)
    ).rejects.toMatchObject({
      message: 'This invite link has expired',
    });

    const blocked = await invite(service, org, user, false);
    const blockedClaims = claimsFrom(blocked.url);
    process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test';
    repository.getSubscriptionTier.mockResolvedValue({
      subscription: { subscriptionTier: 'STANDARD' },
    });
    await expect(
      service.addUserToOrg('member-4', blockedClaims.email, blockedClaims)
    ).rejects.toMatchObject({
      message: 'The organization plan does not include team members',
    });
    expect(repository.addUserToOrg).toHaveBeenCalledTimes(1);
  });

  it('changes a lower role and refuses to let an admin remove another admin', async () => {
    const { service, repository } = harness();
    const admin = {
      id: 'org-1',
      users: [{ role: 'ADMIN' }],
    } as unknown as Organization;
    const superadmin = {
      id: 'org-1',
      users: [{ role: 'SUPERADMIN' }],
    } as unknown as Organization;
    repository.getOrgsByUserId.mockImplementation(async (userId: string) => {
      if (userId === 'missing') {
        return [];
      }
      const role = userId === 'admin-2' ? 'ADMIN' : 'USER';
      return [{ id: 'org-1', users: [{ role }] }];
    });

    await expect(
      service.deleteTeamMember(admin, 'admin-2')
    ).rejects.toMatchObject({
      message: 'You do not have permission to delete this user',
      status: 403,
    });
    expect(repository.deleteTeamMember).not.toHaveBeenCalled();

    await expect(service.deleteTeamMember(admin, 'user-2')).resolves.toEqual({
      id: 'membership',
    });
    await expect(
      service.deleteTeamMember(admin, 'missing')
    ).rejects.toMatchObject({
      status: 404,
    });

    await expect(
      service.updateTeamMemberRole(admin, 'admin-2', 'USER')
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.updateTeamMemberRole(superadmin, 'admin-2', 'USER')
    ).resolves.toEqual({ role: 'ADMIN' });
    expect(repository.updateTeamMemberRole).toHaveBeenCalledWith(
      'org-1',
      'admin-2',
      'USER'
    );
  });
});
