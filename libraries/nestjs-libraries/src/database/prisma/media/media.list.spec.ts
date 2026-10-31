import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { GetMediaQueryDto } from '@gitroom/nestjs-libraries/dtos/media/get.media.dto';
import {
  MEDIA_PAGE_SIZE,
  MediaRepository,
  mediaTypeFilter,
} from '@gitroom/nestjs-libraries/database/prisma/media/media.repository';

jest.mock('@gitroom/nestjs-libraries/upload/custom.upload.validation', () => ({
  getMaxSize: () => 1,
  uploadStreamToStorage: jest.fn(),
}));

jest.mock('@gitroom/nestjs-libraries/upload/upload.factory', () => ({
  UploadFactory: {
    createStorage: () => ({}),
    createProcessor: () => null,
  },
}));

jest.mock('@gitroom/nestjs-libraries/upload/media.deliver', () => ({
  presentMediaRecord: jest.fn(async (row) =>
    row ? { ...row, presented: true } : row
  ),
}));

jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service',
  () => ({
    SubscriptionService: class SubscriptionService {},
  })
);

jest.mock('@gitroom/nestjs-libraries/openai/openai.service', () => ({
  OpenaiService: class OpenaiService {},
}));

jest.mock('@gitroom/nestjs-libraries/videos/video.manager', () => ({
  VideoManager: class VideoManager {},
}));

jest.mock('nestjs-temporal-core', () => ({
  TemporalService: class TemporalService {},
}));

import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';

const IMAGE_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'avif',
  'svg',
  'bmp',
  'tif',
  'tiff',
];
const VIDEO_EXTENSIONS = ['mp4', 'mov'];
const NAME_FIELDS = ['path', 'name', 'originalName'];

function repository() {
  const count = jest.fn().mockResolvedValue(0);
  const findMany = jest.fn().mockResolvedValue([]);
  const repo = new MediaRepository(
    { model: { media: { count, findMany } } } as any,
    {} as any,
    {} as any,
    {} as any
  );
  return { repo, count, findMany };
}

function listedWhere(call: jest.Mock) {
  return call.mock.calls[0][0].where;
}

function extensionClauses(where: { OR?: object[] }) {
  return where.OR || [];
}

