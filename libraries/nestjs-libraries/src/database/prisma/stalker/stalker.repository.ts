import {
  PrismaRepository,
  PrismaTransaction,
} from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import {
  Integration,
  Prisma,
  StalkerAlertChannel,
  StalkerAlertKind,
  StalkerAlertStatus,
  StalkerCategory,
  StalkerMatchKind,
  StalkerMentionStatus,
  StalkerSentiment,
  StalkerSource,
} from '@prisma/client';
import { StalkerMentionDraft } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { mentionContentHash } from '@gitroom/nestjs-libraries/stalker/stalker.match';

const CATEGORIES = new Set<string>(Object.values(StalkerCategory));
const SENTIMENTS = new Set<string>(Object.values(StalkerSentiment));
const MATCH_KINDS = new Set<string>(Object.values(StalkerMatchKind));
const SOURCE_FILTERS: Record<string, StalkerSource[]> = {
  YOUTUBE_SEARCH: [StalkerSource.YOUTUBE_SEARCH],
  YOUTUBE_COMMENT: [StalkerSource.YOUTUBE_COMMENT],
  INSTAGRAM_COMMENT: [StalkerSource.INSTAGRAM_COMMENT],
  FACEBOOK_COMMENT: [StalkerSource.FACEBOOK_COMMENT],
  REDDIT: [StalkerSource.REDDIT_POST, StalkerSource.REDDIT_COMMENT],
  REDDIT_POST: [StalkerSource.REDDIT_POST],
  REDDIT_COMMENT: [StalkerSource.REDDIT_COMMENT],
  X: [StalkerSource.X_POST],
  X_POST: [StalkerSource.X_POST],
  LINKEDIN: [StalkerSource.LINKEDIN_POST],
  LINKEDIN_POST: [StalkerSource.LINKEDIN_POST],
};

const mentionWindow = (date?: string) => {
  const day = 24 * 60 * 60 * 1000;
  if (date === '24h') {
    return new Date(Date.now() - day);
  }
  if (date === '7d') {
    return new Date(Date.now() - 7 * day);
  }
  if (date === '30d') {
    return new Date(Date.now() - 30 * day);
  }
  return undefined;
};

const isDraft = (value: unknown): value is StalkerMentionDraft => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const draft = value as StalkerMentionDraft;
  return (
    typeof draft.externalId === 'string' &&
    typeof draft.source === 'string' &&
    typeof draft.authorName === 'string' &&
    typeof draft.text === 'string'
  );
};

@Injectable()
export class StalkerRepository {
  constructor(
    private _mention: PrismaRepository<'stalkerMention'>,
    private _keyword: PrismaRepository<'stalkerKeyword'>,
    private _theme: PrismaRepository<'stalkerTheme'>,
    private _integration: PrismaRepository<'integration'>,
    private _searchCache: PrismaRepository<'stalkerSearchCache'>,
    private _project: PrismaRepository<'stalkerProject'>,
    private _category: PrismaRepository<'stalkerProjectCategory'>,
    private _view: PrismaRepository<'stalkerSavedView'>,
    private _cursor: PrismaRepository<'stalkerScanCursor'>,
    private _alert: PrismaRepository<'stalkerAlert'>,
    private _transaction: PrismaTransaction
  ) {}

