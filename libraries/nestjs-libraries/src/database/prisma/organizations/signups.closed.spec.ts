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
import { SIGNUPS_CLOSED_MESSAGE } from '@gitroom/nestjs-libraries/database/prisma/organizations/signups.closed';

describe('closed sign-ups', () => {
  const previousSecret = process.env.JWT_SECRET;
  const previousSecured = process.env.NOT_SECURED;
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
  });

  function organization() {
    const repository = {
      createOrgAndUser: jest.fn(),
      createMaxUser: jest.fn(),
      addUserToOrg: jest.fn().mockResolvedValue({ organizationId: 'org-1' }),
    };
    const service = new OrganizationService(repository as never, {
      hasEmailProvider: () => false,
    } as never);
    return { repository, service };
  }

  function auth(org: OrganizationService, users: Record<string, unknown>, providerManager?: Record<string, unknown>) {
    return new AuthService(
      users as never,
      org,
      {} as never,
      { hasProvider: () => false, sendEmail: jest.fn() } as never,
      (providerManager || {}) as never
    );
  }

  it('rejects a new email on email/password registration', async () => {
    const { repository, service: org } = organization();
    const users = { getUserByEmail: jest.fn().mockResolvedValue(null) };
    const body = Object.assign(new CreateOrgUserDto(), {
      email: 'New.Person@example.com',
      password: 'another-password',
      provider: Provider.LOCAL,
      company: 'Example',
    });

    await expect(
      auth(org, users).routeAuth(Provider.LOCAL, body, '127.0.0.1', 'jest')
    ).rejects.toThrow(SIGNUPS_CLOSED_MESSAGE);
    expect(repository.createOrgAndUser).not.toHaveBeenCalled();
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

  it('rejects a new OAuth account and still logs in an existing one', async () => {
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

  it('rejects a new provider identity before issuing a registration token', async () => {
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

  it('rejects the enterprise registration API and still adds an existing member', async () => {
    const { repository, service } = organization();

    await expect(
      service.createMaxUser('ext-1', 'Reviewer', 'saas', 'new@example.com')
    ).rejects.toThrow(SIGNUPS_CLOSED_MESSAGE);
    expect(repository.createMaxUser).not.toHaveBeenCalled();

    await expect(
      service.addUserToOrg('user-1', 'invite-1', 'org-1', 'USER')
    ).resolves.toEqual({ organizationId: 'org-1' });
    expect(repository.addUserToOrg).toHaveBeenCalledWith(
      'user-1',
      'invite-1',
      'org-1',
      'USER'
    );
  });
});