describe('media list type filter', () => {
  it('accepts all, image, video, and an omitted type', async () => {
    for (const type of [undefined, 'all', 'image', 'video']) {
      const dto = plainToInstance(
        GetMediaQueryDto,
        type ? { type, page: '1', search: 'reel' } : { page: '1' }
      );
      expect(await validate(dto)).toEqual([]);
      expect(dto.type).toBe(type);
    }
  });

  it('rejects a type the library does not have', async () => {
    const dto = plainToInstance(GetMediaQueryDto, { type: 'audio' });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toContain('type');
  });

  it('leaves the query unchanged for all and for callers that omit type', async () => {
    expect(mediaTypeFilter(undefined)).toEqual({});
    expect(mediaTypeFilter('all')).toEqual({});

    for (const type of [undefined, 'all'] as const) {
      const { repo, count, findMany } = repository();
      count.mockResolvedValue(18);
      await repo.getMedia('org-1', 1, undefined, type);

      expect(listedWhere(count)).toEqual({
        organization: { id: 'org-1' },
        deletedAt: null,
        status: { not: 'processing' },
      });
      expect(listedWhere(findMany)).toEqual({
        organizationId: 'org-1',
        deletedAt: null,
        status: { not: 'processing' },
      });
      expect(listedWhere(count)).not.toHaveProperty('type');
      expect(listedWhere(count)).not.toHaveProperty('OR');
    }
  });

  it('filters images and videos by file extension, not the unused type column', async () => {
    const image = mediaTypeFilter('image');
    const video = mediaTypeFilter('video');

    expect(extensionClauses(image)).toHaveLength(IMAGE_EXTENSIONS.length * NAME_FIELDS.length);
    expect(extensionClauses(video)).toHaveLength(VIDEO_EXTENSIONS.length * NAME_FIELDS.length);

    for (const ext of IMAGE_EXTENSIONS) {
      for (const field of NAME_FIELDS) {
        expect(extensionClauses(image)).toContainEqual({
          [field]: { endsWith: `.${ext}`, mode: 'insensitive' },
        });
      }
    }
    for (const ext of VIDEO_EXTENSIONS) {
      for (const field of NAME_FIELDS) {
        expect(extensionClauses(video)).toContainEqual({
          [field]: { endsWith: `.${ext}`, mode: 'insensitive' },
        });
      }
    }
    expect(JSON.stringify(image)).not.toContain('.mp4');
    expect(JSON.stringify(video)).not.toContain('.png');
    expect(image).not.toHaveProperty('type');
    expect(video).not.toHaveProperty('type');

    const { repo, count, findMany } = repository();
    await repo.getMedia('org-1', 1, undefined, 'video');
    expect(listedWhere(count).OR).toEqual(video.OR);
    expect(listedWhere(findMany).OR).toEqual(video.OR);
    expect(listedWhere(count)).not.toHaveProperty('type');
    expect(listedWhere(findMany)).not.toHaveProperty('type');
  });

  it('combines search with the type filter on both the count and the page', async () => {
    const { repo, count, findMany } = repository();
    count.mockResolvedValue(4);
    findMany.mockResolvedValue([{ id: 'clip-1' }]);

    const data = await repo.getMedia('org-1', 1, '  Diwali  ', 'image');

    const search = {
      originalName: { contains: 'Diwali', mode: 'insensitive' },
    };
    expect(listedWhere(count)).toMatchObject({
      organization: { id: 'org-1' },
      deletedAt: null,
      ...search,
    });
    expect(listedWhere(count).OR).toEqual(mediaTypeFilter('image').OR);
    expect(listedWhere(findMany)).toMatchObject({
      organizationId: 'org-1',
      deletedAt: null,
      ...search,
    });
    expect(listedWhere(findMany).OR).toEqual(mediaTypeFilter('image').OR);
    expect(data.pages).toBe(1);
    expect(data.results).toEqual([{ id: 'clip-1' }]);
  });

  it('counts pages from the filtered total', async () => {
    const { repo, count, findMany } = repository();
    count.mockResolvedValue(37);

    const data = await repo.getMedia('org-1', 3, 'bts', 'video');

    expect(data.pages).toBe(Math.ceil(37 / MEDIA_PAGE_SIZE));
    expect(data.pages).toBe(3);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 2 * MEDIA_PAGE_SIZE,
        take: MEDIA_PAGE_SIZE,
      })
    );
    expect(listedWhere(count).OR).toEqual(mediaTypeFilter('video').OR);
    expect(listedWhere(count).originalName).toEqual({
      contains: 'bts',
      mode: 'insensitive',
    });

    const empty = repository();
    empty.count.mockResolvedValue(0);
    await expect(empty.repo.getMedia('org-1', 1, undefined, 'image')).resolves.toEqual({
      pages: 0,
      results: [],
    });
    expect(empty.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: MEDIA_PAGE_SIZE })
    );
  });
});

describe('MediaService.getMedia', () => {
  function serviceWith(getMedia: jest.Mock) {
    return new MediaService(
      { getMedia } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
  }

  it('passes type through and keeps the filtered page count', async () => {
    const getMedia = jest.fn().mockResolvedValue({
      pages: 3,
      results: [{ id: 'clip-1', path: 'bts-clip.mp4' }],
    });
    const service = serviceWith(getMedia);

    await expect(service.getMedia('org-1', 2, 'bts', 'video')).resolves.toEqual({
      pages: 3,
      results: [{ id: 'clip-1', path: 'bts-clip.mp4', presented: true }],
    });
    expect(getMedia).toHaveBeenCalledWith('org-1', 2, 'bts', 'video');
  });

  it('leaves type unset when the caller does not send one', async () => {
    const getMedia = jest.fn().mockResolvedValue({ pages: 1, results: [] });
    const service = serviceWith(getMedia);

    await expect(service.getMedia('org-1', 1, 'reel')).resolves.toEqual({
      pages: 1,
      results: [],
    });
    expect(getMedia).toHaveBeenCalledWith('org-1', 1, 'reel', undefined);
  });
});