  listProjects(organizationId: string) {
    return this._project.model.stalkerProject.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
      include: {
        categories: { orderBy: { position: 'asc' } },
        _count: { select: { keywords: true, mentions: true } },
      },
    });
  }

  listProjectOrganizations() {
    return this._project.model.stalkerProject.findMany({
      distinct: ['organizationId'],
      select: { organizationId: true },
    });
  }

  getProject(organizationId: string, id: string) {
    return this._project.model.stalkerProject.findFirst({
      where: { id, organizationId },
      include: { categories: { orderBy: { position: 'asc' } } },
    });
  }

  async createProject(
    organizationId: string,
    input: {
      name: string;
      description: string;
      color: string;
      keywords: {
        phrase: string;
        youtube: boolean;
        reddit: boolean;
        x: boolean;
        linkedin: boolean;
      }[];
      categories: { name: string; description: string }[];
      identity: Prisma.StalkerProjectUpdateManyMutationInput;
    }
  ) {
    return this._transaction.model.$transaction(async (tx) => {
      const project = await tx.stalkerProject.create({
        data: {
          organizationId,
          name: input.name,
          description: input.description,
          color: input.color,
          ...(input.identity as Prisma.StalkerProjectUncheckedCreateInput),
        },
      });
      if (input.categories.length) {
        await tx.stalkerProjectCategory.createMany({
          data: input.categories.map((category, index) => ({
            projectId: project.id,
            name: category.name,
            description: category.description,
            position: index,
          })),
        });
      }
      if (input.keywords.length) {
        await tx.stalkerKeyword.createMany({
          data: input.keywords.map((keyword) => ({
            organizationId,
            projectId: project.id,
            phrase: keyword.phrase,
            listenYoutube: keyword.youtube,
            listenReddit: keyword.reddit,
            listenX: keyword.x,
            listenLinkedin: keyword.linkedin,
          })),
        });
      }
      return project;
    });
  }

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

  listOrganizationsWithKeywords() {
    return this._keyword.model.stalkerKeyword.findMany({
      distinct: ['organizationId'],
      select: { organizationId: true },
    });
  }

  listKeywords(organizationId: string, projectId: string) {
    return this._keyword.model.stalkerKeyword.findMany({
      where: { organizationId, projectId },
      orderBy: { createdAt: 'asc' },
    });
  }

  countKeywords(organizationId: string, projectId: string) {
    return this._keyword.model.stalkerKeyword.count({
      where: { organizationId, projectId },
    });
  }

  findKeyword(organizationId: string, projectId: string, phrase: string) {
    return this._keyword.model.stalkerKeyword.findFirst({
      where: {
        organizationId,
        projectId,
        phrase: { equals: phrase, mode: 'insensitive' },
      },
    });
  }

  createKeyword(
    organizationId: string,
    projectId: string,
    phrase: string,
    platforms: {
      youtube: boolean;
      reddit: boolean;
      x: boolean;
      linkedin: boolean;
    }
  ) {
    return this._keyword.model.stalkerKeyword.create({
      data: {
        organizationId,
        projectId,
        phrase,
        listenYoutube: platforms.youtube,
        listenReddit: platforms.reddit,
        listenX: platforms.x,
        listenLinkedin: platforms.linkedin,
      },
    });
  }

  deleteKeyword(organizationId: string, id: string) {
    return this._transaction.model.$transaction(async (tx) => {
      const keyword = await tx.stalkerKeyword.findFirst({
        where: { id, organizationId },
      });
      if (!keyword) {
        return { count: 0 };
      }
      if (keyword.projectId) {
        await tx.stalkerScanCursor.deleteMany({
          where: {
            projectId: keyword.projectId,
            phraseKey: keyword.phrase.toLowerCase(),
          },
        });
      }
      return tx.stalkerKeyword.deleteMany({
        where: { id, organizationId },
      });
    });
  }

  getKeyword(organizationId: string, id: string) {
    return this._keyword.model.stalkerKeyword.findFirst({
      where: { id, organizationId },
    });
  }

  listCursors(projectId: string) {
    return this._cursor.model.stalkerScanCursor.findMany({
      where: { projectId },
    });
  }

  async armBackfill(
    projectId: string,
    sources: string[],
    phraseKey: string,
    until: Date
  ) {
    for (const source of sources) {
      await this._cursor.model.stalkerScanCursor.upsert({
        where: {
          projectId_source_phraseKey: { projectId, source, phraseKey },
        },
        create: {
          projectId,
          source,
          phraseKey,
          backfillUntil: until,
          backfillDone: false,
          lastError: '',
        },
        update: { backfillUntil: until, backfillDone: false, lastError: '' },
      });
    }
  }

  async finishScan(
    projectId: string,
    source: string,
    phraseKey: string,
    backfill: boolean
  ) {
    const now = new Date();
    const existing = await this._cursor.model.stalkerScanCursor.findUnique({
      where: {
        projectId_source_phraseKey: { projectId, source, phraseKey },
      },
    });
    if (backfill) {
      await this._cursor.model.stalkerScanCursor.upsert({
        where: {
          projectId_source_phraseKey: { projectId, source, phraseKey },
        },
        create: {
          projectId,
          source,
          phraseKey,
          cursorAt: now,
          backfillUntil: null,
          backfillDone: true,
          lastError: '',
        },
        update: {
          backfillUntil: null,
          backfillDone: true,
          lastError: '',
          cursorAt: existing?.cursorAt || now,
        },
      });
      return;
    }
    await this._cursor.model.stalkerScanCursor.upsert({
      where: {
        projectId_source_phraseKey: { projectId, source, phraseKey },
      },
      create: { projectId, source, phraseKey, cursorAt: now, lastError: '' },
      update: { cursorAt: now, lastError: '' },
    });
  }

  async noteScanFailure(
    projectId: string,
    source: string,
    phraseKey: string,
    error: string
  ) {
    const lastError = error.slice(0, 300);
    await this._cursor.model.stalkerScanCursor.upsert({
      where: {
        projectId_source_phraseKey: { projectId, source, phraseKey },
      },
      create: { projectId, source, phraseKey, lastError },
      update: { lastError },
    });
  }

  updateKeywordPlatforms(
    organizationId: string,
    id: string,
    platforms: {
      youtube?: boolean;
      reddit?: boolean;
      x?: boolean;
      linkedin?: boolean;
    }
  ) {
    const data: Prisma.StalkerKeywordUpdateManyMutationInput = {};
    if (typeof platforms.youtube === 'boolean') {
      data.listenYoutube = platforms.youtube;
    }
    if (typeof platforms.reddit === 'boolean') {
      data.listenReddit = platforms.reddit;
    }
    if (typeof platforms.x === 'boolean') {
      data.listenX = platforms.x;
    }
    if (typeof platforms.linkedin === 'boolean') {
      data.listenLinkedin = platforms.linkedin;
    }
    return this._keyword.model.stalkerKeyword.updateMany({
      where: { id, organizationId },
      data,
    });
  }

  async insertMentions(
    organizationId: string,
    projectId: string,
    integrationId: string | null,
    drafts: StalkerMentionDraft[],
    keywordIds: Map<string, string>
  ) {
    if (!drafts.length) {
      return 0;
    }

    const seenHash = new Set<string>();
    const prepared = [];
    for (const draft of drafts) {
      const contentHash = mentionContentHash(draft);
      if (seenHash.has(contentHash)) {
        continue;
      }
      seenHash.add(contentHash);
      prepared.push({ draft, contentHash });
    }
    const existing = await this._mention.model.stalkerMention.findMany({
      where: {
        organizationId,
        projectId,
        OR: [
          { externalId: { in: prepared.map((row) => row.draft.externalId) } },
          {
            contentHash: {
              in: prepared.map((row) => row.contentHash),
            },
          },
        ],
      },
      select: { externalId: true, contentHash: true },
    });
    const knownIds = new Set(existing.map((row) => row.externalId));
    const knownHashes = new Set(
      existing.map((row) => row.contentHash).filter((hash) => hash)
    );
    const data = prepared
      .filter(
        (row) =>
          !knownIds.has(row.draft.externalId) &&
          !knownHashes.has(row.contentHash)
      )
      .map(({ draft, contentHash }) => ({
        organizationId,
        projectId,
        integrationId,
        keywordId: draft.keywordPhrase
          ? keywordIds.get(draft.keywordPhrase.toLowerCase())
          : undefined,
        externalId: draft.externalId,
        source: draft.source,
        authorName: draft.authorName.slice(0, 200),
        authorHandle: (draft.authorHandle || '').slice(0, 80),
        text: draft.text.slice(0, 2000),
        url: draft.url,
        postExternalId: draft.postExternalId,
        matchKind: draft.matchKind,
        matchLabel: (draft.matchLabel || '').slice(0, 80),
        likeCount: Math.max(0, Math.round(draft.likeCount || 0)),
        replyCount: Math.max(0, Math.round(draft.replyCount || 0)),
        contentHash,
      }));
    if (!data.length) {
      return 0;
    }
    try {
      const result = await this._mention.model.stalkerMention.createMany({
        data,
        skipDuplicates: true,
      });
      return result.count;
    } catch (err) {
      if (!this.isUniqueConflict(err)) {
        throw err;
      }
      let inserted = 0;
      for (const row of data) {
        try {
          await this._mention.model.stalkerMention.create({ data: row });
          inserted += 1;
        } catch (rowErr) {
          if (!this.isUniqueConflict(rowErr)) {
            throw rowErr;
          }
        }
      }
      return inserted;
    }
  }

  private isUniqueConflict(err: unknown) {
    return (
      !!err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code?: string }).code === 'P2002'
    );
  }

  listMentions(
    organizationId: string,
    filters: {
      projectId: string;
      date?: string;
      source?: string;
      from?: string;
      keywordId?: string;
      categoryId?: string;
      sentiment?: string;
      status?: string;
      minUrgency?: number;
      q?: string;
      match?: string;
      offTopic?: string;
      take?: number;
      cursor?: string;
    }
  ) {
    const where: Prisma.StalkerMentionWhereInput = {
      organizationId,
      projectId: filters.projectId,
    };
    if (filters.offTopic !== 'include') {
      where.relevant = true;
    }
    const since = mentionWindow(filters.date);
    if (since) {
      where.createdAt = { gte: since };
    }
    const sources = filters.source ? SOURCE_FILTERS[filters.source] : undefined;
    if (sources?.length === 1) {
      where.source = sources[0];
    } else if (sources && sources.length > 1) {
      where.source = { in: sources };
    }
    if (filters.from?.trim()) {
      where.authorName = { contains: filters.from.trim(), mode: 'insensitive' };
    }
    if (filters.keywordId) {
      where.keywordId = filters.keywordId;
    }
    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }
    if (
      filters.sentiment &&
      SENTIMENTS.has(filters.sentiment)
    ) {
      where.sentiment = filters.sentiment as StalkerSentiment;
    }
    if (
      filters.status &&
      (Object.values(StalkerMentionStatus) as string[]).includes(filters.status)
    ) {
      where.status = filters.status as StalkerMentionStatus;
    }
    if (typeof filters.minUrgency === 'number' && filters.minUrgency > 0) {
      where.urgency = { gte: filters.minUrgency };
    }
    if (filters.q?.trim()) {
      const q = filters.q.trim();
      where.AND = [
        {
          OR: [
            { text: { contains: q, mode: 'insensitive' } },
            { authorName: { contains: q, mode: 'insensitive' } },
          ],
        },
      ];
    }
    if (filters.match && MATCH_KINDS.has(filters.match)) {
      where.matchKind = filters.match as StalkerMatchKind;
    }

    const take = Math.min(100, Math.max(1, filters.take || 50));
    return this._mention.model.stalkerMention
      .findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: take + 1,
        ...(filters.cursor
          ? { cursor: { id: filters.cursor }, skip: 1 }
          : {}),
        include: {
          keyword: { select: { phrase: true } },
          categoryDef: { select: { id: true, name: true } },
          integration: { select: { name: true, providerIdentifier: true } },
        },
      })
      .then((rows) => {
        const mentions = rows.slice(0, take);
        return {
          mentions,
          nextCursor: rows.length > take ? mentions[mentions.length - 1]?.id || null : null,
        };
      });
  }

  listCategories(organizationId: string, projectId: string) {
    return this._category.model.stalkerProjectCategory.findMany({
      where: { project: { id: projectId, organizationId } },
      orderBy: { position: 'asc' },
    });
  }

  unclassified(organizationId: string, projectId: string) {
    return this._mention.model.stalkerMention.findMany({
      where: { organizationId, projectId, classifiedAt: null },
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
      categoryId: string | null;
      sentiment: string;
      urgency: number;
      relevant: boolean;
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
          categoryId: item.categoryId,
          sentiment: item.sentiment as StalkerSentiment,
          urgency: Math.max(0, Math.min(100, Math.round(item.urgency))),
          relevant: item.relevant,
          classifiedAt: now,
        },
      });
    }
  }

  setMentionStatus(
    organizationId: string,
    id: string,
    status: StalkerMentionStatus
  ) {
    return this._mention.model.stalkerMention.updateMany({
      where: { id, organizationId },
      data: { status },
    });
  }

  async analytics(organizationId: string, projectId: string, date = '30d') {
    const since = date === 'all' ? undefined : mentionWindow(date) || mentionWindow('30d');
    const where = {
      organizationId,
      projectId,
      relevant: true,
      ...(since ? { createdAt: { gte: since } } : {}),
    };
    const chartSince =
      date === 'all'
        ? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        : since;
    const [bySource, bySentiment, byCategory, byKeyword, byTheme, accounts, overTime] =
      await Promise.all([
        this._mention.model.stalkerMention.groupBy({
          by: ['source'],
          where,
          _count: { _all: true },
        }),
        this._mention.model.stalkerMention.groupBy({
          by: ['sentiment'],
          where,
          _count: { _all: true },
        }),
        this._mention.model.stalkerMention.groupBy({
          by: ['categoryId'],
          where,
          _count: { _all: true },
        }),
        this._mention.model.stalkerMention.groupBy({
          by: ['keywordId'],
          where,
          _count: { _all: true },
        }),
        this._mention.model.stalkerMention.groupBy({
          by: ['themeId'],
          where,
          _count: { _all: true },
        }),
        this._mention.model.stalkerMention.groupBy({
          by: ['authorName'],
          where,
          _count: { _all: true },
          orderBy: { _count: { authorName: 'desc' } },
          take: 8,
        }),
        this.mentionCountsByDay(
          organizationId,
          projectId,
          chartSince || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        ),
      ]);
    const [categories, keywords, themes] = await Promise.all([
      this.listCategories(organizationId, projectId),
      this.listKeywords(organizationId, projectId),
      this._theme.model.stalkerTheme.findMany({
        where: { organizationId, projectId },
        select: { id: true, title: true },
      }),
    ]);
    const names = new Map(categories.map((category) => [category.id, category.name]));
    const keywordNames = new Map(keywords.map((keyword) => [keyword.id, keyword.phrase]));
    const themeNames = new Map(themes.map((theme) => [theme.id, theme.title]));
    return {
      bySource,
      bySentiment,
      byCategory,
      byKeyword,
      byTheme,
      accounts,
      names,
      keywordNames,
      themeNames,
      overTime,
    };
  }

  private async mentionCountsByDay(
    organizationId: string,
    projectId: string,
    since: Date
  ) {
    const dayMs = 24 * 60 * 60 * 1000;
    const start = new Date(since);
    start.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.min(
      90,
      Math.max(1, Math.round((today.getTime() - start.getTime()) / dayMs) + 1)
    );
    const counts = await Promise.all(
      Array.from({ length: days }, (_, index) => {
        const dayStart = new Date(start.getTime() + index * dayMs);
        const dayEnd = new Date(dayStart.getTime() + dayMs);
        return this._mention.model.stalkerMention
          .count({
            where: {
              organizationId,
              projectId,
              relevant: true,
              createdAt: { gte: dayStart, lt: dayEnd },
            },
          })
          .then((count) => ({
            date: dayStart.toISOString().slice(0, 10),
            count,
          }));
      })
    );
    return counts;
  }

  countMentionsBetween(
    organizationId: string,
    projectId: string,
    start: Date,
    end: Date,
    sentiment?: StalkerSentiment
  ) {
    return this._mention.model.stalkerMention.count({
      where: {
        organizationId,
        projectId,
        relevant: true,
        createdAt: { gte: start, lt: end },
        ...(sentiment ? { sentiment } : {}),
      },
    });
  }

  recentForThemes(organizationId: string, projectId: string) {
    return this._mention.model.stalkerMention.findMany({
      where: {
        organizationId,
        projectId,
        classifiedAt: { not: null },
        relevant: true,
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
    projectId: string,
    themes: { title: string; summary: string; mentionIds: string[] }[]
  ) {
    await this._mention.model.stalkerMention.updateMany({
      where: { organizationId, projectId },
      data: { themeId: null },
    });
    await this._theme.model.stalkerTheme.deleteMany({
      where: { organizationId, projectId },
    });

    for (const theme of themes) {
      if (!theme.mentionIds.length || !theme.title.trim()) {
        continue;
      }
      const created = await this._theme.model.stalkerTheme.create({
        data: {
          organizationId,
          projectId,
          title: theme.title.slice(0, 180),
          summary: theme.summary.slice(0, 500),
        },
      });
      await this._mention.model.stalkerMention.updateMany({
        where: {
          organizationId,
          projectId,
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

  async readSearchCache(platform: string, phrase: string, maxAgeMs: number) {
    const row = await this._searchCache.model.stalkerSearchCache.findUnique({
      where: {
        platform_phrase: {
          platform,
          phrase: phrase.toLowerCase(),
        },
      },
    });
    if (!row || Date.now() - row.fetchedAt.getTime() > maxAgeMs) {
      return null;
    }
    if (!Array.isArray(row.payload)) {
      return null;
    }
    const drafts = row.payload.filter(isDraft);
    return drafts.length || row.payload.length === 0 ? drafts : null;
  }

  writeSearchCache(
    platform: string,
    phrase: string,
    drafts: StalkerMentionDraft[]
  ) {
    const key = phrase.toLowerCase();
    return this._searchCache.model.stalkerSearchCache.upsert({
      where: { platform_phrase: { platform, phrase: key } },
      create: {
        platform,
        phrase: key,
        fetchedAt: new Date(),
        payload: drafts as unknown as Prisma.InputJsonValue,
      },
      update: {
        fetchedAt: new Date(),
        payload: drafts as unknown as Prisma.InputJsonValue,
      },
    });
  }

  updateProject(
    organizationId: string,
    id: string,
    data: Prisma.StalkerProjectUpdateManyMutationInput
  ) {
    return this._project.model.stalkerProject.updateMany({
      where: { id, organizationId },
      data,
    });
  }

  listViews(organizationId: string, projectId: string) {
    return this._view.model.stalkerSavedView.findMany({
      where: { organizationId, projectId },
      orderBy: { createdAt: 'asc' },
    });
  }

  countViews(organizationId: string, projectId: string) {
    return this._view.model.stalkerSavedView.count({
      where: { organizationId, projectId },
    });
  }

  createView(
    organizationId: string,
    projectId: string,
    name: string,
    filters: Prisma.InputJsonValue
  ) {
    return this._view.model.stalkerSavedView.create({
      data: { organizationId, projectId, name, filters },
    });
  }

  deleteView(organizationId: string, id: string) {
    return this._view.model.stalkerSavedView.deleteMany({
      where: { id, organizationId },
    });
  }

  mentionsCreatedSince(
    organizationId: string,
    projectId: string,
    externalIds: string[],
    started: Date
  ) {
    if (!externalIds.length) {
      return Promise.resolve([]);
    }
    return this._mention.model.stalkerMention.findMany({
      where: {
        organizationId,
        projectId,
        externalId: { in: externalIds },
        createdAt: { gte: started },
      },
      select: {
        id: true,
        projectId: true,
        externalId: true,
        source: true,
        authorName: true,
        authorHandle: true,
        text: true,
        url: true,
        matchKind: true,
        matchLabel: true,
        likeCount: true,
        replyCount: true,
        category: true,
        sentiment: true,
        urgency: true,
        createdAt: true,
      },
    });
  }

  mentionsByIds(organizationId: string, ids: string[]) {
    if (!ids.length) {
      return Promise.resolve([]);
    }
    return this._mention.model.stalkerMention.findMany({
      where: { organizationId, id: { in: ids } },
      select: {
        id: true,
        authorName: true,
        text: true,
        url: true,
        urgency: true,
        category: true,
        sentiment: true,
        categoryDef: { select: { name: true } },
      },
    });
  }

  async listAlerts(
    organizationId: string,
    projectId: string,
    cursor?: string,
    take = 50
  ) {
    const limit = Math.min(100, Math.max(1, take || 50));
    const rows = await this._alert.model.stalkerAlert.findMany({
      where: { organizationId, projectId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const alerts = rows.slice(0, limit);
    return {
      alerts,
      nextCursor: rows.length > limit ? alerts[alerts.length - 1]?.id || null : null,
    };
  }

  latestAlert(projectId: string, kind: StalkerAlertKind, since: Date) {
    return this._alert.model.stalkerAlert.findFirst({
      where: {
        projectId,
        kind,
        createdAt: { gte: since },
        status: { in: [StalkerAlertStatus.SENT, StalkerAlertStatus.PENDING] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAlert(input: {
    organizationId: string;
    projectId: string;
    mentionId?: string | null;
    kind: StalkerAlertKind;
    channel: StalkerAlertChannel;
    status: StalkerAlertStatus;
    dedupeKey: string;
    title: string;
    body: string;
    sentAt?: Date | null;
  }) {
    const existing = await this._alert.model.stalkerAlert.findUnique({
      where: {
        projectId_dedupeKey: {
          projectId: input.projectId,
          dedupeKey: input.dedupeKey,
        },
      },
    });
    if (existing) {
      return existing;
    }
    try {
      return await this._alert.model.stalkerAlert.create({
        data: {
          organizationId: input.organizationId,
          projectId: input.projectId,
          mentionId: input.mentionId || null,
          kind: input.kind,
          channel: input.channel,
          status: input.status,
          dedupeKey: input.dedupeKey,
          title: input.title.slice(0, 180),
          body: input.body.slice(0, 4000),
          sentAt: input.sentAt || null,
          attempts: input.status === StalkerAlertStatus.SENT ? 1 : 0,
        },
      });
    } catch (err) {
      if (!this.isUniqueConflict(err)) {
        throw err;
      }
      return this._alert.model.stalkerAlert.findUnique({
        where: {
          projectId_dedupeKey: {
            projectId: input.projectId,
            dedupeKey: input.dedupeKey,
          },
        },
      });
    }
  }

  pendingEmails(projectId: string) {
    return this._alert.model.stalkerAlert.findMany({
      where: {
        projectId,
        channel: StalkerAlertChannel.EMAIL,
        status: {
          in: [StalkerAlertStatus.PENDING, StalkerAlertStatus.FAILED],
        },
        attempts: { lt: 3 },
      },
      orderBy: { createdAt: 'asc' },
      take: 40,
    });
  }

  markAlert(
    id: string,
    status: StalkerAlertStatus,
    error: string
  ) {
    return this._alert.model.stalkerAlert.update({
      where: { id },
      data: {
        status,
        error: error.slice(0, 300),
        attempts: { increment: 1 },
        sentAt: status === StalkerAlertStatus.SENT ? new Date() : null,
      },
    });
  }

  markAlerts(
    ids: string[],
    status: StalkerAlertStatus,
    error: string
  ) {
    if (!ids.length) {
      return Promise.resolve({ count: 0 });
    }
    return this._alert.model.stalkerAlert.updateMany({
      where: { id: { in: ids } },
      data: {
        status,
        error: error.slice(0, 300),
        attempts: { increment: 1 },
        sentAt: status === StalkerAlertStatus.SENT ? new Date() : null,
      },
    });
  }

  markAlertRead(organizationId: string, id: string) {
    return this._alert.model.stalkerAlert.updateMany({
      where: { id, organizationId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  saveMention(
    organizationId: string,
    id: string,
    data: {
      saved: boolean;
      category?: StalkerCategory;
      categoryId?: string | null;
    }
  ) {
    return this._mention.model.stalkerMention.updateMany({
      where: { id, organizationId },
      data,
    });
  }

  getIntegration(id: string, organizationId: string) {
    return this._integration.model.integration.findFirst({
      where: { id, organizationId, deletedAt: null, disabled: false },
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
