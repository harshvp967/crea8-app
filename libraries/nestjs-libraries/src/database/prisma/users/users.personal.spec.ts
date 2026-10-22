import { HttpException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UserDetailDto } from '@gitroom/nestjs-libraries/dtos/users/user.details.dto';
import { UsersRepository } from '@gitroom/nestjs-libraries/database/prisma/users/users.repository';

jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/integrations/integration.repository',
  () => ({
    IntegrationRepository: class IntegrationRepository {},
  })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/organizations/organization.repository',
  () => ({
    OrganizationRepository: class OrganizationRepository {},
  })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/notifications/notification.service',
  () => ({
    NotificationService: class NotificationService {},
  })
);
jest.mock('@gitroom/nestjs-libraries/upload/media.deliver', () => ({
  presentMediaRecord: jest.fn(async (row) => ({
    ...row,
    path: `view:${row.path}`,
  })),
}));

import { presentMediaRecord } from '@gitroom/nestjs-libraries/upload/media.deliver';
import { UsersService } from '@gitroom/nestjs-libraries/database/prisma/users/users.service';

const libraryPicture: {
  id: string;
  path: string;
  thumbnail: string | null;
  alt: string | null;
  name: string;
} = {
  id: 'media-1',
  path: 'https://account.r2.cloudflarestorage.com/bucket/photo.jpg?X-Amz-Signature=abc',
  thumbnail: null,
  alt: null,
  name: 'photo.jpg',
};

describe('profile picture save', () => {
  it('accepts the media library picture on the profile payload', async () => {
    const dto = plainToInstance(UserDetailDto, {
      fullname: 'Ada Lovelace',
      bio: '',
      picture: libraryPicture,
    });
    const errors = await validate(dto);

    expect(errors).toEqual([]);
    expect(dto.picture?.id).toBe('media-1');
  });

  it('accepts clearing the picture', async () => {
    const dto = plainToInstance(UserDetailDto, {
      fullname: 'Ada Lovelace',
      bio: '',
      picture: null,
    });

    expect(await validate(dto)).toEqual([]);
    expect(dto.picture).toBeNull();
  });

  it('stores the media id when the file belongs to the user', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'user-1' });
    const update = jest.fn().mockResolvedValue({});
    const repository = new UsersRepository(
      { model: { user: { findFirst, update } } } as any,
      {} as any
    );

    await repository.changePersonal('user-1', {
      fullname: 'Ada Lovelace',
      bio: '',
      picture: { id: 'media-1' },
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
        deletedAt: null,
        organizations: {
          some: {
            disabled: false,
            organization: {
              deletedAt: null,
              media: { some: { id: 'media-1', deletedAt: null } },
            },
          },
        },
      },
      select: { id: true },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        name: 'Ada Lovelace',
        bio: '',
        pictureId: 'media-1',
      },
    });
  });

  it('does not attach a picture from outside the user organizations', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const update = jest.fn();
    const repository = new UsersRepository(
      { model: { user: { findFirst, update } } } as any,
      {} as any
    );

    await expect(
      repository.changePersonal('user-1', {
        fullname: 'Ada Lovelace',
        bio: '',
        picture: { id: 'other-org-media' },
      })
    ).rejects.toBeInstanceOf(HttpException);
    expect(update).not.toHaveBeenCalled();
  });

  it('clears the saved picture when the profile photo is removed', async () => {
    const findFirst = jest.fn();
    const update = jest.fn().mockResolvedValue({});
    const repository = new UsersRepository(
      { model: { user: { findFirst, update } } } as any,
      {} as any
    );

    await repository.changePersonal('user-1', {
      fullname: 'Ada Lovelace',
      bio: '',
      picture: null,
    });

    expect(findFirst).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        name: 'Ada Lovelace',
        bio: '',
        pictureId: null,
      },
    });
  });

  it('returns a readable picture after save', async () => {
    const saved = {
      id: 'user-1',
      name: 'Ada Lovelace',
      bio: '',
      picture: { id: 'media-1', path: 'https://media.example/photo.jpg' },
    };
    const repository = {
      changePersonal: jest.fn().mockResolvedValue(undefined),
      getPersonal: jest.fn().mockResolvedValue(saved),
    };
    const service = new UsersService(
      repository as any,
      {} as any,
      {} as any,
      {} as any
    );

    const result = await service.changePersonal('user-1', {
      fullname: 'Ada Lovelace',
      bio: '',
      picture: { id: 'media-1' },
    });

    expect(repository.changePersonal).toHaveBeenCalledWith('user-1', {
      fullname: 'Ada Lovelace',
      bio: '',
      picture: { id: 'media-1' },
    });
    expect(presentMediaRecord).toHaveBeenCalledWith(saved.picture);
    expect(result?.picture?.path).toBe('view:https://media.example/photo.jpg');
  });
});
