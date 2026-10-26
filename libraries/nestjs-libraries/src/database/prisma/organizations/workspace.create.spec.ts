jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service',
  () => ({
    SubscriptionService: class SubscriptionService {},
  })
);
jest.mock('@gitroom/nestjs-libraries/services/payment/payment.service', () => ({
  PaymentService: class PaymentService {},
}));
jest.mock('@gitroom/nestjs-libraries/integrations/integration.manager', () => ({
  IntegrationManager: class IntegrationManager {},
}));
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/integrations/integration.repository',
  () => ({
    IntegrationRepository: class IntegrationRepository {},
  })
);
jest.mock(
  '@gitroom/nestjs-libraries/integrations/refresh.integration.service',
  () => ({
    RefreshIntegrationService: class RefreshIntegrationService {},
  })
);
jest.mock('@gitroom/nestjs-libraries/upload/upload.factory', () => ({
  UploadFactory: {
    createStorage: () => ({}),
  },
}));
jest.mock('nestjs-temporal-core', () => ({
  TemporalService: class TemporalService {},
}));
jest.mock('@gitroom/nestjs-libraries/services/email.service', () => ({
  EmailService: class EmailService {},
}));

import { HttpException } from '@nestjs/common';
import { UsersController } from '@gitroom/backend/api/routes/users.controller';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { workspaceCreateInput } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.repository';

describe('create workspace', () => {
  const previousSecured = process.env.NOT_SECURED;
  const previousFront = process.env.FRONTEND_URL;

  beforeAll(() => {
    process.env.NOT_SECURED = 'true';
    process.env.FRONTEND_URL = 'https://app.crea8.one';
  });

  afterAll(() => {
    process.env.NOT_SECURED = previousSecured;
    process.env.FRONTEND_URL = previousFront;
  });

  it('makes the creator Super Admin and does not assign a subscription', () => {
    const data = workspaceCreateInput('user-1', 'Studio', 'encrypted-key');
    expect(data.users.create).toEqual({
      role: 'SUPERADMIN',
      userId: 'user-1',
    });
    expect(data.name).toBe('Studio');
    expect(data.allowTrial).toBe(true);
    expect(data.isTrailing).toBe(true);
    expect(data).not.toHaveProperty('subscription');
  });

  it('creates the org for the signed-in user and switches to it', async () => {
    const orgService = {
      createWorkspace: jest.fn().mockResolvedValue({ id: 'org-9', name: 'Studio' }),
    };
    const controller = new UsersController(
      {} as never,
      {} as never,
      {} as never,
      orgService as never,
      {} as never,
      {} as never
    );
    const response = {
      cookie: jest.fn(),
      header: jest.fn(),
    };

    const created = await controller.createWorkspace(
      { id: 'user-1' } as never,
      { name: '  Studio  ' } as never,
      response as never
    );

    expect(orgService.createWorkspace).toHaveBeenCalledWith('user-1', 'Studio');
    expect(created).toEqual({ id: 'org-9', name: 'Studio' });
    expect(response.cookie).toHaveBeenCalledWith(
      'showorg',
      'org-9',
      expect.objectContaining({ expires: expect.any(Date) })
    );
    expect(response.header).toHaveBeenCalledWith('showorg', 'org-9');

    await expect(
      controller.createWorkspace(
        { id: 'user-1' } as never,
        { name: '   ' } as never,
        response as never
      )
    ).rejects.toBeInstanceOf(HttpException);
  });
});

describe('customer rename', () => {
  function service() {
    const repository = {
      getIntegrationById: jest.fn(),
      updateOnCustomerName: jest.fn().mockResolvedValue({ id: 'channel-1' }),
    };
    return {
      repository,
      integration: new IntegrationService(
        repository as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never
      ),
    };
  }

  it('renames the customer on a channel in this org', async () => {
    const { repository, integration } = service();
    repository.getIntegrationById.mockResolvedValue({ id: 'channel-1' });

    await expect(
      integration.updateOnCustomerName('org-1', 'channel-1', 'Northwind')
    ).resolves.toEqual({ id: 'channel-1' });
    expect(repository.updateOnCustomerName).toHaveBeenCalledWith(
      'org-1',
      'channel-1',
      'Northwind'
    );
  });

  it('returns 404 when the channel is not in the org', async () => {
    const { repository, integration } = service();
    repository.getIntegrationById.mockResolvedValue(null);

    await expect(
      integration.updateOnCustomerName('org-1', 'other-org-channel', 'Northwind')
    ).rejects.toMatchObject({
      message: 'Channel not found',
      status: 404,
    });
    expect(repository.updateOnCustomerName).not.toHaveBeenCalled();
  });
});
