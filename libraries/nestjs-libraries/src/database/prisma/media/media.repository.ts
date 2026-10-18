import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SaveMediaInformationDto } from '@gitroom/nestjs-libraries/dtos/media/save.media.information.dto';
import { MediaListType } from '@gitroom/nestjs-libraries/dtos/media/get.media.dto';
import {
  canonicalizeStoredMedia,
  isSafeUploadRelative,
  mentionsUploadRelative,
} from '@gitroom/nestjs-libraries/upload/media.access';

export const MEDIA_PAGE_SIZE = 18;

// The Media.type column defaults to "image" and saveFile never writes it, so
// it cannot tell a video from a picture. There is no mime column. Videos are
// recognized by extension, the same way the library and the uploader do:
// mp4 (and mov, which the normalizer turns into mp4) are video; the image
// extensions below are the picture formats the page and the upload allow-list
// accept. Anything else stays in All.
const MEDIA_IMAGE_EXTENSIONS = [
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
const MEDIA_VIDEO_EXTENSIONS = ['mp4', 'mov'];
const MEDIA_NAME_FIELDS = ['path', 'name', 'originalName'] as const;

export function mediaTypeFilter(type?: MediaListType): Prisma.MediaWhereInput {
  if (!type || type === 'all') {
    return {};
  }
  const extensions =
    type === 'video' ? MEDIA_VIDEO_EXTENSIONS : MEDIA_IMAGE_EXTENSIONS;
  return {
    OR: extensions.flatMap((ext) =>
      MEDIA_NAME_FIELDS.map((field) => ({
        [field]: { endsWith: `.${ext}`, mode: 'insensitive' as const },
      }))
    ),
  };
}

@Injectable()
export class MediaRepository {
  constructor(
    private _media: PrismaRepository<'media'>,
    private _post: PrismaRepository<'post'>,
    private _linkPage: PrismaRepository<'linkPage'>,
    private _linkBlock: PrismaRepository<'linkBlock'>
  ) {}

  saveFile(org: string, fileName: string, filePath: string, originalName?: string) {
    return this._media.model.media.create({
      data: {
        organization: {
          connect: {
            id: org,
          },
        },
        name: fileName,
        path: canonicalizeStoredMedia(filePath),
        originalName: originalName || null,
      },
      select: {
        id: true,
        name: true,
        originalName: true,
        path: true,
        thumbnail: true,
        alt: true,
        status: true,
      },
    });
  }

  startProcessing(org: string, id: string) {
    return this._media.model.media.update({
      where: { id, organizationId: org },
      data: { status: 'processing', processingError: null },
      select: { id: true, status: true },
    });
  }

  finishProcessing(
    org: string,
    id: string,
    data: { name?: string; path?: string; fileSize?: number; error?: string }
  ) {
    return this._media.model.media.update({
      where: { id, organizationId: org },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.path ? { path: data.path } : {}),
        ...(data.fileSize ? { fileSize: data.fileSize } : {}),
        status: data.error ? 'failed' : 'ready',
        processingError: data.error || null,
      },
      select: { id: true, status: true },
    });
  }

  getMediaStatus(org: string, id: string) {
    return this._media.model.media.findFirst({
      where: {
        id,
        organizationId: org,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        originalName: true,
        path: true,
        thumbnail: true,
        alt: true,
        status: true,
        processingError: true,
      },
    });
  }

  getMediaById(id: string) {
    return this._media.model.media.findUnique({
      where: {
        id,
      },
    });
  }

  deleteMedia(org: string, id: string) {
    return this._media.model.media.update({
      where: {
        id,
        organizationId: org,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  saveMediaInformation(org: string, data: SaveMediaInformationDto) {
    return this._media.model.media.update({
      where: {
        id: data.id,
        organizationId: org,
      },
      data: {
        alt: data.alt,
        thumbnail: data.thumbnail,
        thumbnailTimestamp: data.thumbnailTimestamp,
      },
      select: {
        id: true,
        name: true,
        originalName: true,
        alt: true,
        thumbnail: true,
        path: true,
        thumbnailTimestamp: true,
      },
    });
  }

  async getMedia(
    org: string,
    page: number,
    search?: string,
    type?: MediaListType
  ) {
    const pageNum = (page || 1) - 1;
    const trimmedSearch = search?.trim();
    const searchFilter = trimmedSearch
      ? {
          originalName: {
            contains: trimmedSearch,
            mode: 'insensitive' as const,
          },
        }
      : {};
    const typeFilter = mediaTypeFilter(type);
    const shared: Prisma.MediaWhereInput = {
      deletedAt: null,
      // still being normalized: it shows up once the workflow releases it
      status: { not: 'processing' },
      ...searchFilter,
      ...typeFilter,
    };
    const query = {
      where: {
        organization: {
          id: org,
        },
        ...shared,
      },
    };
    const pages = Math.ceil(
      (await this._media.model.media.count(query)) / MEDIA_PAGE_SIZE
    );
    const results = await this._media.model.media.findMany({
      where: {
        organizationId: org,
        ...shared,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        originalName: true,
        path: true,
        thumbnail: true,
        alt: true,
        thumbnailTimestamp: true,
      },
      skip: pageNum * MEDIA_PAGE_SIZE,
      take: MEDIA_PAGE_SIZE,
    });

    return {
      pages,
      results,
    };
  }

  // The file name is unguessable. Match it against this org's media, posts,
  // and link page so a logged-in member of another org cannot read it.
  async orgOwnsLocalPath(orgId: string, relative: string) {
    if (!isSafeUploadRelative(relative)) {
      return false;
    }
    const owns = (value: string | null | undefined) =>
      mentionsUploadRelative(value, relative);
    const media = await this._media.model.media.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        OR: [
          { path: { contains: `/${relative}` } },
          { path: relative },
          { thumbnail: { contains: `/${relative}` } },
          { thumbnail: relative },
        ],
      },
      select: { path: true, thumbnail: true },
      take: 20,
    });
    if (media.some((row) => owns(row.path) || owns(row.thumbnail))) {
      return true;
    }
    const posts = await this._post.model.post.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        image: { contains: `/${relative}` },
      },
      select: { image: true },
      take: 20,
    });
    if (posts.some((row) => owns(row.image))) {
      return true;
    }
    const pages = await this._linkPage.model.linkPage.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { avatarPath: { contains: `/${relative}` } },
          { avatarPath: relative },
          { backgroundImage: { contains: `/${relative}` } },
          { backgroundImage: relative },
        ],
      },
      select: { avatarPath: true, backgroundImage: true },
      take: 20,
    });
    if (pages.some((row) => owns(row.avatarPath) || owns(row.backgroundImage))) {
      return true;
    }
    const blocks = await this._linkBlock.model.linkBlock.findMany({
      where: {
        deletedAt: null,
        page: { organizationId: orgId },
        OR: [
          { thumbnail: { contains: `/${relative}` } },
          { thumbnail: relative },
          { body: { contains: `/${relative}` } },
        ],
      },
      select: { thumbnail: true, body: true },
      take: 20,
    });
    return blocks.some((row) => owns(row.thumbnail) || owns(row.body));
  }
}
