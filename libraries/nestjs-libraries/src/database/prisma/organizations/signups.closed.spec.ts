jest.mock('@gitroom/nestjs-libraries/database/prisma/users/users.service', () => ({
  UsersService: class UsersService {},
}));
jest.mock('@gitroom/nestjs-libraries/newsletter/newsletter.service', () => ({
  NewsletterService: { register: jest.fn() },
}));
jest.mock('@gitroom/nestjs-libraries/services/email.service', () => ({
  EmailService: class EmailService {},
}));

import { Provider } from '@prisma/client';
import { AuthService as Password } from '@gitroom/helpers/auth/auth.service';
import { AuthService } from '@gitroom/backend/services/auth/auth.service';
import { CreateOrgUserDto } from '@gitroom/nestjs-libraries/dtos/auth/create.org.user.dto';
import { LoginUserDto } from '@gitroom/nestjs-libraries/dtos/auth/login.user.dto';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { NewsletterService } from '@gitroom/nestjs-libraries/newsletter/newsletter.service';
import { SIGNUPS_CLOSED_MESSAGE } from '@gitroom/nestjs-libraries/database/prisma/organizations/signups.closed';
import {
  hashInviteToken,
  OrganizationInviteClaims,
} from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';

describe('closed sign-ups', () => {
  const previousSecret = process.env.JWT_SECRET;
  const previousSecured = process.env.NOT_SECURED;
  const previousRegistration = process.env.DISABLE_REGISTRATION;
  const password = 'existing-password';
  const passwordHash = Password.hashPassword(password);
  const existing = {
    id: 'user-1',
    email: 'reviewer@example.com',
    password: passwordHash,
    activated: true,
    providerName: Provider.LOCAL,
  };

  beforeAll(() => {
    process.env.JWT_SECRET = 'signup-close-test-secret';
    process.env.NOT_SECURED = 'true';
  });

  afterAll(() => {
    process.env.JWT_SECRET = previousSecret;
    process.env.NOT_SECURED = previousSecured;
    if (previousRegistration === undefined) {
      delete process.env.DISABLE_REGISTRATION;
    } else {
      process.env.DISABLE_REGISTRATION = previousRegistration;
    }
  });

  beforeEach(() => {
    delete process.env.DISABLE_REGISTRATION;
    (NewsletterService.register as jest.Mock).mockClear();
  });

  function pendingInvite(claims: OrganizationInviteClaims) {
    return {
      id: claims.id,
      email: claims.email,
      role: claims.role,
      organizationId: claims.orgId,
      tokenHash: hashInviteToken(claims.token),
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      status: 'PENDING',
    };
  }

  function organization(count = 1) {
    const repository = {
      createOrgAndUser: jest.fn(),
      createMaxUser: jest.fn(),
      getCount: jest.fn().mockResolvedValue(count),
      addUserToOrg: jest.fn().mockResolvedValue({ organizationId: 'org-1' }),
      getOrganizationInvite: jest.fn().mockResolvedValue(null),
      getSubscriptionTier: jest.fn().mockResolvedValue(null),
      getOrgMember: jest.fn().mockResolvedValue(null),
      updateOrganizationInvite: jest.fn(),
    };
    const service = new OrganizationService(
      repository as never,
      {
        hasEmailProvider: () => false,
      } as never,
      { assertCanAddMember: jest.fn().mockResolvedValue(true) } as never
    );
    return { repository, service };
  }

  function auth(
    org: OrganizationService,
    users: Record<string, unknown>,
    providerManager?: Record<string, unknown>,
    emailService?: { sendEmail: jest.Mock }
  ) {
    return new AuthService(
      users as never,
      org,
      {} as never,
      {
        hasProvider: () => false,
        sendEmail: jest.fn(),
        ...emailService,
      } as never,
      (providerManager || {}) as never
    );
  }

  function localSignup() {
    return Object.assign(new CreateOrgUserDto(), {
      email: 'New.Person@example.com',
      password: 'another-password',
      provider: Provider.LOCAL,
      company: 'Example',
    });
  }

  it('registers a new email without an invite when registration is open', async () => {
    process.env.DISABLE_REGISTRATION = 'false';
    const { repository, service: org } = organization();
    const sendEmail = jest.fn();
    const users = { getUserByEmail: jest.fn().mockResolvedValue(null) };
    repository.createOrgAndUser.mockResolvedValue({
      id: 'org-new',
      users: [
        {
          user: {
            id: 'new-user',
            email: 'new.person@example.com',
            activated: false,
          },
        },
      ],
    });

    const created = await auth(org, users, undefined, { sendEmail }).routeAuth(
      Provider.LOCAL,
      localSignup(),
      '127.0.0.1',
      'jest'
    );

    expect(created.jwt).toEqual(expect.any(String));
    expect(created.addedOrg).toBe(false);
    expect(repository.createOrgAndUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new.person@example.com',
        provider: Provider.LOCAL,
      }),
      false,
      '127.0.0.1',
      'jest'
    );
    expect(repository.addUserToOrg).not.toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledWith(
      'new.person@example.com',
      'Activate your account',
      expect.stringContaining(`/auth/activate/${created.jwt}`),
      'top'
    );
  });

  it('rejects a new email when registration is disabled', async () => {
    process.env.DISABLE_REGISTRATION = 'true';
    const { repository, service: org } = organization();
    const users = { getUserByEmail: jest.fn().mockResolvedValue(null) };

    await expect(
      auth(org, users).routeAuth(
        Provider.LOCAL,
        localSignup(),
        '127.0.0.1',
        'jest'
      )
    ).rejects.toThrow(SIGNUPS_CLOSED_MESSAGE);
    expect(repository.createOrgAndUser).not.toHaveBeenCalled();
  });

  it('lets the first organization register when registration is disabled', async () => {
    process.env.DISABLE_REGISTRATION = 'true';
    const { repository, service: org } = organization(0);
    const sendEmail = jest.fn();
    const users = { getUserByEmail: jest.fn().mockResolvedValue(null) };
    repository.createOrgAndUser.mockResolvedValue({
      users: [
        {
          user: {
            id: 'first-user',
            email: 'new.person@example.com',
            activated: false,
          },
        },
      ],
    });

    const created = await auth(org, users, undefined, { sendEmail }).routeAuth(
      Provider.LOCAL,
      localSignup(),
      '127.0.0.1',
      'jest'
    );

    expect(created.jwt).toEqual(expect.any(String));
    expect(repository.createOrgAndUser).toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalled();
  });

  it('creates an organization without an invite only when registration is open', async () => {
    process.env.DISABLE_REGISTRATION = 'false';
    const open = organization();
    open.repository.createOrgAndUser.mockResolvedValue({ id: 'org-1' });
    await expect(
      open.service.createOrgAndUser(
        {
          email: 'new@example.com',
          password: 'another-password',
          provider: Provider.LOCAL,
          company: 'Example',
          datafast_visitor_id: '',
        },
        '127.0.0.1',
        'jest'
      )
    ).resolves.toEqual({ id: 'org-1' });
    expect(open.repository.createOrgAndUser).toHaveBeenCalled();

    process.env.DISABLE_REGISTRATION = 'true';
    const closed = organization();
    await expect(
      closed.service.createOrgAndUser(
        {
          email: 'new@example.com',
          password: 'another-password',
          provider: Provider.LOCAL,
          company: 'Example',
          datafast_visitor_id: '',
        },
        '127.0.0.1',
        'jest'
      )
    ).rejects.toThrow(SIGNUPS_CLOSED_MESSAGE);
    expect(closed.repository.createOrgAndUser).not.toHaveBeenCalled();
  });

  it('lets an existing user log in', async () => {
    const { repository, service: org } = organization();
    const users = {
      getUserByEmail: jest.fn().mockResolvedValue({ ...existing }),
    };
    const body = Object.assign(new LoginUserDto(), {
      email: existing.email,
      password,
      provider: Provider.LOCAL,
    });

    const result = await auth(org, users).routeAuth(
      Provider.LOCAL,
      body,
      '127.0.0.1',
      'jest'
    );

    expect(result.jwt).toEqual(expect.any(String));
    expect(repository.createOrgAndUser).not.toHaveBeenCalled();
  });

  it('registers a new OAuth account and runs postRegistration when registration is open', async () => {
    process.env.DISABLE_REGISTRATION = 'false';
    const { repository, service: org } = organization();
    const postRegistration = jest.fn().mockResolvedValue(undefined);
    const users = {
      getUserByProvider: jest.fn().mockResolvedValue(null),
    };
    repository.createOrgAndUser.mockResolvedValue({
      id: 'org-google',
      users: [
        {
          user: {
            id: 'google-user',
            email: 'someone@example.com',
            activated: true,
          },
        },
      ],
    });
    const service = auth(org, users, {
      getProvider: () => ({
        getUser: async () => ({ id: 'google-1', email: 'someone@example.com' }),
        postRegistration,
      }),
    });
    const body = Object.assign(new CreateOrgUserDto(), {
      provider: Provider.GOOGLE,
      providerToken: 'token',
      company: 'Example',
    });

    const created = await service.routeAuth(
      Provider.GOOGLE,
      body,
      '127.0.0.1',
      'jest'
    );

    expect(created.jwt).toEqual(expect.any(String));
    expect(created.addedOrg).toBe(false);
    expect(repository.createOrgAndUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'someone@example.com',
        provider: Provider.GOOGLE,
        providerId: 'google-1',
      }),
      false,
      '127.0.0.1',
      'jest'
    );
    expect(repository.addUserToOrg).not.toHaveBeenCalled();
    expect(NewsletterService.register).toHaveBeenCalledWith(
      'someone@example.com'
    );
    expect(postRegistration).toHaveBeenCalledWith('token', 'org-google');
  });

  it('still registers when postRegistration fails', async () => {
    process.env.DISABLE_REGISTRATION = 'false';
    const { repository, service: org } = organization();
    const users = { getUserByProvider: jest.fn().mockResolvedValue(null) };
    repository.createOrgAndUser.mockResolvedValue({
      id: 'org-google',
      users: [
        {
          user: {
            id: 'google-user',
            email: 'someone@example.com',
            activated: true,
          },
        },
      ],
    });
    const service = auth(org, users, {
      getProvider: () => ({
        getUser: async () => ({ id: 'google-1', email: 'someone@example.com' }),
        postRegistration: async () => {
          throw new Error('provider hook failed');
        },
      }),
    });

    const created = await service.routeAuth(
      Provider.GOOGLE,
      Object.assign(new CreateOrgUserDto(), {
        provider: Provider.GOOGLE,
        providerToken: 'token',
        company: 'Example',
      }),
      '127.0.0.1',
      'jest'
    );

    expect(created.jwt).toEqual(expect.any(String));
    expect(repository.createOrgAndUser).toHaveBeenCalled();
  });

  it('rejects a new OAuth account and still logs in an existing one when registration is disabled', async () => {
    process.env.DISABLE_REGISTRATION = 'true';
    const { repository, service: org } = organization();
    const users = {
      getUserByProvider: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...existing, providerName: Provider.GOOGLE }),
    };
    const providerManager = {
      getProvider: () => ({
        getUser: async () => ({ id: 'google-1', email: 'someone@example.com' }),
      }),
    };
    const service = auth(org, users, providerManager);
    const body = Object.assign(new CreateOrgUserDto(), {
      provider: Provider.GOOGLE,
      providerToken: 'token',
      company: 'Example',
    });

    await expect(
      service.routeAuth(Provider.GOOGLE, body, '127.0.0.1', 'jest')
    ).rejects.toThrow(SIGNUPS_CLOSED_MESSAGE);

    const result = await service.routeAuth(
      Provider.GOOGLE,
      body,
      '127.0.0.1',
      'jest'
    );
    expect(result.jwt).toEqual(expect.any(String));
    expect(repository.createOrgAndUser).not.toHaveBeenCalled();
  });

  it('issues a registration token for a new provider when registration is open', async () => {
    process.env.DISABLE_REGISTRATION = 'false';
    const { service: org } = organization();
    const users = { getUserByProvider: jest.fn().mockResolvedValue(null) };
    const service = auth(org, users, {
      getProvider: () => ({
        getToken: async () => 'provider-token',
        getUser: async () => ({ id: 'google-2', email: 'new@example.com' }),
      }),
    });

    await expect(service.checkExists(Provider.GOOGLE, 'code')).resolves.toEqual(
      { token: 'provider-token' }
    );
  });

  it('rejects a new provider identity before issuing a registration token when registration is disabled', async () => {
    process.env.DISABLE_REGISTRATION = 'true';
    const { service: org } = organization();
    const users = { getUserByProvider: jest.fn().mockResolvedValue(null) };
    const service = auth(org, users, {
      getProvider: () => ({
        getToken: async () => 'provider-token',
        getUser: async () => ({ id: 'google-2', email: 'new@example.com' }),
      }),
    });

    await expect(
      service.checkExists(Provider.GOOGLE, 'code')
    ).rejects.toThrow(SIGNUPS_CLOSED_MESSAGE);
  });

  it('rejects the enterprise registration API and still adds a member from a valid invite', async () => {
    process.env.DISABLE_REGISTRATION = 'false';
    const { repository, service } = organization();
    const claims: OrganizationInviteClaims = {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'member@example.com',
      role: 'USER',
      orgId: 'org-1',
      token: 'invite-secret',
      timeLimit: '2099-01-01 00:00:00',
    };
    repository.getOrganizationInvite.mockResolvedValue(pendingInvite(claims));

    await expect(
      service.createMaxUser('ext-1', 'Reviewer', 'saas', 'new@example.com')
    ).rejects.toThrow(SIGNUPS_CLOSED_MESSAGE);
    expect(repository.createMaxUser).not.toHaveBeenCalled();

    await expect(
      service.addUserToOrg('user-1', claims.email, claims)
    ).resolves.toEqual({ organizationId: 'org-1' });
    expect(repository.addUserToOrg).toHaveBeenCalledWith(
      'user-1',
      claims.id,
      'org-1',
      'USER'
    );
  });

  it('lets an invited email register and an invited login join the org', async () => {
    process.env.DISABLE_REGISTRATION = 'true';
    const { repository, service: org } = organization();
    const claims: OrganizationInviteClaims = {
      id: '22222222-2222-4222-8222-222222222222',
      email: 'new.person@example.com',
      role: 'ADMIN',
      orgId: 'org-1',
      token: 'invite-secret',
      timeLimit: '2099-01-01 00:00:00',
    };
    repository.getOrganizationInvite.mockResolvedValue(pendingInvite(claims));
    repository.createOrgAndUser.mockResolvedValue({
      users: [
        {
          user: {
            id: 'new-user',
            email: claims.email,
            activated: true,
          },
        },
      ],
    });
    const users = { getUserByEmail: jest.fn().mockResolvedValue(null) };
    const sendEmail = jest.fn();
    const body = Object.assign(new CreateOrgUserDto(), {
      email: 'New.Person@example.com',
      password: 'another-password',
      provider: Provider.LOCAL,
      company: 'Example',
    });

    const created = await auth(org, users, undefined, { sendEmail }).routeAuth(
      Provider.LOCAL,
      body,
      '127.0.0.1',
      'jest',
      claims
    );
    expect(created.jwt).toEqual(expect.any(String));
    expect(repository.createOrgAndUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: claims.email }),
      false,
      '127.0.0.1',
      'jest'
    );
    expect(sendEmail).not.toHaveBeenCalled();
    expect(repository.addUserToOrg).toHaveBeenCalledWith(
      'new-user',
      claims.id,
      'org-1',
      'ADMIN'
    );

    repository.addUserToOrg.mockClear();
    const loginClaims = { ...claims, email: existing.email, role: 'USER' as const };
    repository.getOrganizationInvite.mockResolvedValue(pendingInvite(loginClaims));
    const loginUsers = {
      getUserByEmail: jest.fn().mockResolvedValue({ ...existing }),
    };
    const login = await auth(org, loginUsers).routeAuth(
      Provider.LOCAL,
      Object.assign(new LoginUserDto(), {
        email: existing.email,
        password,
        provider: Provider.LOCAL,
      }),
      '127.0.0.1',
      'jest',
      loginClaims
    );
    expect(login.addedOrg).toEqual({ organizationId: 'org-1' });
    expect(repository.addUserToOrg).toHaveBeenCalledWith(
      existing.id,
      loginClaims.id,
      'org-1',
      'USER'
    );
  });

  it('lets a matching Google invite past closed sign-ups and blocks a different email', async () => {
    process.env.DISABLE_REGISTRATION = 'true';
    const { repository, service: org } = organization();
    const claims: OrganizationInviteClaims = {
      id: '33333333-3333-4333-8333-333333333333',
      email: 'someone@example.com',
      role: 'USER',
      orgId: 'org-1',
      token: 'invite-secret',
      timeLimit: '2099-01-01 00:00:00',
    };
    repository.getOrganizationInvite.mockResolvedValue(pendingInvite(claims));
    repository.createOrgAndUser.mockResolvedValue({
      users: [
        {
          user: {
            id: 'google-user',
            email: claims.email,
            activated: true,
          },
        },
      ],
    });
    const users = {
      getUserByProvider: jest.fn().mockResolvedValue(null),
    };
    const postRegistration = jest.fn();
    const providerManager = {
      getProvider: () => ({
        getToken: async () => 'provider-token',
        getUser: async () => ({ id: 'google-1', email: 'someone@example.com' }),
        postRegistration,
      }),
    };
    const service = auth(org, users, providerManager);
    const body = Object.assign(new CreateOrgUserDto(), {
      provider: Provider.GOOGLE,
      providerToken: 'token',
      company: 'Example',
    });

    const created = await service.routeAuth(
      Provider.GOOGLE,
      body,
      '127.0.0.1',
      'jest',
      claims
    );
    expect(created.jwt).toEqual(expect.any(String));
    expect(repository.createOrgAndUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: claims.email,
        provider: Provider.GOOGLE,
      }),
      false,
      '127.0.0.1',
      'jest'
    );
    expect(postRegistration).not.toHaveBeenCalled();
    expect(NewsletterService.register).not.toHaveBeenCalled();

    repository.createOrgAndUser.mockClear();
    await expect(
      service.routeAuth(
        Provider.GOOGLE,
        body,
        '127.0.0.1',
        'jest',
        { ...claims, email: 'other@example.com' }
      )
    ).rejects.toThrow('This invite is for a different email');
    expect(repository.createOrgAndUser).not.toHaveBeenCalled();

    const cookie = Password.signJWT(claims);
    const opened = await service.checkExists(
      Provider.GOOGLE,
      'code',
      undefined,
      undefined,
      undefined,
      cookie
    );
    expect(opened).toEqual({ token: 'provider-token' });
  });
});
