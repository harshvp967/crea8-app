jest.mock('@gitroom/nestjs-libraries/integrations/integration.manager', () => ({
  IntegrationManager: class IntegrationManager {},
}));
jest.mock('@gitroom/helpers/auth/auth.service', () => ({
  AuthService: class AuthService {
    static comparePassword() {
      return false;
    }
    static hashPassword() {
      return 'hash';
    }
  },
}));
jest.mock('@gitroom/nestjs-libraries/services/email.service', () => ({
  EmailService: class EmailService {},
}));

import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LinkController } from '@gitroom/backend/api/routes/link.controller';
import { DeleteLinkLeadDto } from '@gitroom/nestjs-libraries/dtos/link-in-bio/link.dto';
import { LinkRepository } from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.repository';
import { LinkService } from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.service';

const ownId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';

describe('delete a link-in-bio lead', () => {
  function service(repository: {
    memberRole: jest.Mock;
    deleteLead: jest.Mock;
  }) {
    return new LinkService(repository as never, {} as never, {} as never, {} as never);
  }

  it('rejects a lead id that is not a uuid', async () => {
    expect(await validate(plainToInstance(DeleteLinkLeadDto, { id: 'lead-1' }))).not.toEqual([]);
    expect(await validate(plainToInstance(DeleteLinkLeadDto, { id: '' }))).not.toEqual([]);
    expect(await validate(plainToInstance(DeleteLinkLeadDto, {}))).not.toEqual([]);
    expect(await validate(plainToInstance(DeleteLinkLeadDto, { id: ownId }))).toEqual([]);
  });

  it('lets the owner delete one lead in their workspace and leaves another workspace untouched', async () => {
    const leads = [
      { id: ownId, organizationId: 'org-1' },
      { id: otherId, organizationId: 'org-2' },
    ];
    const repository = {
      memberRole: jest.fn().mockResolvedValue({ role: 'SUPERADMIN', disabled: false }),
      deleteLead: jest.fn(async (organizationId: string, id: string) => {
        const index = leads.findIndex(
          (lead) => lead.id === id && lead.organizationId === organizationId
        );
        if (index < 0) {
          return { count: 0 };
        }
        leads.splice(index, 1);
        return { count: 1 };
      }),
    };

    await expect(service(repository).deleteLead('org-1', 'owner-1', ownId)).resolves.toEqual({
      id: ownId,
    });
    expect(repository.memberRole).toHaveBeenCalledWith('org-1', 'owner-1');
    expect(repository.deleteLead).toHaveBeenCalledWith('org-1', ownId);
    expect(leads).toEqual([{ id: otherId, organizationId: 'org-2' }]);

    await expect(service(repository).deleteLead('org-1', 'owner-1', otherId)).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(leads).toEqual([{ id: otherId, organizationId: 'org-2' }]);
  });

  it('refuses a non-owner and does not delete a lead', async () => {
    for (const member of [
      { role: 'ADMIN', disabled: false },
      { role: 'USER', disabled: false },
      { role: 'SUPERADMIN', disabled: true },
      null,
    ]) {
      const repository = {
        memberRole: jest.fn().mockResolvedValue(member),
        deleteLead: jest.fn(),
      };
      await expect(service(repository).deleteLead('org-1', 'user-2', ownId)).rejects.toMatchObject({
        message: 'Only the workspace owner can delete a lead',
        status: 403,
      });
      expect(repository.deleteLead).not.toHaveBeenCalled();
    }
  });

  it('deletes only a lead whose page belongs to the signed-in workspace', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const repository = new LinkRepository(
      {} as never,
      {} as never,
      {} as never,
      { model: { linkLead: { deleteMany } } } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );

    await expect(repository.deleteLead('org-1', ownId)).resolves.toEqual({ count: 1 });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: ownId, page: { organizationId: 'org-1' } },
    });
  });

  it('passes the signed-in workspace and user to the delete', async () => {
    const deleteLead = jest.fn().mockResolvedValue({ id: ownId });
    const controller = new LinkController({ deleteLead } as never);

    await expect(
      controller.deleteLead({ id: 'owner-1' } as never, { id: 'org-1' } as never, { id: ownId })
    ).resolves.toEqual({ id: ownId });
    expect(deleteLead).toHaveBeenCalledWith('org-1', 'owner-1', ownId);
  });
});
