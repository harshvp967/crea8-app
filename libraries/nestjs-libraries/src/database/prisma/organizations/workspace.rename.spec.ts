jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/notifications/notification.service',
  () => ({
    NotificationService: class NotificationService {},
  })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/autopost/autopost.service',
  () => ({
    AutopostService: class AutopostService {},
  })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/subscriptions/entitlement.service',
  () => ({
    EntitlementService: class EntitlementService {},
  })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service',
  () => ({
    SubscriptionService: class SubscriptionService {},
  })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/subscriptions/credits.service',
  () => ({
    CreditsService: class CreditsService {},
  })
);
jest.mock('@gitroom/nestjs-libraries/services/payment/payment.service', () => ({
  PaymentService: class PaymentService {},
}));
jest.mock('@gitroom/nestjs-libraries/database/prisma/users/users.service', () => ({
  UsersService: class UsersService {},
}));
jest.mock('@gitroom/nestjs-libraries/track/track.service', () => ({
  TrackService: class TrackService {},
}));
jest.mock('@gitroom/backend/services/auth/auth.service', () => ({
  AuthService: class AuthService {},
}));
jest.mock('@gitroom/nestjs-libraries/services/email.service', () => ({
  EmailService: class EmailService {},
}));
jest.mock('@gitroom/nestjs-libraries/services/exception.filter', () => {
  const { HttpException } = require('@nestjs/common');
  class HttpForbiddenException extends HttpException {
    constructor() {
      super('Forbidden', 403);
    }
  }
  return {
    HttpForbiddenException,
    HttpExceptionFilter: class HttpExceptionFilter {},
  };
});
jest.mock('@gitroom/nestjs-libraries/chat/mastra.service', () => ({
  MastraService: class MastraService {},
}));
jest.mock('nestjs-temporal-core', () => ({
  TemporalService: class TemporalService {},
}));

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RenameWorkspaceDto } from '@gitroom/nestjs-libraries/dtos/users/rename.workspace.dto';
import { OrganizationRepository } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.repository';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { UsersController } from '@gitroom/backend/api/routes/users.controller';

describe('rename workspace', () => {
  function service() {
    const repository = {
      getOrgMember: jest.fn(),
      renameWorkspace: jest
        .fn()
        .mockResolvedValue({ id: 'org-1', name: 'Studio' }),
    };
    return {
      repository,
      organization: new OrganizationService(
        repository as never,
        {} as never,
        {} as never
      ),
    };
  }

  function controller(orgService: { renameWorkspace: jest.Mock }) {
    return new UsersController(
      {} as never,
      {} as never,
      {} as never,
      orgService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );
  }

  it('accepts a workspace name and rejects a blank or oversized one', async () => {
    const valid = plainToInstance(RenameWorkspaceDto, { name: 'Studio' });
    expect(await validate(valid)).toEqual([]);

    const blank = plainToInstance(RenameWorkspaceDto, { name: '' });
    expect(await validate(blank)).not.toEqual([]);

    const huge = plainToInstance(RenameWorkspaceDto, { name: 'a'.repeat(129) });
    expect(await validate(huge)).not.toEqual([]);

    const missing = plainToInstance(RenameWorkspaceDto, {});
    expect(await validate(missing)).not.toEqual([]);
  });

  it('lets the owner rename the current workspace', async () => {
    const { repository, organization } = service();
    repository.getOrgMember.mockResolvedValue({ role: 'SUPERADMIN' });

    await expect(
      organization.renameWorkspace('org-1', 'user-1', 'Studio')
    ).resolves.toEqual({ id: 'org-1', name: 'Studio' });

    expect(repository.getOrgMember).toHaveBeenCalledWith('org-1', 'user-1');
    expect(repository.renameWorkspace).toHaveBeenCalledWith('org-1', 'Studio');
  });

  it('refuses a non-owner and does not write a name', async () => {
    const { repository, organization } = service();

    for (const role of ['ADMIN', 'USER', null]) {
      repository.getOrgMember.mockResolvedValue(role ? { role } : null);
      repository.renameWorkspace.mockClear();

      await expect(
        organization.renameWorkspace('org-1', 'user-2', 'Studio')
      ).rejects.toMatchObject({
        message: 'Only the workspace owner can rename it',
        status: 403,
      });
      expect(repository.renameWorkspace).not.toHaveBeenCalled();
    }
  });

  it('returns 404 when the current workspace is already gone', async () => {
    const { repository, organization } = service();
    repository.getOrgMember.mockResolvedValue({ role: 'SUPERADMIN' });
    repository.renameWorkspace.mockRejectedValue({ code: 'P2025' });

    await expect(
      organization.renameWorkspace('org-1', 'user-1', 'Studio')
    ).rejects.toMatchObject({
      message: 'Workspace not found',
      status: 404,
    });
  });

  it('writes only the name of that workspace', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'org-1', name: 'Studio' });
    const repository = new OrganizationRepository(
      { model: { organization: { update } } } as never,
      {} as never,
      {} as never,
      {} as never
    );

    await expect(repository.renameWorkspace('org-1', 'Studio')).resolves.toEqual({
      id: 'org-1',
      name: 'Studio',
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'org-1', deletedAt: null },
      data: { name: 'Studio' },
      select: { id: true, name: true },
    });
  });

  it('renames only the signed-in workspace and rejects a blank name', async () => {
    const renameWorkspace = jest
      .fn()
      .mockResolvedValue({ id: 'org-current', name: 'Studio' });
    const users = controller({ renameWorkspace });

    await expect(
      users.renameWorkspace(
        { id: 'user-1' } as never,
        { id: 'org-current' } as never,
        { name: '  Studio  ' } as never
      )
    ).resolves.toEqual({ id: 'org-current', name: 'Studio' });
    expect(renameWorkspace).toHaveBeenCalledWith(
      'org-current',
      'user-1',
      'Studio'
    );

    await expect(
      users.renameWorkspace(
        { id: 'user-1' } as never,
        { id: 'org-current' } as never,
        { name: '   ' } as never
      )
    ).rejects.toMatchObject({
      message: 'Enter a workspace name',
      status: 400,
    });
    expect(renameWorkspace).toHaveBeenCalledTimes(1);
  });
});
