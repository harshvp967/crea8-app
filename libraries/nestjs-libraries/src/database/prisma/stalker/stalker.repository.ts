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
import {
  decodeHtmlEntities,
  normalizeHandle,
} from '@gitroom/helpers/utils/stalker.text';

const CATEGORIES = new Set<string>(Object.values(StalkerCategory));
const SENTIMENTS = new Set<string>(Object.values(StalkerSentiment));
const MATCH_KINDS = new Set<string>(Object.values(StalkerMatchKind));
const SOURCE_FILTERS: Record<string, StalkerSource[]> = {
  YOUTUBE: [StalkerSource.YOUTUBE_SEARCH, StalkerSource.YOUTUBE_COMMENT],
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

// Clamp a browser `getTimezoneOffset()` value (minutes, IST = -330).
export const stalkerTzOffset = (value?: number | string) => {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) {
    return 0;
  }
  return Math.max(-840, Math.min(840, Math.round(minutes)));
};

// YYYY-MM-DD days are the *user's* calendar days: midnight local time is
// midnight UTC plus the browser's timezone offset. Without a tz the days are UTC.
export const mentionRange = (start?: string, end?: string, tz?: number | string) => {
  const offsetMs = stalkerTzOffset(tz) * 60 * 1000;
  const parsed = (value?: string) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return undefined;
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(date.getTime())
      ? undefined
      : new Date(date.getTime() + offsetMs);
  };
  const from = parsed(start);
  const to = parsed(end);
  if (!to) {
    return { start: from, end: undefined as Date | undefined };
  }
  const exclusive = new Date(to);
  exclusive.setUTCDate(exclusive.getUTCDate() + 1);
  return { start: from, end: exclusive };
};

const sourceList = (source?: string) => {
  if (!source) {
    return [] as StalkerSource[];
  }
  const mapped = source
    .split(',')
    .map((item) => SOURCE_FILTERS[item.trim()])
    .filter((item): item is StalkerSource[] => !!item);
  return [...new Set(mapped.flat())];
};

