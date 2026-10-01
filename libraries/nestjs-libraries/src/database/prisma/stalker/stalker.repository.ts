import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import {
  Integration,
  Prisma,
  StalkerCategory,
  StalkerSentiment,
  StalkerSource,
} from '@prisma/client';
import { StalkerMentionDraft } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';

const CATEGORIES = new Set<string>(Object.values(StalkerCategory));
const SENTIMENTS = new Set<string>(Object.values(StalkerSentiment));
const SOURCES = new Set<string>(Object.values(StalkerSource));

@Injectable()
export class StalkerRepository {
  constructor(
    private _mention: PrismaRepository<'stalkerMention'>,
    private _keyword: PrismaRepository<'stalkerKeyword'>,
    private _theme: PrismaRepository<'stalkerTheme'>,
    private _integration: PrismaRepository<'integration'>
  ) {}

  listActiveSocial(): Promise<Integration[]> {
    return this._integration.model.integration.findMany({
      where: {
        deletedAt: null,
        disabled: false,
        refreshNeeded: false,
        inBetweenSteps: false,
      },
    });
  }

  listKeywords(organizationId: string) {
    return this._keyword.model.stalkerKeyword.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  countKeywords(organizationId: string) {
    return this._keyword.model.stalkerKeyword.count({
      where: { organizationId },
    });
  }

  findKeyword(organizationId: string, phrase: string) {
    return this._keyword.model.stalkerKeyword.findFirst({
      where: {
        organizationId,
        phrase: { equals: phrase, mode: 'insensitive' },
      },
    });
  }

  createKeyword(organizationId: string, phrase: string) {
    return this._keyword.model.stalkerKeyword.create({
      data: { organizationId, phrase },
    });
  }

  deleteKeyword(organizationId: string, id: string) {
    return this._keyword.model.stalkerKeyword.deleteMany({
      where: { id, organizationId },
    });
  }

  async insertMentions(
    organizationId: string,
    integrationId: string,
    drafts: StalkerMentionDraft[],
    keywordIds: Map<string, string>
  ) {
    if (!drafts.length) {
      return 0;
    }

    const result = await this._mention.model.stalkerMention.createMany({
      data: drafts.map((draft) => ({
        organizationId,
        integrationId,
        keywordId: draft.keywordPhrase
          ? keywordIds.get(draft.keywordPhrase.toLowerCase())
          : undefined,
        externalId: draft.externalId,
        source: draft.source,
        authorName: draft.authorName.slice(0, 200),
        text: draft.text.slice(0, 2000),
        url: draft.url,
        postExternalId: draft.postExternalId,
      })),
      skipDuplicates: true,
    });

    return result.count;
  }

  listMentions(
    organizationId: string,
    filters: { category?: string; source?: string; minUrgency?: number }
  ) {
    const where: Prisma.StalkerMentionWhereInput = { organizationId };
    if (filters.category && CATEGORIES.has(filters.category)) {
      where.category = filters.category as StalkerCategory;
    }
    if (filters.source && SOURCES.has(filters.source)) {
      where.source = filters.source as StalkerSource;
    }
    if (typeof filters.minUrgency === 'number' && filters.minUrgency > 0) {
      where.urgency = { gte: filters.minUrgency };
    }

    return this._mention.model.stalkerMention.findMany({
      where,
      orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }],
      take: 100,
      include: {
        keyword: { select: { phrase: true } },
        integration: { select: { name: true, providerIdentifier: true } },
      },
    });
  }

  unclassified(organizationId: string) {
    return this._mention.model.stalkerMention.findMany({
      where: { organizationId, classifiedAt: null },
      orderBy: { createdAt: 'asc' },
      take: 40,
      select: { id: true, text: true },
    });
  }

  async saveClassification(
    organizationId: string,
    items: {
      id: string;
      category: string;
      sentiment: string;
      urgency: number;
    }[]
  ) {
    const now = new Date();
    for (const item of items) {
      if (!CATEGORIES.has(item.category) || !SENTIMENTS.has(item.sentiment)) {
        continue;
      }
      await this._mention.model.stalkerMention.updateMany({
        where: { id: item.id, organizationId, classifiedAt: null },
        data: {
          category: item.category as StalkerCategory,
          sentiment: item.sentiment as StalkerSentiment,
          urgency: Math.max(0, Math.min(100, Math.round(item.urgency))),
          classifiedAt: now,
        },
      });
    }
  }

  recentForThemes(organizationId: string) {
    return this._mention.model.stalkerMention.findMany({
      where: {
        organizationId,
        classifiedAt: { not: null },
        category: { not: 'SPAM' },
        createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 80,
      select: { id: true, text: true, category: true },
    });
  }

  async replaceThemes(
    organizationId: string,
    themes: { title: string; summary: string; mentionIds: string[] }[]
  ) {
    await this._mention.model.stalkerMention.updateMany({
      where: { organizationId },
      data: { themeId: null },
    });
    await this._theme.model.stalkerTheme.deleteMany({
      where: { organizationId },
    });

    for (const theme of themes) {
      if (!theme.mentionIds.length || !theme.title.trim()) {
        continue;
      }
      const created = await this._theme.model.stalkerTheme.create({
        data: {
          organizationId,
          title: theme.title.slice(0, 180),
          summary: theme.summary.slice(0, 500),
        },
      });
      await this._mention.model.stalkerMention.updateMany({
        where: {
          organizationId,
          id: { in: theme.mentionIds },
        },
        data: { themeId: created.id },
      });
    }
  }

  listThemes(organizationId: string) {
    return this._theme.model.stalkerTheme.findMany({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
      include: {
        mentions: {
          take: 3,
          orderBy: { urgency: 'desc' },
          select: {
            id: true,
            text: true,
            authorName: true,
            category: true,
            url: true,
          },
        },
        _count: { select: { mentions: true } },
      },
    });
  }

  getMention(organizationId: string, id: string) {
    return this._mention.model.stalkerMention.findFirst({
      where: { id, organizationId },
    });
  }

  getTheme(organizationId: string, id: string) {
    return this._theme.model.stalkerTheme.findFirst({
      where: { id, organizationId },
      include: {
        mentions: {
          take: 5,
          orderBy: { urgency: 'desc' },
          select: { text: true, authorName: true, category: true },
        },
      },
    });
  }
}
