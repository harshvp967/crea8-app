import { Injectable } from '@nestjs/common';
import { Provider, User } from '@prisma/client';
import { CreateOrgUserDto } from '@gitroom/nestjs-libraries/dtos/auth/create.org.user.dto';
import { LoginUserDto } from '@gitroom/nestjs-libraries/dtos/auth/login.user.dto';
import { UsersService } from '@gitroom/nestjs-libraries/database/prisma/users/users.service';
import {
  OrganizationInviteClaims,
  OrganizationService,
} from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { AuthService as AuthChecker } from '@gitroom/helpers/auth/auth.service';
import { AuthProviderManager } from '@gitroom/backend/services/auth/providers/providers.manager';
import dayjs from 'dayjs';
import { NotificationService } from '@gitroom/nestjs-libraries/database/prisma/notifications/notification.service';
import { ForgotReturnPasswordDto } from '@gitroom/nestjs-libraries/dtos/auth/forgot-return.password.dto';
import { EmailService } from '@gitroom/nestjs-libraries/services/email.service';
import { NewsletterService } from '@gitroom/nestjs-libraries/newsletter/newsletter.service';
import { assertOAuthRedirect } from '@gitroom/helpers/auth/oauth.link';
import { signupsClosed } from '@gitroom/nestjs-libraries/database/prisma/organizations/signups.closed';

@Injectable()
export class AuthService {
  constructor(
    private _userService: UsersService,
    private _organizationService: OrganizationService,
    private _notificationService: NotificationService,
    private _emailService: EmailService,
    private _providerManager: AuthProviderManager
  ) {}
  async canRegister(provider: string) {
    if (
      process.env.DISABLE_REGISTRATION !== 'true' ||
      provider === Provider.GENERIC
    ) {
      return true;
    }

    return (await this._organizationService.getCount()) === 0;
  }

  async routeAuth(
    provider: Provider,
    body: CreateOrgUserDto | LoginUserDto,
    ip: string,
    userAgent: string,
    addToOrg?: boolean | OrganizationInviteClaims
  ) {
    if (provider === Provider.LOCAL) {
      if (process.env.DISALLOW_PLUS && body.email.includes('+')) {
        throw new Error('Email with plus sign is not allowed');
      }
      if (body instanceof CreateOrgUserDto) {
        body.email = body.email.toLowerCase();
      }
      const user = await this._userService.getUserByEmail(body.email);
      if (body instanceof CreateOrgUserDto) {
        if (user) {
          throw new Error('Email already exists');
        }

        const invite = this.inviteClaims(addToOrg);
        if (!invite) {
          signupsClosed();
        }
        if (invite.email !== body.email) {
          throw new Error('This invite is for a different email');
        }
        await this._organizationService.assertInviteMatches(invite, body.email);
        const create = await this._organizationService.createOrgAndUser(
          body,
          ip,
          userAgent,
          { invited: true }
        );
        const created = create.users[0].user;
        const addedOrg = await this._organizationService.addUserToOrg(
          created.id,
          created.email,
          invite
        );
        return { addedOrg, jwt: await this.jwt(created) };
      }

      if (!user || !AuthChecker.comparePassword(body.password, user.password)) {
        throw new Error('Invalid user name or password');
      }

      if (!user.activated) {
        throw new Error('User is not activated');
      }

      const invite = this.inviteClaims(addToOrg);
      const addedOrg = invite
        ? await this._organizationService.addUserToOrg(
            user.id,
            user.email,
            invite
          )
        : false;
      return { addedOrg, jwt: await this.jwt(user) };
    }

    const user = await this.loginOrRegisterProvider(
      provider,
      body as CreateOrgUserDto,
      ip,
      userAgent,
      addToOrg
    );

    const invite = this.inviteClaims(addToOrg);
    const addedOrg = invite
      ? await this._organizationService.addUserToOrg(user.id, user.email, invite)
      : false;
    return { addedOrg, jwt: await this.jwt(user) };
  }

  public readOrgInvite(cookie?: string) {
    if (!cookie) {
      return { state: 'missing' as const };
    }

    try {
      const getOrg = AuthChecker.verifyJWT(cookie) as Partial<OrganizationInviteClaims>;
      const invite: OrganizationInviteClaims = {
        email: String(getOrg.email || '').trim().toLowerCase(),
        role: getOrg.role === 'ADMIN' ? 'ADMIN' : getOrg.role === 'USER' ? 'USER' : ('' as 'USER'),
        orgId: String(getOrg.orgId || ''),
        id: String(getOrg.id || ''),
        token: String(getOrg.token || ''),
        timeLimit: String(getOrg.timeLimit || ''),
      };
      if (
        !invite.email ||
        !invite.orgId ||
        !invite.id ||
        !invite.token ||
        (invite.role !== 'USER' && invite.role !== 'ADMIN')
      ) {
        return { state: 'invalid' as const };
      }
      if (!invite.timeLimit || dayjs(invite.timeLimit).isBefore(dayjs())) {
        return { state: 'expired' as const };
      }
      return { state: 'ok' as const, invite };
    } catch (err) {
      return { state: 'invalid' as const };
    }
  }

  public inviteFromCookie(cookie?: string) {
    const read = this.readOrgInvite(cookie);
    if (read.state === 'missing') {
      return false;
    }
    if (read.state === 'expired') {
      throw new Error('This invite link has expired');
    }
    if (read.state !== 'ok') {
      throw new Error('This invite link is not valid');
    }
    return read.invite;
  }

  private inviteClaims(
    addToOrg?: boolean | OrganizationInviteClaims
  ): OrganizationInviteClaims | false {
    if (!addToOrg || typeof addToOrg === 'boolean') {
      return false;
    }
    return addToOrg;
  }