const engagementClauses = (raw?: string): Prisma.StalkerMentionWhereInput[] => {
  if (!raw?.trim()) {
    return [];
  }
  const clauses: Prisma.StalkerMentionWhereInput[] = [];
  for (const part of raw.split(',')) {
    const [name, amount] = part.split(':');
    const min = Number(amount);
    const sources = sourceList(name);
    if (!sources.length || !Number.isFinite(min) || min <= 0) {
      continue;
    }
    clauses.push({
      source: sources.length === 1 ? sources[0] : { in: sources },
      OR: [{ likeCount: { gte: min } }, { replyCount: { gte: min } }],
    });
  }
  return clauses;
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
    private _scan: PrismaRepository<'stalkerScanRun'>,
    private _category: PrismaRepository<'stalkerProjectCategory'>,
    private _view: PrismaRepository<'stalkerSavedView'>,
    private _cursor: PrismaRepository<'stalkerScanCursor'>,
    private _alert: PrismaRepository<'stalkerAlert'>,
    private _group: PrismaRepository<'stalkerKeywordGroup'>,
    private _rule: PrismaRepository<'stalkerAlertRule'>,
    private _member: PrismaRepository<'userOrganization'>,
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
        excludeAccounts?: string;
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
          digestEnabled: true,
          digestDismissed: false,
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
      const brand = await tx.stalkerKeywordGroup.create({
        data: { projectId: project.id, name: 'My brand', position: 0 },
      });
      await tx.stalkerKeywordGroup.create({
        data: { projectId: project.id, name: 'Competitors', position: 1 },
      });
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
            groupId: brand.id,
            excludeAccounts: keyword.excludeAccounts || '',
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
      include: { group: { select: { id: true, name: true } } },
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
    },
    extra?: { groupId?: string | null; excludeAccounts?: string }
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
        groupId: extra?.groupId || null,
        excludeAccounts: extra?.excludeAccounts || '',
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
        // Mentions collected only because of this keyword go with it. A keyword
        // equal to the brand/alias just unlinks (brand mentions stay).
        const project = await tx.stalkerProject.findFirst({
          where: { id: keyword.projectId, organizationId },
          select: { name: true, brandName: true, aliases: true },
        });
        const brandTerms = [project?.brandName || project?.name || '', ...(project?.aliases || '').split(/[\n,]/)]
          .map((term) => term.trim().toLowerCase())
          .filter((term) => term.length >= 2);
        if (!brandTerms.includes(keyword.phrase.trim().toLowerCase())) {
          await tx.stalkerMention.deleteMany({
            where: { organizationId, keywordId: keyword.id },
          });
        }
      }
      return tx.stalkerKeyword.deleteMany({
        where: { id, organizationId },
      });
    });
  }

  async existingKeywordIds(projectId: string, ids: string[]) {
    if (!ids.length) {
      return new Set<string>();
    }
    const rows = await this._keyword.model.stalkerKeyword.findMany({
      where: { projectId, id: { in: ids } },
      select: { id: true },
    });
    return new Set(rows.map((row) => row.id));
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

  listDueProjects(cutoff: Date) {
    return this._project.model.stalkerProject.findMany({
      where: {
        keywords: { some: {} },
        OR: [{ lastScanAt: null }, { lastScanAt: { lt: cutoff } }],
      },
      select: { id: true, organizationId: true },
      orderBy: { lastScanAt: 'asc' },
    });
  }

  touchLastScan(projectId: string) {
    return this._project.model.stalkerProject.updateMany({
      where: { id: projectId },
      data: { lastScanAt: new Date() },
    });
  }

  createScanRun(input: {
    organizationId: string;
    projectId: string;
    trigger: string;
    status?: string;
  }) {
    return this._scan.model.stalkerScanRun.create({
      data: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        trigger: input.trigger,
        status: input.status || 'queued',
        error: '',
      },
    });
  }

  markScanRunning(id: string) {
    return this._scan.model.stalkerScanRun.updateMany({
      where: { id },
      data: { status: 'running' },
    });
  }

  finishScanRun(
    id: string,
    status: string,
    result: Prisma.InputJsonValue | null,
    error: string
  ) {
    return this._scan.model.stalkerScanRun.updateMany({
      where: { id },
      data: {
        status,
        finishedAt: new Date(),
        error: error.slice(0, 500),
        ...(result ? { result } : {}),
      },
    });
  }

  latestScan(projectId: string) {
    return this._scan.model.stalkerScanRun.findFirst({
      where: { projectId },
      orderBy: { startedAt: 'desc' },
    });
  }

  activeScan(projectId: string) {
    return this._scan.model.stalkerScanRun.findFirst({
      where: {
        projectId,
        status: { in: ['queued', 'running'] },
        startedAt: { gt: new Date(Date.now() - 20 * 60 * 1000) },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  latestManualScan(projectId: string, since: Date) {
    return this._scan.model.stalkerScanRun.findFirst({
      where: { projectId, trigger: 'manual', startedAt: { gt: since } },
      orderBy: { startedAt: 'desc' },
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
      excludeAccounts?: string;
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
    if (typeof platforms.excludeAccounts === 'string') {
      data.excludeAccounts = platforms.excludeAccounts.trim().slice(0, 400);
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
    // Store plain text: sources (YouTube titles especially) send HTML entities
    // like &amp;, and some handles already start with "@".
    for (const raw of drafts) {
      const draft = {
        ...raw,
        authorName: decodeHtmlEntities(raw.authorName),
        authorHandle: normalizeHandle(raw.authorHandle),
        text: decodeHtmlEntities(raw.text),
      };
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
      start?: string;
      end?: string;
      source?: string;
      from?: string;
      keywordId?: string;
      categoryId?: string;
      sentiment?: string;
      status?: string;
      minUrgency?: number;
      engagement?: string;
      q?: string;
      match?: string;
      offTopic?: string;
      tz?: number | string;
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
    const ranged = mentionRange(filters.start, filters.end, filters.tz);
    const since = ranged.start || mentionWindow(filters.date);
    if (since || ranged.end) {
      where.createdAt = {
        ...(since ? { gte: since } : {}),
        ...(ranged.end ? { lt: ranged.end } : {}),
      };
    }
    const sources = sourceList(filters.source);
    if (sources.length === 1) {
      where.source = sources[0];
    } else if (sources.length > 1) {
      where.source = { in: sources };
    }
    const engagement = engagementClauses(filters.engagement);
    if (engagement.length) {
      const existing = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
      where.AND = [...existing, { OR: engagement }];
    }
    if (filters.from?.trim()) {
      const from = filters.from.trim().replace(/^@/, '');
      where.OR = [
        { authorName: { contains: from, mode: 'insensitive' } },
        { authorHandle: { contains: from, mode: 'insensitive' } },
      ];
    }
    if (filters.keywordId) {
      where.keywordId = filters.keywordId;
    }
    if (filters.categoryId === 'none') {
      where.categoryId = null;
    } else if (filters.categoryId) {
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
      const existing = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
      where.AND = [
        ...existing,
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
      .then(async (rows) => {
        const mentions = rows.slice(0, take);
        const hiddenOffTopic =
          filters.offTopic !== 'include' && !filters.cursor
            ? await this._mention.model.stalkerMention.count({
                where: { ...where, relevant: false },
              })
            : 0;
        return {
          mentions,
          nextCursor: rows.length > take ? mentions[mentions.length - 1]?.id || null : null,
          hiddenOffTopic,
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
      select: {
        id: true,
        text: true,
        source: true,
        matchKind: true,
        keywordId: true,
      },
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

  setMentionRelevant(organizationId: string, id: string, relevant: boolean) {
    return this._mention.model.stalkerMention.updateMany({
      where: { id, organizationId },
      data: { relevant },
    });
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

  async analytics(
    organizationId: string,
    projectId: string,
    date = '30d',
    range?: { start?: string; end?: string; tz?: number | string }
  ) {
    const ranged = mentionRange(range?.start, range?.end, range?.tz);
    const since =
      ranged.start ||
      (date === 'all' ? undefined : mentionWindow(date) || mentionWindow('30d'));
    const where = {
      organizationId,
      projectId,
      relevant: true,
      ...(since || ranged.end
        ? {
            createdAt: {
              ...(since ? { gte: since } : {}),
              ...(ranged.end ? { lt: ranged.end } : {}),
            },
          }
        : {}),
    };
    const [bySource, bySentiment, byCategory, byKeyword, byTheme, accounts] =
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
    };
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
        authorHandle: true,
        text: true,
        url: true,
        urgency: true,
        category: true,
        sentiment: true,
        source: true,
        keywordId: true,
        categoryId: true,
        likeCount: true,
        replyCount: true,
        categoryDef: { select: { name: true } },
        keyword: { select: { group: { select: { name: true } } } },
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

  listGroups(projectId: string) {
    return this._group.model.stalkerKeywordGroup.findMany({
      where: { projectId },
      orderBy: { position: 'asc' },
      include: { _count: { select: { keywords: true } } },
    });
  }

  async ensureGroups(projectId: string) {
    const existing = await this.listGroups(projectId);
    if (existing.length) {
      const brand = existing.find((group) => group.name === 'My brand');
      if (brand) {
        await this._keyword.model.stalkerKeyword.updateMany({
          where: { projectId, groupId: null },
          data: { groupId: brand.id },
        });
      }
      return existing;
    }
    await this._group.model.stalkerKeywordGroup.createMany({
      data: [
        { projectId, name: 'My brand', position: 0 },
        { projectId, name: 'Competitors', position: 1 },
      ],
      skipDuplicates: true,
    });
    const groups = await this.listGroups(projectId);
    const brand = groups.find((group) => group.name === 'My brand');
    if (brand) {
      await this._keyword.model.stalkerKeyword.updateMany({
        where: { projectId, groupId: null },
        data: { groupId: brand.id },
      });
    }
    return groups;
  }

  createGroup(projectId: string, name: string, position: number) {
    return this._group.model.stalkerKeywordGroup.create({
      data: { projectId, name, position },
    });
  }

  deleteGroup(projectId: string, id: string) {
    return this._group.model.stalkerKeywordGroup.deleteMany({
      where: { id, projectId },
    });
  }

  moveKeyword(organizationId: string, id: string, groupId: string) {
    return this._keyword.model.stalkerKeyword.updateMany({
      where: { id, organizationId },
      data: { groupId },
    });
  }

  keywordFacts(organizationId: string, projectId: string, since: Date) {
    return this._mention.model.stalkerMention.findMany({
      where: {
        organizationId,
        projectId,
        relevant: true,
        keywordId: { not: null },
        createdAt: { gte: since },
      },
      select: { keywordId: true, createdAt: true, source: true },
      take: 5000,
    });
  }

  mentionFacts(
    organizationId: string,
    projectId: string,
    since?: Date,
    end?: Date
  ) {
    return this._mention.model.stalkerMention.findMany({
      where: {
        organizationId,
        projectId,
        relevant: true,
        ...(since || end
          ? {
              createdAt: {
                ...(since ? { gte: since } : {}),
                ...(end ? { lt: end } : {}),
              },
            }
          : {}),
      },
      select: {
        createdAt: true,
        sentiment: true,
        authorName: true,
        authorHandle: true,
        source: true,
        categoryId: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 4000,
    });
  }

  authors(organizationId: string, projectId: string) {
    return this._mention.model.stalkerMention.groupBy({
      by: ['authorName', 'authorHandle', 'source'],
      where: { organizationId, projectId, relevant: true },
      _count: { _all: true },
      orderBy: { _count: { authorName: 'desc' } },
      take: 40,
    });
  }

  listAlertRules(organizationId: string, projectId: string) {
    return this._rule.model.stalkerAlertRule.findMany({
      where: { organizationId, projectId },
      orderBy: { createdAt: 'asc' },
    });
  }

  createAlertRule(
    organizationId: string,
    projectId: string,
    name: string,
    filters: Prisma.InputJsonValue
  ) {
    return this._rule.model.stalkerAlertRule.create({
      data: { organizationId, projectId, name, filters },
    });
  }

  deleteAlertRule(organizationId: string, id: string) {
    return this._rule.model.stalkerAlertRule.deleteMany({
      where: { id, organizationId },
    });
  }

  countSentEmails(organizationId: string, since: Date) {
    return this._alert.model.stalkerAlert.count({
      where: {
        organizationId,
        channel: 'EMAIL',
        status: 'SENT',
        sentAt: { gte: since },
      },
    });
  }

  ownerContact(organizationId: string) {
    return this._member.model.userOrganization.findFirst({
      where: { organizationId, disabled: false },
      orderBy: { createdAt: 'asc' },
      select: {
        user: { select: { email: true, timezone: true } },
      },
    });
  }

  deleteProject(organizationId: string, id: string) {
    return this._project.model.stalkerProject.deleteMany({
      where: { id, organizationId },
    });
  }

  async replaceCategories(
    organizationId: string,
    projectId: string,
    categories: { id?: string; name: string; description: string }[]
  ) {
    const current = await this.listCategories(organizationId, projectId);
    const keep = new Set(
      categories.map((category) => category.id).filter((id): id is string => !!id)
    );
    const remove = current.filter((category) => !keep.has(category.id));
    await this._transaction.model.$transaction(async (tx) => {
      if (remove.length) {
        await tx.stalkerProjectCategory.deleteMany({
          where: { id: { in: remove.map((category) => category.id) }, projectId },
        });
      }
      for (const [index, category] of categories.entries()) {
        if (category.id && current.some((item) => item.id === category.id)) {
          await tx.stalkerProjectCategory.updateMany({
            where: { id: category.id, projectId },
            data: {
              name: category.name,
              description: category.description,
              position: index,
            },
          });
          continue;
        }
        await tx.stalkerProjectCategory.create({
          data: {
            projectId,
            name: category.name,
            description: category.description,
            position: index,
          },
        });
      }
    });
    return this.listCategories(organizationId, projectId);
  }

  projectByToken(token: string) {
    return this._project.model.stalkerProject.findFirst({
      where: { publicToken: token, publicDashboard: true },
      include: { categories: { orderBy: { position: 'asc' } } },
    });
  }

  markDigestSent(projectId: string, day: string) {
    return this._project.model.stalkerProject.updateMany({
      where: { id: projectId },
      data: { digestSentOn: day },
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
