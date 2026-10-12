import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  PrismaRepository,
  PrismaTransaction,
} from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

const pageInclude = {
  blocks: {
    where: { deletedAt: null } as Prisma.LinkBlockWhereInput,
    orderBy: { position: 'asc' as const },
    include: {
      post: {
        include: {
          integration: {
            select: { providerIdentifier: true },
          },
        },
      },
    },
  },
  organization: {
    select: {
      name: true,
      deletedAt: true,
      customDomainAddon: true,
      subscription: {
        select: {
          subscriptionTier: true,
          isLifetime: true,
          deletedAt: true,
        },
      },
    },
  },
} satisfies Prisma.LinkPageInclude;

@Injectable()
export class LinkRepository {
  constructor(
    private _page: PrismaRepository<'linkPage'>,
    private _block: PrismaRepository<'linkBlock'>,
    private _event: PrismaRepository<'linkEvent'>,
    private _lead: PrismaRepository<'linkLead'>,
    private _post: PrismaRepository<'post'>,
    private _userOrg: PrismaRepository<'userOrganization'>,
    private _transaction: PrismaTransaction
  ) {}

  findByOrg(organizationId: string) {
    return this._page.model.linkPage.findUnique({
      where: { organizationId },
      include: pageInclude,
    });
  }

  findBySlug(slug: string) {
    return this._page.model.linkPage.findFirst({
      where: { slug, organization: { deletedAt: null } },
      include: pageInclude,
    });
  }

  findByDomain(customDomain: string) {
    return this._page.model.linkPage.findFirst({
      where: { customDomain, organization: { deletedAt: null } },
      include: pageInclude,
    });
  }

  create(data: Prisma.LinkPageUncheckedCreateInput) {
    return this._page.model.linkPage.create({ data, include: pageInclude });
  }

  update(id: string, data: Prisma.LinkPageUpdateInput) {
    return this._page.model.linkPage.update({ where: { id }, data, include: pageInclude });
  }

  slugOwner(slug: string) {
    return this._page.model.linkPage.findUnique({
      where: { slug },
      select: { id: true },
    });
  }

  countBlocks(pageId: string) {
    return this._block.model.linkBlock.count({
      where: { pageId, deletedAt: null },
    });
  }

  findBlock(pageId: string, id: string) {
    return this._block.model.linkBlock.findFirst({
      where: { id, pageId, deletedAt: null },
    });
  }

  createBlock(data: Prisma.LinkBlockUncheckedCreateInput) {
    return this._block.model.linkBlock.create({ data });
  }

  updateBlock(id: string, data: Prisma.LinkBlockUpdateInput) {
    return this._block.model.linkBlock.update({ where: { id }, data });
  }

  clearPriority(pageId: string, exceptId: string) {
    return this._block.model.linkBlock.updateMany({
      where: { pageId, deletedAt: null, id: { not: exceptId }, priority: true },
      data: { priority: false },
    });
  }

  async reorder(pageId: string, ids: string[]) {
    const blocks = await this._block.model.linkBlock.findMany({
      where: { pageId, deletedAt: null },
      select: { id: true },
    });
    const current = new Set(blocks.map((block) => block.id));
    if (ids.length !== current.size || ids.some((id) => !current.has(id))) {
      return false;
    }
    await this._transaction.model.$transaction(
      ids.map((id, position) =>
        this._block.model.linkBlock.update({
          where: { id },
          data: { position },
        })
      )
    );
    return true;
  }