  public getOrgFromCookie(cookie?: string) {
    const read = this.readOrgInvite(cookie);
    if (read.state !== 'ok') {
      return false;
    }
    return read.invite;
  }

  private async loginOrRegisterProvider(
    provider: Provider,
    body: CreateOrgUserDto,
    ip: string,
    userAgent: string,
    addToOrg?: boolean | OrganizationInviteClaims
  ) {
    const providerInstance = this._providerManager.getProvider(provider);
    const providerUser = await providerInstance.getUser(body.providerToken);

    if (!providerUser) {
      throw new Error('Invalid provider token');
    }

    const user = await this._userService.getUserByProvider(
      providerUser.id,
      provider
    );
    if (user) {
      return user;
    }

    const invite = this.inviteClaims(addToOrg);
    if (!invite) {
      signupsClosed();
    }
    const email = String(providerUser.email || '').trim().toLowerCase();
    if (!email || email !== invite.email) {
      throw new Error('This invite is for a different email');
    }
    await this._organizationService.assertInviteMatches(invite, email);
    const create = await this._organizationService.createOrgAndUser(
      {
        company: body.company,
        email,
        password: '',
        provider,
        providerId: providerUser.id,
        datafast_visitor_id: body.datafast_visitor_id,
      },
      ip,
      userAgent,
      { invited: true }
    );
    return create.users[0].user;
  }

  private async _track(
    name: string,
    email: string,
    datafast_visitor_id: string
  ) {
    if (email && datafast_visitor_id && process.env.DATAFAST_API_KEY) {
      try {
        await fetch('https://datafa.st/api/v1/goals', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.DATAFAST_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            datafast_visitor_id: datafast_visitor_id,
            name: name,
            metadata: {
              email,
            },
          }),
        });
      } catch (err) {}
    }
  }

  async forgot(email: string) {
    const user = await this._userService.getUserByEmail(email);
    if (!user || user.providerName !== Provider.LOCAL) {
      return false;
    }

    const resetValues = AuthChecker.signJWT({
      id: user.id,
      expires: dayjs().add(20, 'minutes').format('YYYY-MM-DD HH:mm:ss'),
    });

    await this._notificationService.sendEmail(
      user.email,
      'Reset your password',
      `You have requested to reset your passsord. <br />Click <a href="${process.env.FRONTEND_URL}/auth/forgot/${resetValues}">here</a> to reset your password<br />The link will expire in 20 minutes`
    );
  }

  forgotReturn(body: ForgotReturnPasswordDto) {
    const user = AuthChecker.verifyJWT(body.token) as {
      id: string;
      expires: string;
    };
    if (dayjs(user.expires).isBefore(dayjs())) {
      return false;
    }

    return this._userService.updatePassword(user.id, body.password);
  }

  async activate(code: string, tracking: string) {
    const user = AuthChecker.verifyJWT(code) as {
      id: string;
      activated: boolean;
      email: string;
    };
    if (user.id && !user.activated) {
      const getUserAgain = await this._userService.getUserByEmail(user.email);
      if (getUserAgain.activated) {
        return false;
      }
      await this._userService.activateUser(user.id);
      user.activated = true;
      this._track('register', user.email, tracking).catch((err) => {});
      await NewsletterService.register(user.email);
      return this.jwt(user as any);
    }

    return false;
  }

  async resendActivationEmail(email: string) {
    const user = await this._userService.getUserByEmail(email);

    if (!user) {
      throw new Error('User not found');
    }

    if (user.activated) {
      throw new Error('Account is already activated');
    }

    const jwt = await this.jwt(user);

    await this._emailService.sendEmail(
      user.email,
      'Activate your account',
      `Click <a href="${process.env.FRONTEND_URL}/auth/activate/${jwt}">here</a> to activate your account`,
      'top'
    );

    return true;
  }

  oauthLink(provider: string, query?: any) {
    const providerInstance = this._providerManager.getProvider(provider);
    return Promise.resolve(providerInstance.generateLink(query)).then((link) =>
      assertOAuthRedirect(link)
    );
  }

  async checkExists(
    provider: string,
    code: string,
    redirectUri?: string,
    state?: string,
    stateCookie?: string,
    orgCookie?: string
  ) {
    // the mobile app passes redirect_uri and keeps no cookies, the web flow
    // never passes it, so the state nonce is only enforced for the web flow
    if (
      !process.env.NOT_SECURED &&
      !redirectUri &&
      (!state || state !== stateCookie)
    ) {
      throw new Error('Invalid state');
    }

    const providerInstance = this._providerManager.getProvider(provider);
    const token = await providerInstance.getToken(code, redirectUri);
    const user = await providerInstance.getUser(token);
    if (!user) {
      throw new Error('Invalid user');
    }
    const checkExists = await this._userService.getUserByProvider(
      user.id,
      provider as Provider
    );
    if (checkExists) {
      const invite = this.optionalInvite(orgCookie);
      if (invite) {
        await this._organizationService.addUserToOrg(
          checkExists.id,
          checkExists.email,
          invite
        );
      }
      return { jwt: await this.jwt(checkExists) };
    }

    const invite = this.optionalInvite(orgCookie);
    if (!invite) {
      signupsClosed();
    }
    const email = String(user.email || '').trim().toLowerCase();
    if (!email || email !== invite.email) {
      throw new Error('This invite is for a different email');
    }
    await this._organizationService.assertInviteMatches(invite, email);
    return { token };
  }

  private optionalInvite(orgCookie?: string) {
    if (!orgCookie) {
      return false;
    }
    return this.inviteFromCookie(orgCookie);
  }

  private async jwt(user: User) {
    if (user.password) {
      delete user.password;
    }
    return AuthChecker.signJWT(user);
  }
}
