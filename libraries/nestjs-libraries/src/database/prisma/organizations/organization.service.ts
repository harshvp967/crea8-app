import { CreateOrgUserDto } from '@gitroom/nestjs-libraries/dtos/auth/create.org.user.dto';
import { HttpException, Injectable } from '@nestjs/common';
import { OrganizationRepository } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.repository';
import { NotificationService } from '@gitroom/nestjs-libraries/database/prisma/notifications/notification.service';
import { AddTeamMemberDto } from '@gitroom/nestjs-libraries/dtos/settings/add.team.member.dto';
import { AdminAddTeamMemberDto } from '@gitroom/nestjs-libraries/dtos/settings/admin.add.team.member.dto';
import { pricing } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';
import { defaultPlanTier } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/default.plan';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import dayjs from 'dayjs';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { makeSecureId } from '@gitroom/nestjs-libraries/services/make.secure.id';
import {
  Organization,
  OrganizationInviteStatus,
  ShortLinkPreference,
  User,
} from '@prisma/client';
import { AutopostService } from '@gitroom/nestjs-libraries/database/prisma/autopost/autopost.service';
import { signupsClosed } from '@gitroom/nestjs-libraries/database/prisma/organizations/signups.closed';
import { isBillingEnforced } from '@gitroom/helpers/utils/billing.enabled';
import { EntitlementService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/entitlement.service';

export type OrganizationInviteClaims = {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  orgId: string;
  timeLimit: string;
  token: string;
};

const INVITE_CLAIM_KEYS = [
  'id',
  'email',
  'role',
  'orgId',
  'timeLimit',
  'token',
] as const;

export function hashInviteToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function inviteTokenMatches(token: string, hash: string) {
  if (!token || !hash) {
    return false;
  }
  const actual = Buffer.from(hashInviteToken(token));
  const expected = Buffer.from(hash);
  if (actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(actual, expected);
}

function inviteClaims(input: OrganizationInviteClaims): OrganizationInviteClaims {
  return {
    id: input.id,
    email: input.email,
    role: input.role,
    orgId: input.orgId,
    timeLimit: input.timeLimit,
    token: input.token,
  };
}

@Injectable()
export class OrganizationService {
  constructor(
    private _organizationRepository: OrganizationRepository,
    private _notificationsService: NotificationService,
    private _entitlements: EntitlementService
  ) {}
  createWorkspace(userId: string, name: string) {
    return this._organizationRepository.createWorkspace(userId, name);
  }

  async createOrgAndUser(
    body: Omit<CreateOrgUserDto, 'providerToken'> & { providerId?: string },
    ip: string,
    userAgent: string,
    options?: { invited?: boolean }
  ) {
    if (!options?.invited) {
      signupsClosed();
    }
    return this._organizationRepository.createOrgAndUser(
      body,
      this._notificationsService.hasEmailProvider(),
      ip,
      userAgent
    );
  }

  async getCount() {
    return this._organizationRepository.getCount();
  }

  async createMaxUser(id: string, name: string, saasName: string, email: string) {
    signupsClosed();
    return this._organizationRepository.createMaxUser(id, name, saasName, email);
  }

  async addUserToOrg(
    userId: string,
    email: string,
    claims: OrganizationInviteClaims
  ) {
    const invite = await this.loadMatchingInvite(claims);
    if (invite.email !== email.trim().toLowerCase()) {
      throw new HttpException('This invite is for a different email', 400);
    }

    if (isBillingEnforced(claims.orgId)) {
      await this._entitlements.assertCanAddMember(claims.orgId);
    }

    const tier = await this._organizationRepository.getSubscriptionTier(
      claims.orgId
    );
    if (
      !isBillingEnforced(claims.orgId) &&
      process.env.STRIPE_PUBLISHABLE_KEY &&
      tier?.subscription?.subscriptionTier === 'STANDARD'
    ) {
      throw new HttpException(
        'The organization plan does not include team members',
        400
      );
    }

    const existing = await this._organizationRepository.getOrgMember(
      claims.orgId,
      userId
    );
    if (existing) {
      await this._organizationRepository.updateOrganizationInvite(invite.id, {
        status: OrganizationInviteStatus.ACCEPTED,
      });
      return { organizationId: claims.orgId };
    }

    let added: { organizationId: string } | false;
    try {
      added = await this._organizationRepository.addUserToOrg(
        userId,
        claims.id,
        claims.orgId,
        claims.role
      );
    } catch (err) {
      if ((err as { code?: string })?.code === 'P2002') {
        await this._organizationRepository.updateOrganizationInvite(invite.id, {
          status: OrganizationInviteStatus.ACCEPTED,
        });
        return { organizationId: claims.orgId };
      }
      throw err;
    }

    if (!added) {
      throw new HttpException('This invite link has already been used', 400);
    }

    await this._organizationRepository.updateOrganizationInvite(invite.id, {
      status: OrganizationInviteStatus.ACCEPTED,
    });
    return added;
  }

  getOrgById(id: string) {
    return this._organizationRepository.getOrgById(id);
  }

  getOrgByIdWithSubscription(id: string) {
    return this._organizationRepository.getOrgByIdWithSubscription(id);
  }

  getAccountOverview(orgId: string) {
    return this._organizationRepository.getAccountOverview(orgId);
  }

  getOrgByApiKey(api: string) {
    return this._organizationRepository.getOrgByApiKey(api);
  }

  async canUseSuperAdminApi(orgId: string) {
    const [superAdmin, privilegedOther] = await Promise.all([
      this._organizationRepository.getSuperAdminUser(orgId),
      this._organizationRepository.getPrivilegedNonSuperAdminUser(orgId),
    ]);

    return !!superAdmin && !privilegedOther;
  }

  getUserOrg(id: string) {
    return this._organizationRepository.getUserOrg(id);
  }

  getOrgsByUserId(userId: string) {
    return this._organizationRepository.getOrgsByUserId(userId);
  }

  updateApiKey(orgId: string) {
    return this._organizationRepository.updateApiKey(orgId);
  }

  getTeam(orgId: string) {
    return this._organizationRepository.getTeam(orgId);
  }

  async setStreak(organizationId: string, type: 'start' | 'end') {
    return this._organizationRepository.setStreak(organizationId, type);
  }

  getOrgByCustomerId(customerId: string) {
    return this._organizationRepository.getOrgByCustomerId(customerId);
  }

  async inviteTeamMember(org: Organization, user: User, body: AddTeamMemberDto) {
    await this._entitlements.assertCanAddMember(org.id);
    const email = body.email.trim().toLowerCase();
    const role = body.role as 'USER' | 'ADMIN';
    const existing = await this._organizationRepository.findReusableInvite(
      org.id,
      email
    );
    const url = existing
      ? await this.rotateInviteLink(existing.id, email, role, org.id)
      : await this.createInviteLink(email, role, org.id);
    return this.deliverInvite(email, org, user, url, body.sendEmail);
  }

  listPendingInvites(orgId: string) {
    return this._organizationRepository.listPendingInvites(orgId, new Date());
  }

  async resendInvite(org: Organization, user: User, id: string) {
    const invite = await this.requireOrgInvite(org.id, id);
    if (
      invite.status === OrganizationInviteStatus.ACCEPTED ||
      invite.status === OrganizationInviteStatus.REVOKED
    ) {
      throw new HttpException('This invite link is not valid', 400);
    }
    const url = await this.rotateInviteLink(
      invite.id,
      invite.email,
      invite.role as 'USER' | 'ADMIN',
      org.id
    );
    return this.deliverInvite(invite.email, org, user, url, true);
  }

  async copyInviteLink(orgId: string, id: string) {
    const invite = await this.requireOrgInvite(orgId, id);
    if (invite.status !== OrganizationInviteStatus.PENDING && invite.status !== OrganizationInviteStatus.EXPIRED) {
      throw new HttpException('This invite link is not valid', 400);
    }
    const url = await this.rotateInviteLink(
      invite.id,
      invite.email,
      invite.role as 'USER' | 'ADMIN',
      orgId
    );
    return { url, sent: false };
  }

  async revokeInvite(orgId: string, id: string) {
    const invite = await this.requireOrgInvite(orgId, id);
    if (invite.status === OrganizationInviteStatus.ACCEPTED) {
      throw new HttpException('This invite link has already been used', 400);
    }
    if (invite.status === OrganizationInviteStatus.REVOKED) {
      throw new HttpException('This invite link is not valid', 400);
    }
    await this._organizationRepository.updateOrganizationInvite(id, {
      status: OrganizationInviteStatus.REVOKED,
    });
    return { revoked: true };
  }

  async assertInviteMatches(claims: OrganizationInviteClaims, email: string) {
    const invite = await this.loadMatchingInvite(claims);
    if (invite.email !== email.trim().toLowerCase()) {
      throw new HttpException('This invite is for a different email', 400);
    }
    return invite;
  }

  async addTeamMemberByEmail(org: Organization, body: AdminAddTeamMemberDto) {
    if (isBillingEnforced(org.id)) {
      await this._entitlements.assertCanAddMember(org.id);
    } else {
      const tier =
        // @ts-ignore
        org?.subscription?.subscriptionTier || defaultPlanTier();

      if (!pricing[tier].team_members) {
        throw new HttpException(
          'The organization plan does not include team members',
          400
        );
      }
    }

    const users = await this._organizationRepository.getUsersByEmail(
      body.email
    );
    if (!users.length) {
      throw new HttpException('No Crea8one account found for this email', 400);
    }

    if (users.length > 1) {
      throw new HttpException(
        'Multiple accounts exist for this email (different login providers)',
        400
      );
    }

    const [user] = users;

    const userOrgs = await this._organizationRepository.getOrgsByUserId(
      user.id
    );
    if (userOrgs.some((current) => current.id === org.id)) {
      throw new HttpException(
        'User is already a member of this organization',
        400
      );
    }

    const added = await this._organizationRepository.addUserToOrg(
      user.id,
      makeId(5),
      org.id,
      body.role as 'USER' | 'ADMIN'
    );

    if (!added) {
      throw new HttpException(
        'Could not add the user to the organization',
        400
      );
    }

    return { added: true };
  }

  async updateTeamMemberRole(
    org: Organization,
    userId: string,
    role: 'USER' | 'ADMIN'
  ) {
    const member = await this.memberOfOrg(org.id, userId);
    const myRole = this.actorRole(org);
    const userRole = member.users[0].role;
    if (
      userRole === 'SUPERADMIN' ||
      this.roleLevel(myRole) <= this.roleLevel(userRole)
    ) {
      throw new HttpException(
        'You do not have permission to change this role',
        403
      );
    }
    return this._organizationRepository.updateTeamMemberRole(
      org.id,
      userId,
      role
    );
  }

  async deleteTeamMember(org: Organization, userId: string) {
    const member = await this.memberOfOrg(org.id, userId);
    const myRole = this.actorRole(org);
    const userRole = member.users[0].role;
    if (this.roleLevel(myRole) <= this.roleLevel(userRole)) {
      throw new HttpException(
        'You do not have permission to delete this user',
        403
      );
    }

    try {
      return await this._organizationRepository.deleteTeamMember(org.id, userId);
    } catch (err) {
      if ((err as { code?: string })?.code === 'P2025') {
        throw new HttpException('User is not part of this organization', 404);
      }
      throw err;
    }
  }

  private actorRole(org: Organization) {
    // @ts-ignore
    const role = org.users?.[0]?.role as string | undefined;
    if (!role) {
      throw new HttpException('You do not have permission to do this', 403);
    }
    return role;
  }

  private roleLevel(role: string) {
    if (role === 'USER') return 0;
    if (role === 'ADMIN') return 1;
    if (role === 'SUPERADMIN') return 2;
    return -1;
  }

  private async memberOfOrg(orgId: string, userId: string) {
    const userOrgs = await this._organizationRepository.getOrgsByUserId(userId);
    const member = userOrgs.find((orgUser) => orgUser.id === orgId);
    if (!member) {
      throw new HttpException('User is not part of this organization', 404);
    }
    return member;
  }

  private async requireOrgInvite(orgId: string, id: string) {
    const invite = await this._organizationRepository.getOrganizationInvite(id);
    if (!invite || invite.organizationId !== orgId) {
      throw new HttpException('Invite not found', 404);
    }
    return invite;
  }

  private async createInviteLink(
    email: string,
    role: 'USER' | 'ADMIN',
    orgId: string
  ) {
    const id = randomUUID();
    const issued = this.issueToken(id, email, role, orgId);
    await this._organizationRepository.createOrganizationInvite({
      id,
      email,
      role,
      organizationId: orgId,
      tokenHash: hashInviteToken(issued.token),
      expiresAt: dayjs(issued.timeLimit).toDate(),
    });
    return issued.url;
  }

  private async rotateInviteLink(
    id: string,
    email: string,
    role: 'USER' | 'ADMIN',
    orgId: string
  ) {
    const issued = this.issueToken(id, email, role, orgId);
    await this._organizationRepository.updateOrganizationInvite(id, {
      email,
      role,
      tokenHash: hashInviteToken(issued.token),
      expiresAt: dayjs(issued.timeLimit).toDate(),
      status: OrganizationInviteStatus.PENDING,
    });
    return issued.url;
  }

  private issueToken(
    id: string,
    email: string,
    role: 'USER' | 'ADMIN',
    orgId: string
  ) {
    const token = makeSecureId(32);
    const timeLimit = dayjs().add(2, 'day').format('YYYY-MM-DD HH:mm:ss');
    const claims = inviteClaims({ id, email, role, orgId, timeLimit, token });
    if (Object.keys(claims).sort().join() !== [...INVITE_CLAIM_KEYS].sort().join()) {
      throw new Error('Invite token signed the wrong fields');
    }
    const url =
      process.env.FRONTEND_URL + `/?org=${AuthService.signJWT(claims)}`;
    return { url, token, timeLimit };
  }

  private async deliverInvite(
    email: string,
    org: Organization,
    user: User,
    url: string,
    sendEmail: boolean
  ) {
    if (!sendEmail) {
      return { url, sent: false };
    }
    if (!this._notificationsService.hasEmailProvider()) {
      return {
        url,
        sent: false,
        error: 'Email is not configured. Copy the invite link instead.',
      };
    }
    const inviter = user.name ? `${user.name} (${user.email})` : user.email;
    try {
      await this._notificationsService.sendEmail(
        email,
        `${user.name || user.email} invited you to join "${org.name}"`,
        `${inviter} has invited you to join the "${org.name}" team.<br /><a href="${url}">Accept the invitation</a> to get started.<br />The link will expire in 2 days.`
      );
    } catch {
      return {
        url,
        sent: false,
        error: 'The invite link is ready, but the email could not be sent.',
      };
    }
    return { url, sent: true };
  }

  private async loadMatchingInvite(claims: OrganizationInviteClaims) {
    const invite = await this._organizationRepository.getOrganizationInvite(
      claims.id
    );
    if (
      !invite ||
      invite.organizationId !== claims.orgId ||
      (invite.role !== 'USER' && invite.role !== 'ADMIN') ||
      invite.role !== claims.role ||
      !inviteTokenMatches(claims.token, invite.tokenHash)
    ) {
      throw new HttpException('This invite link is not valid', 400);
    }
    if (
      invite.status === OrganizationInviteStatus.EXPIRED ||
      dayjs(invite.expiresAt).isBefore(dayjs()) ||
      !claims.timeLimit ||
      dayjs(claims.timeLimit).isBefore(dayjs())
    ) {
      if (invite.status === OrganizationInviteStatus.PENDING) {
        await this._organizationRepository.updateOrganizationInvite(invite.id, {
          status: OrganizationInviteStatus.EXPIRED,
        });
      }
      throw new HttpException('This invite link has expired', 400);
    }
    if (invite.status === OrganizationInviteStatus.ACCEPTED) {
      throw new HttpException('This invite link has already been used', 400);
    }
    if (invite.status !== OrganizationInviteStatus.PENDING) {
      throw new HttpException('This invite link is not valid', 400);
    }
    if (invite.email !== claims.email.trim().toLowerCase()) {
      throw new HttpException('This invite is for a different email', 400);
    }
    return invite;
  }

  disableOrEnableNonSuperAdminUsers(orgId: string, disable: boolean) {
    return this._organizationRepository.disableOrEnableNonSuperAdminUsers(
      orgId,
      disable
    );
  }

  getShortlinkPreference(orgId: string) {
    return this._organizationRepository.getShortlinkPreference(orgId);
  }

  updateShortlinkPreference(orgId: string, shortlink: ShortLinkPreference) {
    return this._organizationRepository.updateShortlinkPreference(
      orgId,
      shortlink
    );
  }
}