  async moveBlock(pageId: string, id: string, placement: 'above' | 'below') {
    const blocks = await this._block.model.linkBlock.findMany({
      where: { pageId, deletedAt: null },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    const rest = blocks.map((block) => block.id).filter((blockId) => blockId !== id);
    const ids = placement === 'above' ? [id, ...rest] : [...rest, id];
    await this.reorder(pageId, ids);
  }

  publishedPosts(organizationId: string) {
    return this._post.model.post.findMany({
      where: {
        organizationId,
        state: 'PUBLISHED',
        deletedAt: null,
        parentPostId: null,
      },
      orderBy: { publishDate: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        content: true,
        publishDate: true,
        releaseURL: true,
        image: true,
        state: true,
        deletedAt: true,
        integration: { select: { providerIdentifier: true } },
      },
    });
  }

  findPost(organizationId: string, id: string) {
    return this._post.model.post.findFirst({
      where: { id, organizationId, deletedAt: null, state: 'PUBLISHED' },
      select: { id: true },
    });
  }

  clickCounts(pageId: string) {
    return this._event.model.linkEvent.groupBy({
      by: ['blockId'],
      where: { pageId, type: 'CLICK', blockId: { not: null } },
      _count: { _all: true },
    });
  }

  countEvents(pageId: string, type: 'VIEW' | 'CLICK', from: Date, to: Date) {
    return this._event.model.linkEvent.count({
      where: { pageId, type, createdAt: { gte: from, lt: to } },
    });
  }

  series(pageId: string, from: Date, to: Date) {
    return this._event.model.linkEvent.groupBy({
      by: ['day', 'type'],
      where: { pageId, day: { gte: from, lte: to } },
      _count: { _all: true },
    });
  }

  grouped(pageId: string, field: 'country' | 'source' | 'device' | 'browser', from: Date, to: Date) {
    return this._event.model.linkEvent.groupBy({
      by: [field],
      where: {
        pageId,
        type: 'VIEW',
        createdAt: { gte: from, lt: to },
        [field]: { not: '' },
      },
      _count: { _all: true },
    });
  }

  utmBreakdown(pageId: string, from: Date, to: Date) {
    return this._event.model.linkEvent.groupBy({
      by: ['utmSource', 'utmMedium', 'utmCampaign'],
      where: {
        pageId,
        type: 'VIEW',
        createdAt: { gte: from, lt: to },
      },
      _count: { _all: true },
    });
  }

  clicksByBlock(pageId: string, from: Date, to: Date) {
    return this._event.model.linkEvent.groupBy({
      by: ['blockId'],
      where: { pageId, type: 'CLICK', createdAt: { gte: from, lt: to }, blockId: { not: null } },
      _count: { _all: true },
    });
  }

  countSubscribers(pageId: string, from: Date, to: Date) {
    return this._lead.model.linkLead.count({
      where: { pageId, status: 'CONFIRMED', createdAt: { gte: from, lt: to } },
    });
  }

  insertEvent(data: Prisma.LinkEventUncheckedCreateInput) {
    return this._event.model.linkEvent.create({ data });
  }

  leadCounts(pageId: string) {
    return this._lead.model.linkLead.groupBy({
      by: ['status'],
      where: { pageId },
      _count: { _all: true },
    });
  }

  leads(pageId: string, status: string, query: string, take: number) {
    return this._lead.model.linkLead.findMany({
      where: {
        pageId,
        ...(status === 'CONFIRMED' || status === 'PENDING' ? { status } : {}),
        ...(query
          ? { email: { contains: query, mode: 'insensitive' } }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  findLead(pageId: string, email: string) {
    return this._lead.model.linkLead.findUnique({
      where: { pageId_email: { pageId, email } },
    });
  }

  createLead(data: Prisma.LinkLeadUncheckedCreateInput) {
    return this._lead.model.linkLead.create({ data });
  }

  updateLead(id: string, data: Prisma.LinkLeadUpdateInput) {
    return this._lead.model.linkLead.update({ where: { id }, data });
  }

  confirmLead(token: string) {
    return this._lead.model.linkLead.updateMany({
      where: { confirmToken: token, status: 'PENDING' },
      data: { status: 'CONFIRMED', confirmToken: null },
    });
  }

  findLeadByToken(token: string) {
    return this._lead.model.linkLead.findUnique({
      where: { confirmToken: token },
      include: { page: { select: { slug: true, name: true } } },
    });
  }

  async ownerEmail(organizationId: string) {
    const admin = await this._userOrg.model.userOrganization.findFirst({
      where: { organizationId, disabled: false, role: 'ADMIN' },
      orderBy: { createdAt: 'asc' },
      select: { user: { select: { email: true } } },
    });
    if (admin?.user.email) {
      return admin.user.email;
    }
    const anyone = await this._userOrg.model.userOrganization.findFirst({
      where: { organizationId, disabled: false },
      orderBy: { createdAt: 'asc' },
      select: { user: { select: { email: true } } },
    });
    return anyone?.user.email || '';
  }
}

export type LinkPageRecord = NonNullable<Awaited<ReturnType<LinkRepository['findByOrg']>>>;
