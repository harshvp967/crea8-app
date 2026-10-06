import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Integration,
  Prisma,
  StalkerAlertChannel,
  StalkerAlertDelivery,
  StalkerAlertKind,
  StalkerAlertScope,
  StalkerAlertStatus,
  StalkerCategory,
  StalkerMentionStatus,
  StalkerSentiment,
} from '@prisma/client';
import { StalkerRepository } from '@gitroom/nestjs-libraries/database/prisma/stalker/stalker.repository';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { OpenaiService } from '@gitroom/nestjs-libraries/openai/openai.service';
import { StalkerSourceManager } from '@gitroom/nestjs-libraries/stalker/stalker.source.manager';
import { StalkerSourceId } from '@gitroom/nestjs-libraries/stalker/stalker.source';
import { isProviderAuthFailure } from '@gitroom/nestjs-libraries/stalker/sources/youtube.stalker.source';
import { formatXFailure } from '@gitroom/nestjs-libraries/stalker/sources/x.stalker.source';
import { RefreshIntegrationService } from '@gitroom/nestjs-libraries/integrations/refresh.integration.service';
import {
  BACKFILL_LOOKBACK_MS,
  cleanHandle,
  dedupeDrafts,
  fallbackClassification,
  handleForSource,
  mentionMatchesScope,
  readIdentity,
  resolveScanSince,
  sentimentShare,
  SENTIMENT_WINDOW_MS,
  shouldFireSentimentDrop,
  shouldFireVolumeSpike,
  SPIKE_WINDOW_MS,
  splitTerms,
  tagDrafts,
  type StalkerAlertScopeName,
} from '@gitroom/nestjs-libraries/stalker/stalker.match';
import {
  CreateStalkerKeywordDto,
  CreateStalkerProjectDto,
  CreateStalkerViewDto,
  StalkerDraftDto,
  StalkerIdentityDto,
  StalkerMentionQueryDto,
  StalkerReplyDto,
  StalkerSaveMentionDto,
  UpdateStalkerKeywordDto,
  UpdateStalkerProjectDto,
} from '@gitroom/nestjs-libraries/dtos/stalker/stalker.dto';
import { StalkerMentionDraft } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { EmailService } from '@gitroom/nestjs-libraries/services/email.service';
import { isSafePublicHttpsUrl } from '@gitroom/nestjs-libraries/dtos/webhooks/webhook.url.validator';
import { getSsrfSafeDispatcher } from '@gitroom/nestjs-libraries/dtos/webhooks/ssrf.safe.dispatcher';
import { randomUUID } from 'crypto';
import { TemporalService } from 'nestjs-temporal-core';
import { WorkflowIdConflictPolicy } from '@temporalio/client';

export const isStalkerEnabled = () => process.env.STALKER_ENABLED === 'true';

const MAX_KEYWORDS = 10;
const POLL_HOURS = 6;
const MANUAL_SCAN_GAP_MS = 2 * 60 * 1000;

export const stalkerPollMinutes = () => {
  const value = Number(process.env.STALKER_POLL_MINUTES || 60);
  if (!Number.isFinite(value) || value < 5) {
    return 60;
  }
  return Math.round(value);
};

export const stalkerProjectIntervalMs = () => {
  const value = Number(process.env.STALKER_PROJECT_INTERVAL_HOURS || POLL_HOURS);
  const hours = !Number.isFinite(value) || value <= 0 ? POLL_HOURS : value;
  return hours * 60 * 60 * 1000;
};

export type StalkerScanTrigger = 'schedule' | 'create' | 'keyword' | 'manual';

export const orderKeywordsForScan = <T extends { phrase: string }>(
  keywords: T[],
  cursors: { source: string; phraseKey: string; updatedAt: Date }[],
  source: string
) => {
  const updated = new Map(
    cursors
      .filter((cursor) => cursor.source === source)
      .map((cursor) => [cursor.phraseKey, cursor.updatedAt.getTime()])
  );
  return [...keywords].sort((left, right) => {
    const leftAt = updated.get(left.phrase.toLowerCase()) ?? 0;
    const rightAt = updated.get(right.phrase.toLowerCase()) ?? 0;
    if (leftAt !== rightAt) {
      return leftAt - rightAt;
    }
    return left.phrase.localeCompare(right.phrase);
  });
};

const scanSourceId = (value: string) => {
  if (value.startsWith('YOUTUBE')) return 'youtube';
  if (value.startsWith('REDDIT')) return 'reddit';
  if (value.startsWith('X_') || value === 'X') return 'x';
  if (value.startsWith('LINKEDIN')) return 'linkedin';
  return '';
};

const alreadyRunning = (err: unknown) => {
  const name =
    err && typeof err === 'object' && 'name' in err
      ? String((err as { name: string }).name)
      : '';
  const message = err instanceof Error ? err.message : '';
  return /AlreadyStarted|already started|already running/i.test(`${name} ${message}`);
};
const POLL_WINDOW_MS = POLL_HOURS * 60 * 60 * 1000;
const SEARCH_SINCE_MS = 7 * 24 * 60 * 60 * 1000;
const TOKEN_REFRESH_LEEWAY_MS = 5 * 60 * 1000;

export type StalkerPollSource = {
  projectId: string;
  id: string;
  ok: boolean;
  searched: number;
  found: number;
  stored: number;
  error?: string;
};

export type StalkerPollResult = {
  sources: StalkerPollSource[];
  totals: {
    found: number;
    stored: number;
    duplicates: number;
    offTopic: number;
  };
};

const emptyTotals = () => ({
  found: 0,
  stored: 0,
  duplicates: 0,
  offTopic: 0,
});

const safeProviderError = (err: unknown) => {
  const message = err instanceof Error ? err.message : 'Search failed';
  return message.replace(/ya29\.[A-Za-z0-9._-]+/g, '[token]').slice(0, 180);
};

const sourceFailure = (id: string, detail?: string) => {
  if (id === 'reddit') {
    return 'Reddit: needs API access';
  }
  if (id === 'x') {
    return formatXFailure(detail);
  }
  if (id === 'linkedin') {
    return 'LinkedIn: Coming soon';
  }
  if (id === 'youtube') {
    if (detail && /token|credential|reconnect/i.test(detail)) {
      return 'YouTube: channel token expired. Reconnect YouTube in Channels';
    }
    return detail ? `YouTube: ${detail}` : 'YouTube: Connect a YouTube channel';
  }
  return detail || 'Search failed';
};

const tokenExpiresSoon = (tokenExpiration?: Date | null) => {
  if (!tokenExpiration) {
    return false;
  }
  return tokenExpiration.getTime() <= Date.now() + TOKEN_REFRESH_LEEWAY_MS;
};

const PROJECT_COLORS = [
  '#71717a',
  '#7e47eb',
  '#9947eb',
  '#477eeb',
  '#47b4eb',
  '#47ebb4',
  '#47eb7e',
  '#ebd047',
  '#eb9947',
  '#eb4747',
  '#eb477e',
  '#00D9FF',
  '#7C5CFF',
  '#FFB020',
  '#FF6B6B',
  '#3DDC97',
  '#E8E8E8',
];

const DAILY_EMAIL_CAP = 3;

const HANDLE_FIELD: Record<
  string,
  'x' | 'youtube' | 'linkedin' | 'instagram' | 'facebook'
> = {
  x: 'x',
  youtube: 'youtube',
  linkedin: 'linkedin',
  'linkedin-page': 'linkedin',
  instagram: 'instagram',
  'instagram-standalone': 'instagram',
  facebook: 'facebook',
};

const listenField: Record<
  StalkerSourceId,
  'listenYoutube' | 'listenReddit' | 'listenX' | 'listenLinkedin'
> = {
  youtube: 'listenYoutube',
  reddit: 'listenReddit',
  x: 'listenX',
  linkedin: 'listenLinkedin',
};

const legacyCategory = (name: string): StalkerCategory => {
  const value = name.toLowerCase();
  if (value.includes('bug')) {
    return StalkerCategory.BUG;
  }
  if (value.includes('feature') || value.includes('idea')) {
    return StalkerCategory.IDEA;
  }
  if (value.includes('complain')) {
    return StalkerCategory.COMPLAINT;
  }
  if (value.includes('question')) {
    return StalkerCategory.QUESTION;
  }
  if (value.includes('testimonial')) {
    return StalkerCategory.TESTIMONIAL;
  }
  if (value.includes('praise')) {
    return StalkerCategory.PRAISE;
  }
  if (value.includes('spam')) {
    return StalkerCategory.SPAM;
  }
  return StalkerCategory.OTHER;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const sentimentCount = (
  rows: { sentiment: string; _count: { _all: number } }[],
  sentiment: string
) => rows.find((row) => row.sentiment === sentiment)?._count._all || 0;

const csvCell = (value: string | number | null | undefined) =>
  `"${String(value ?? '').replace(/"/g, '""')}"`;

const clampInt = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.round(value)));

const sourceFamily = (source: string) => {
  if (source.startsWith('X')) return 'X';
  if (source.startsWith('REDDIT')) return 'REDDIT';
  if (source.startsWith('YOUTUBE')) return 'YOUTUBE';
  if (source.startsWith('LINKEDIN')) return 'LINKEDIN';
  if (source.startsWith('INSTAGRAM')) return 'INSTAGRAM';
  if (source.startsWith('FACEBOOK')) return 'FACEBOOK';
  return source;
};

const stalkerAnalyticsDetail = (
  facts: {
    createdAt: Date;
    sentiment: string;
    authorName: string;
    authorHandle: string;
    source: string;
  }[]
) => {
  const days = new Map<
    string,
    { positive: number; negative: number; neutral: number }
  >();
  const supporters = new Map<string, { authorName: string; count: number }>();
  const critics = new Map<string, { authorName: string; count: number }>();
  const heat = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const fact of facts) {
    const key = fact.createdAt.toISOString().slice(0, 10);
    const bucket = days.get(key) || { positive: 0, negative: 0, neutral: 0 };
    if (fact.sentiment === 'POSITIVE') bucket.positive += 1;
    else if (fact.sentiment === 'NEGATIVE') bucket.negative += 1;
    else bucket.neutral += 1;
    days.set(key, bucket);
    const author = fact.authorName || 'Unknown';
    if (fact.sentiment === 'POSITIVE') {
      const row = supporters.get(author) || { authorName: author, count: 0 };
      row.count += 1;
      supporters.set(author, row);
    }
    if (fact.sentiment === 'NEGATIVE') {
      const row = critics.get(author) || { authorName: author, count: 0 };
      row.count += 1;
      critics.set(author, row);
    }
    const weekday = (fact.createdAt.getUTCDay() + 6) % 7;
    heat[weekday][fact.createdAt.getUTCHours()] += 1;
  }
  const series = [...days.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, counts]) => ({ date, ...counts }));
  const total = facts.length;
  const span = Math.max(1, series.length);
  return {
    series,
    avgPerDay: Math.round((total / span) * 10) / 10,
    supporters: [...supporters.values()].sort((a, b) => b.count - a.count).slice(0, 5),
    critics: [...critics.values()].sort((a, b) => b.count - a.count).slice(0, 5),
    heatmap: heat,
  };
};

const digestClock = (timezone: string) => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC',
      hour: '2-digit',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const read = (type: string) =>
      parts.find((part) => part.type === type)?.value || '';
    const month = read('month').padStart(2, '0');
    const day = read('day').padStart(2, '0');
    return {
      hour: Number(read('hour')),
      day: `${read('year')}-${month}-${day}`,
    };
  } catch {
    const now = new Date();
    return { hour: now.getUTCHours(), day: now.toISOString().slice(0, 10) };
  }
};

const ruleMatches = (
  filters: Record<string, unknown>,
  row: {
    source: string;
    authorName: string;
    authorHandle: string;
    keywordId: string | null;
    categoryId: string | null;
    sentiment: string;
    likeCount: number;
    replyCount: number;
  }
) => {
  const listed = String(filters.sources || filters.source || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (listed.length) {
    const family = sourceFamily(row.source);
    if (!listed.includes(family) && !listed.includes(row.source)) {
      return false;
    }
  }
  const engagement = String(filters.engagement || '');
  if (engagement) {
    const family = sourceFamily(row.source);
    for (const part of engagement.split(',')) {
      const [name, amount] = part.split(':');
      const min = Number(amount);
      if (!name || !Number.isFinite(min) || min <= 0) {
        continue;
      }
      if (name === family || name === row.source) {
        if (row.likeCount + row.replyCount < min) {
          return false;
        }
      }
    }
  }
  const from = String(filters.from || '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
  if (from) {
    const blob = `${row.authorName} ${row.authorHandle}`.toLowerCase();
    if (!blob.includes(from)) {
      return false;
    }
  }
  if (filters.keywordId && row.keywordId !== filters.keywordId) {
    return false;
  }
  if (filters.categoryId === 'none' && row.categoryId) {
    return false;
  }
  if (
    filters.categoryId &&
    filters.categoryId !== 'none' &&
    row.categoryId !== filters.categoryId
  ) {
    return false;
  }
  if (filters.sentiment && row.sentiment !== filters.sentiment) {
    return false;
  }
  return true;
};

@Injectable()
export class StalkerService {
  constructor(
    private _repository: StalkerRepository,
    private _integrationManager: IntegrationManager,
    private _sources: StalkerSourceManager,
    private _openaiService: OpenaiService,
    private _emailService: EmailService,
    private _refreshIntegrationService: RefreshIntegrationService,
    private _temporalService: TemporalService
  ) {}

  assertEnabled() {
    if (!isStalkerEnabled()) {
      throw new NotFoundException('Stalker is disabled');
    }
  }

  async status(organizationId: string) {
    this.assertEnabled();
    const integrations = await this.organizationIntegrations(organizationId);
    const sources = this._sources.all().map((source) => {
      const identifier = source.integrationIdentifier();
      const integration = identifier
        ? integrations.find(
            (item) => item.providerIdentifier === identifier
          )
        : undefined;
      const available = source.enabled(
        identifier ? { accessToken: integration?.token } : undefined
      );
      return {
        id: source.id,
        label: source.label,
        filter: source.filter,
        available,
        detail: source.statusDetail(available),
      };
    });
    const commentSources = this._integrationManager
      .stalkerCommentSources()
      .map((source) => ({
        id: source.id,
        label: source.label,
        available: integrations.some((integration) => {
          const provider = this._integrationManager.getSocialIntegration(
            integration.providerIdentifier
          );
          return provider?.stalkerComments?.filter === source.id;
        }),
      }));
    const suggestedHandles: Record<string, string> = {};
    for (const integration of integrations) {
      const field = HANDLE_FIELD[integration.providerIdentifier];
      if (!field || suggestedHandles[field]) {
        continue;
      }
      const handle = cleanHandle(integration.profile || integration.name || '');
      if (handle) {
        suggestedHandles[field] = handle;
      }
    }
    return {
      enabled: true,
      pollHours: POLL_HOURS,
      pollMinutes: stalkerPollMinutes(),
      maxKeywords: MAX_KEYWORDS,
      keywordsSearchedPerRun: MAX_KEYWORDS,
      openAi: this._openaiService.hasApiKey(),
      sources,
      commentSources,
      suggestedHandles,
      ownerEmail: (await this._repository.ownerContact(organizationId))?.user.email || '',
      emailCap: DAILY_EMAIL_CAP,
    };
  }

  projects(organizationId: string) {
    this.assertEnabled();
    return this._repository.listProjects(organizationId);
  }

  async createProject(organizationId: string, body: CreateStalkerProjectDto) {
    this.assertEnabled();
    const color = PROJECT_COLORS.find(
      (item) => item.toLowerCase() === body.color.toLowerCase()
    );
    if (!color) {
      throw new BadRequestException('Pick a project color');
    }
    const seenPhrases = new Set<string>();
    const keywords = [];
    for (const keyword of body.keywords || []) {
      const phrase = keyword.phrase.trim().replace(/\s+/g, ' ');
      const key = phrase.toLowerCase();
      if (phrase.length < 2 || seenPhrases.has(key)) {
        continue;
      }
      seenPhrases.add(key);
      if (keywords.length >= MAX_KEYWORDS) {
        break;
      }
      keywords.push({
        phrase,
        youtube: keyword.youtube !== false,
        reddit: !!keyword.reddit,
        x: !!keyword.x,
        linkedin: !!keyword.linkedin,
      });
    }
    const seenCategories = new Set<string>();
    const categories = [];
    for (const category of body.categories || []) {
      const name = category.name.trim();
      const key = name.toLowerCase();
      if (name.length < 2 || seenCategories.has(key)) {
        continue;
      }
      seenCategories.add(key);
      categories.push({
        name,
        description: (category.description || '').trim(),
      });
    }
    if (!categories.length) {
      throw new BadRequestException('Add at least one category');
    }
    const identity = await this.identityFields(body, body.name.trim(), false);
    if (!identity.alertEmail) {
      const owner = await this._repository.ownerContact(organizationId);
      if (owner?.user.email) {
        identity.alertEmail = owner.user.email;
      }
    }
    const project = await this._repository.createProject(organizationId, {
      name: body.name.trim(),
      description: (body.description || '').trim(),
      color,
      keywords,
      categories,
      identity,
    });
    if (keywords.length) {
      await this.requestScan(organizationId, project.id, 'create').catch((err) => {
        console.error('Stalker scan after create failed', project.id, err);
      });
    }
    return this._repository.getProject(organizationId, project.id);
  }

  async updateProject(
    organizationId: string,
    id: string,
    body: UpdateStalkerProjectDto
  ) {
    this.assertEnabled();
    const current = await this.requireProject(organizationId, id);
    const identity = await this.identityFields(
      body,
      current.brandName || current.name,
      true
    );
    const data: Prisma.StalkerProjectUpdateManyMutationInput = { ...identity };
    if (body.name?.trim()) {
      data.name = body.name.trim();
    }
    if (typeof body.description === 'string') {
      data.description = body.description.trim();
    }
    if (body.color) {
      const color = PROJECT_COLORS.find(
        (item) => item.toLowerCase() === body.color!.toLowerCase()
      );
      if (!color) {
        throw new BadRequestException('Pick a project color');
      }
      data.color = color;
    }
    if (typeof body.publicDashboard === 'boolean') {
      data.publicDashboard = body.publicDashboard;
      if (body.publicDashboard && !current.publicToken) {
        data.publicToken = randomUUID().replace(/-/g, '');
      }
    }
    const updated = await this._repository.updateProject(
      organizationId,
      id,
      data
    );
    if (!updated.count) {
      throw new NotFoundException('Project not found');
    }
    return this._repository.getProject(organizationId, id);
  }

  async mentions(organizationId: string, query: StalkerMentionQueryDto) {
    this.assertEnabled();
    await this.requireProject(organizationId, query.projectId);
    return this._repository.listMentions(organizationId, query);
  }

  async setMentionStatus(
    organizationId: string,
    id: string,
    status: StalkerMentionStatus
  ) {
    this.assertEnabled();
    const updated = await this._repository.setMentionStatus(
      organizationId,
      id,
      status
    );
    if (!updated.count) {
      throw new NotFoundException('Mention not found');
    }
    return { updated: true };
  }

  async keywords(organizationId: string, projectId: string) {
    this.assertEnabled();
    await this.requireProject(organizationId, projectId);
    await this._repository.ensureGroups(projectId);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [rows, cursors, facts, groups, active] = await Promise.all([
      this._repository.listKeywords(organizationId, projectId),
      this._repository.listCursors(projectId),
      this._repository.keywordFacts(organizationId, projectId, since),
      this._repository.listGroups(projectId),
      this._repository.activeScan(projectId),
    ]);
    const sparks = new Map<string, number[]>();
    const dayIndex = (date: Date) => {
      const start = new Date(since);
      start.setHours(0, 0, 0, 0);
      const point = new Date(date);
      point.setHours(0, 0, 0, 0);
      return Math.floor((point.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    };
    for (const fact of facts) {
      if (!fact.keywordId) {
        continue;
      }
      const series = sparks.get(fact.keywordId) || Array.from({ length: 30 }, () => 0);
      const index = dayIndex(fact.createdAt);
      if (index >= 0 && index < 30) {
        series[index] += 1;
      }
      sparks.set(fact.keywordId, series);
    }
    return rows.map((row) => {
      const phraseKey = row.phrase.toLowerCase();
      const sources = (
        ['youtube', 'reddit', 'x', 'linkedin'] as const
      ).map((id) => {
        const on = !!row[listenField[id]];
        const cursor = cursors.find(
          (item) => item.source === id && item.phraseKey === phraseKey
        );
        const found = facts.filter(
          (fact) =>
            fact.keywordId === row.id && scanSourceId(String(fact.source)) === id
        ).length;
        const detail = {
          lastScanAt: cursor?.updatedAt ? cursor.updatedAt.toISOString() : null,
          lastError: cursor?.lastError || '',
          lastFound: found,
        };
        if (!on) {
          return { id, state: 'off' as const, ...detail };
        }
        if (cursor?.backfillUntil && cursor.lastError) {
          return {
            id,
            state: 'failed' as const,
            error: cursor.lastError,
            ...detail,
          };
        }
        if (cursor?.backfillUntil) {
          return { id, state: 'queued' as const, ...detail };
        }
        if (cursor?.backfillDone) {
          return { id, state: 'done' as const, ...detail };
        }
        return { id, state: 'idle' as const, ...detail };
      });
      const scans = cursors.filter((item) => item.phraseKey === phraseKey);
      const last = scans
        .map((item) => item.updatedAt)
        .sort((left, right) => right.getTime() - left.getTime())[0];
      const failed = scans
        .filter((item) => item.lastError)
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0];
      const series = sparks.get(row.id) || Array.from({ length: 30 }, () => 0);
      const nextScanAt = last
        ? new Date(last.getTime() + stalkerProjectIntervalMs()).toISOString()
        : new Date().toISOString();
      return {
        ...row,
        backfillArmed: sources.some((source) => source.state === 'queued'),
        backfill: sources,
        mentions30d: series.reduce((sum, count) => sum + count, 0),
        sparkline: series,
        lastScan: last ? last.toISOString() : null,
        lastError: failed?.lastError || '',
        nextScanAt,
        scanning: !!active,
        groups,
      };
    });
  }

  async requestBackfill(organizationId: string, id: string) {
    this.assertEnabled();
    const keyword = await this._repository.getKeyword(organizationId, id);
    if (!keyword?.projectId) {
      throw new NotFoundException('Keyword not found');
    }
    const sources = [
      keyword.listenYoutube ? 'youtube' : '',
      keyword.listenReddit ? 'reddit' : '',
      keyword.listenX ? 'x' : '',
      keyword.listenLinkedin ? 'linkedin' : '',
    ].filter((source) => source);
    if (!sources.length) {
      throw new BadRequestException('Turn on a source for this keyword first');
    }
    const until = new Date(Date.now() - BACKFILL_LOOKBACK_MS);
    await this._repository.armBackfill(
      keyword.projectId,
      sources,
      keyword.phrase.toLowerCase(),
      until
    );
    return { backfillUntil: until.toISOString(), sources };
  }

  async alerts(
    organizationId: string,
    projectId: string,
    cursor?: string,
    take?: number
  ) {
    this.assertEnabled();
    await this.requireProject(organizationId, projectId);
    return this._repository.listAlerts(organizationId, projectId, cursor, take);
  }

  async markAlertRead(organizationId: string, id: string) {
    this.assertEnabled();
    await this._repository.markAlertRead(organizationId, id);
    return { read: true };
  }

  async retryAlerts(organizationId: string, projectId: string) {
    this.assertEnabled();
    const project = await this.requireProject(organizationId, projectId);
    await this.dispatchAlerts(organizationId, project, []);
    return { ok: true };
  }

  async exportMentions(organizationId: string, query: StalkerMentionQueryDto) {
    this.assertEnabled();
    await this.requireProject(organizationId, query.projectId);
    const rows = [];
    let cursor = query.cursor;
    while (rows.length < 1000) {
      const page = await this._repository.listMentions(organizationId, {
        ...query,
        take: 100,
        cursor,
      });
      rows.push(...page.mentions);
      if (!page.nextCursor || page.mentions.length === 0) {
        break;
      }
      cursor = page.nextCursor;
    }
    const header = [
      'createdAt',
      'source',
      'author',
      'handle',
      'category',
      'sentiment',
      'status',
      'matchedBy',
      'match',
      'text',
      'url',
    ];
    const lines = [header.join(',')];
    for (const row of rows) {
      lines.push(
        [
          csvCell(row.createdAt.toISOString()),
          csvCell(row.source),
          csvCell(row.authorName),
          csvCell(row.authorHandle),
          csvCell(row.categoryDef?.name || row.category),
          csvCell(row.sentiment),
          csvCell(row.status),
          csvCell(row.matchKind || ''),
          csvCell(row.matchLabel),
          csvCell(row.text),
          csvCell(row.url || ''),
        ].join(',')
      );
    }
    return { filename: 'stalker-mentions.csv', csv: lines.join('\n') };
  }

  async createKeyword(organizationId: string, body: CreateStalkerKeywordDto) {
    this.assertEnabled();
    await this.requireProject(organizationId, body.projectId);
    const phrase = body.phrase.trim().replace(/\s+/g, ' ');
    if (phrase.length < 2) {
      throw new BadRequestException('Keyword is too short');
    }
    const existing = await this._repository.findKeyword(
      organizationId,
      body.projectId,
      phrase
    );
    if (existing) {
      return existing;
    }
    const total = await this._repository.countKeywords(
      organizationId,
      body.projectId
    );
    if (total >= MAX_KEYWORDS) {
      throw new BadRequestException(
        `You can save up to ${MAX_KEYWORDS} keywords`
      );
    }
    await this._repository.ensureGroups(body.projectId);
    let groupId = body.groupId || null;
    if (!groupId) {
      const groups = await this._repository.listGroups(body.projectId);
      groupId = groups.find((group) => group.name === 'My brand')?.id || null;
    }
    const created = await this._repository.createKeyword(
      organizationId,
      body.projectId,
      phrase,
      {
        youtube: body.youtube !== false,
        reddit: !!body.reddit,
        x: !!body.x,
        linkedin: !!body.linkedin,
      },
      {
        groupId,
        excludeAccounts: (body.excludeAccounts || '').trim().slice(0, 400),
      }
    );
    await this.requestScan(organizationId, body.projectId, 'keyword').catch((err) => {
      console.error('Stalker scan after keyword failed', body.projectId, err);
    });
    return created;
  }

  async updateKeyword(
    organizationId: string,
    id: string,
    body: UpdateStalkerKeywordDto
  ) {
    this.assertEnabled();
    const keyword = await this._repository.getKeyword(organizationId, id);
    if (!keyword) {
      throw new NotFoundException('Keyword not found');
    }
    if (body.groupId) {
      await this._repository.moveKeyword(organizationId, id, body.groupId);
    }
    const updated = await this._repository.updateKeywordPlatforms(
      organizationId,
      id,
      {
        youtube: typeof body.youtube === 'boolean' ? body.youtube : undefined,
        reddit: typeof body.reddit === 'boolean' ? body.reddit : undefined,
        x: typeof body.x === 'boolean' ? body.x : undefined,
        linkedin: typeof body.linkedin === 'boolean' ? body.linkedin : undefined,
        excludeAccounts:
          typeof body.excludeAccounts === 'string'
            ? body.excludeAccounts
            : undefined,
      }
    );
    if (!updated.count) {
      throw new NotFoundException('Keyword not found');
    }
    const sourceTurnedOn =
      (body.youtube === true && !keyword.listenYoutube) ||
      (body.reddit === true && !keyword.listenReddit) ||
      (body.x === true && !keyword.listenX) ||
      (body.linkedin === true && !keyword.listenLinkedin);
    if (sourceTurnedOn && keyword.projectId) {
      await this.requestScan(organizationId, keyword.projectId, 'keyword').catch(
        (err) => {
          console.error('Stalker scan after keyword failed', keyword.projectId, err);
        }
      );
    }
    return this._repository.getKeyword(organizationId, id);
  }

  async groups(organizationId: string, projectId: string) {
    this.assertEnabled();
    await this.requireProject(organizationId, projectId);
    await this._repository.ensureGroups(projectId);
    return this._repository.listGroups(projectId);
  }

  async createGroup(organizationId: string, projectId: string, name: string) {
    this.assertEnabled();
    await this.requireProject(organizationId, projectId);
    const groups = await this._repository.ensureGroups(projectId);
    const clean = name.trim();
    if (groups.some((group) => group.name.toLowerCase() === clean.toLowerCase())) {
      throw new BadRequestException('That group already exists');
    }
    if (groups.length >= 12) {
      throw new BadRequestException('You can save up to 12 groups');
    }
    return this._repository.createGroup(projectId, clean, groups.length);
  }

  async deleteGroup(organizationId: string, projectId: string, id: string) {
    this.assertEnabled();
    await this.requireProject(organizationId, projectId);
    const groups = await this._repository.listGroups(projectId);
    const group = groups.find((item) => item.id === id);
    if (!group) {
      throw new NotFoundException('Group not found');
    }
    if (group.name === 'My brand' || group.name === 'Competitors') {
      throw new BadRequestException('That group stays on the project');
    }
    if (group._count.keywords) {
      throw new BadRequestException('Move the keywords out of this group first');
    }
    await this._repository.deleteGroup(projectId, id);
    return { deleted: true };
  }

  async authors(organizationId: string, projectId: string) {
    this.assertEnabled();
    await this.requireProject(organizationId, projectId);
    const rows = await this._repository.authors(organizationId, projectId);
    return rows.map((row) => ({
      authorName: row.authorName,
      authorHandle: row.authorHandle,
      source: row.source,
      count: row._count._all,
    }));
  }

  async alertRules(organizationId: string, projectId: string) {
    this.assertEnabled();
    await this.requireProject(organizationId, projectId);
    return this._repository.listAlertRules(organizationId, projectId);
  }

  async createAlertRule(
    organizationId: string,
    projectId: string,
    name: string,
    filters: Record<string, unknown>
  ) {
    this.assertEnabled();
    await this.requireProject(organizationId, projectId);
    const rules = await this._repository.listAlertRules(organizationId, projectId);
    if (rules.length >= 20) {
      throw new BadRequestException('You can save up to 20 alerts');
    }
    return this._repository.createAlertRule(
      organizationId,
      projectId,
      name.trim(),
      filters as Prisma.InputJsonValue
    );
  }

  async deleteAlertRule(organizationId: string, id: string) {
    this.assertEnabled();
    await this._repository.deleteAlertRule(organizationId, id);
    return { deleted: true };
  }

  async saveCategories(
    organizationId: string,
    projectId: string,
    categories: { id?: string; name: string; description?: string }[]
  ) {
    this.assertEnabled();
    await this.requireProject(organizationId, projectId);
    const seen = new Set<string>();
    const clean = [];
    for (const category of categories) {
      const name = category.name.trim();
      const key = name.toLowerCase();
      if (name.length < 2 || seen.has(key)) {
        continue;
      }
      seen.add(key);
      clean.push({
        id: category.id,
        name,
        description: (category.description || '').trim(),
      });
    }
    if (!clean.length) {
      throw new BadRequestException('Add at least one category');
    }
    return this._repository.replaceCategories(organizationId, projectId, clean);
  }

  async deleteProject(organizationId: string, id: string) {
    this.assertEnabled();
    const deleted = await this._repository.deleteProject(organizationId, id);
    if (!deleted.count) {
      throw new NotFoundException('Project not found');
    }
    return { deleted: true };
  }

  async publicBoard(token: string) {
    const project = await this._repository.projectByToken(token);
    if (!project) {
      throw new NotFoundException('Dashboard not found');
    }
    const [mentions, analytics] = await Promise.all([
      this._repository.listMentions(project.organizationId, {
        projectId: project.id,
        date: '30d',
        take: 30,
      }),
      this.analytics(project.organizationId, project.id, '30d'),
    ]);
    return {
      project: {
        name: project.name,
        description: project.description,
        color: project.color,
      },
      mentions: mentions.mentions.map((row) => ({
        id: row.id,
        authorName: row.authorName,
        authorHandle: row.authorHandle,
        text: row.text,
        source: row.source,
        sentiment: row.sentiment,
        createdAt: row.createdAt,
        url: row.url,
        category: row.categoryDef?.name || '',
      })),
      analytics: {
        totals: analytics.totals,
        series: analytics.series,
        bySource: analytics.bySource,
        byCategory: analytics.byCategory,
      },
    };
  }

  async deleteKeyword(organizationId: string, id: string) {
    this.assertEnabled();
    await this._repository.deleteKeyword(organizationId, id);
    return { deleted: true };
  }

  async analytics(
    organizationId: string,
    projectId: string,
    date = '30d',
    range?: { start?: string; end?: string }
  ) {
    this.assertEnabled();
    if (!projectId) {
      throw new BadRequestException('Choose a project');
    }
    await this.requireProject(organizationId, projectId);
    const window = ['24h', '7d', '30d', 'all'].includes(date) ? date : '30d';
    const raw = await this._repository.analytics(
      organizationId,
      projectId,
      window,
      range
    );
    const rangedStart = range?.start ? new Date(`${range.start}T00:00:00.000Z`) : undefined;
    const rangedEnd = range?.end ? new Date(`${range.end}T00:00:00.000Z`) : undefined;
    if (rangedEnd) {
      rangedEnd.setUTCDate(rangedEnd.getUTCDate() + 1);
    }
    const windowSince =
      window === '24h'
        ? new Date(Date.now() - 24 * 60 * 60 * 1000)
        : window === '7d'
          ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          : window === 'all'
            ? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
            : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const facts = await this._repository.mentionFacts(
      organizationId,
      projectId,
      rangedStart || windowSince,
      rangedEnd
    );
    const detail = stalkerAnalyticsDetail(facts);
    return {
      bySource: raw.bySource.map((row) => ({
        source: row.source,
        count: row._count._all,
      })),
      bySentiment: raw.bySentiment.map((row) => ({
        sentiment: row.sentiment,
        count: row._count._all,
      })),
      byCategory: raw.byCategory.map((row) => ({
        categoryId: row.categoryId,
        name: row.categoryId
          ? raw.names.get(row.categoryId) || 'Uncategorized'
          : 'Uncategorized',
        count: row._count._all,
      })),
      overTime: raw.overTime,
      accounts: raw.accounts.map((row) => ({
        authorName: row.authorName,
        count: row._count._all,
      })),
      byKeyword: raw.byKeyword
        .flatMap((row) =>
          row.keywordId
            ? [
                {
                  keywordId: row.keywordId,
                  phrase: raw.keywordNames.get(row.keywordId) || 'Keyword',
                  count: row._count._all,
                },
              ]
            : []
        )
        .sort((left, right) => right.count - left.count)
        .slice(0, 8),
      byTheme: raw.byTheme
        .flatMap((row) =>
          row.themeId
            ? [
                {
                  themeId: row.themeId,
                  title: raw.themeNames.get(row.themeId) || 'Theme',
                  count: row._count._all,
                },
              ]
            : []
        )
        .sort((left, right) => right.count - left.count)
        .slice(0, 8),
      totals: {
        mentions: raw.bySentiment.reduce((sum, row) => sum + row._count._all, 0),
        positive: sentimentCount(raw.bySentiment, 'POSITIVE'),
        negative: sentimentCount(raw.bySentiment, 'NEGATIVE'),
        neutral: sentimentCount(raw.bySentiment, 'NEUTRAL'),
      },
      series: detail.series,
      avgPerDay: detail.avgPerDay,
      supporters: detail.supporters,
      critics: detail.critics,
      heatmap: detail.heatmap,
    };
  }

  async views(organizationId: string, projectId: string) {
    this.assertEnabled();
    await this.requireProject(organizationId, projectId);
    return this._repository.listViews(organizationId, projectId);
  }

  async createView(organizationId: string, body: CreateStalkerViewDto) {
    this.assertEnabled();
    await this.requireProject(organizationId, body.projectId);
    const name = body.name.trim();
    const total = await this._repository.countViews(
      organizationId,
      body.projectId
    );
    if (total >= 20) {
      throw new BadRequestException('You can save up to 20 views');
    }
    try {
      return await this._repository.createView(
        organizationId,
        body.projectId,
        name,
        { ...body.filters } as Prisma.InputJsonValue
      );
    } catch {
      throw new BadRequestException('A view with that name already exists');
    }
  }

  async deleteView(organizationId: string, id: string) {
    this.assertEnabled();
    await this._repository.deleteView(organizationId, id);
    return { deleted: true };
  }

  async reply(organizationId: string, id: string, body: StalkerReplyDto) {
    this.assertEnabled();
    const mention = await this._repository.getMention(organizationId, id);
    if (!mention) {
      throw new NotFoundException('Mention not found');
    }
    if (!mention.integrationId) {
      throw new BadRequestException(
        'This mention is not on a connected account'
      );
    }
    const integration = await this._repository.getIntegration(
      mention.integrationId,
      organizationId
    );
    if (!integration) {
      throw new BadRequestException('The connected account is no longer available');
    }
    const provider = this._integrationManager.getSocialIntegration(
      integration.providerIdentifier
    );
    if (!provider?.stalkerReply) {
      throw new BadRequestException('Replies are not available for this account');
    }
    const bag = this.tokenBag();
    try {
      const called = await this.callWithFreshToken(integration, bag, (current) =>
        provider.stalkerReply({
          accessToken: current.token,
          integration: current,
          postExternalId: mention.postExternalId || undefined,
          externalId: mention.externalId,
          text: body.text.trim(),
        })
      );
      if ('error' in called) {
        throw new BadRequestException(called.error);
      }
    } catch (err) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      console.error('Stalker reply failed', err);
      throw new BadRequestException('The reply was not sent');
    }
    await this._repository.setMentionStatus(
      organizationId,
      id,
      StalkerMentionStatus.REPLIED
    );
    return { sent: true };
  }

  async saveMention(
    organizationId: string,
    id: string,
    body: StalkerSaveMentionDto
  ) {
    this.assertEnabled();
    const mention = await this._repository.getMention(organizationId, id);
    if (!mention?.projectId) {
      throw new NotFoundException('Mention not found');
    }
    const data: {
      saved: boolean;
      category?: StalkerCategory;
      categoryId?: string | null;
    } = { saved: body.saved };
    if (body.saved && body.as) {
      const categories = await this._repository.listCategories(
        organizationId,
        mention.projectId
      );
      const match = categories.find((category) => {
        const name = category.name.toLowerCase();
        return body.as === 'testimonial'
          ? name.includes('testimonial') || name.includes('praise')
          : name.includes('feature') || name.includes('idea');
      });
      if (match) {
        data.categoryId = match.id;
        data.category = legacyCategory(match.name);
      } else {
        data.category =
          body.as === 'testimonial'
            ? StalkerCategory.TESTIMONIAL
            : StalkerCategory.IDEA;
      }
    }
    const updated = await this._repository.saveMention(
      organizationId,
      id,
      data
    );
    if (!updated.count) {
      throw new NotFoundException('Mention not found');
    }
    return { saved: body.saved };
  }

  themes(organizationId: string) {
    this.assertEnabled();
    return this._repository.listThemes(organizationId);
  }

  async draft(organizationId: string, body: StalkerDraftDto) {
    this.assertEnabled();
    if (!body.mentionId && !body.themeId) {
      throw new BadRequestException('Choose a mention or a theme');
    }
    if (body.mode === 'quote' && !body.mentionId) {
      throw new BadRequestException('A quote post needs a mention');
    }

    if (body.mentionId) {
      const mention = await this._repository.getMention(
        organizationId,
        body.mentionId
      );
      if (!mention) {
        throw new NotFoundException('Mention not found');
      }
      const generated = await this._openaiService.draftStalkerPost({
        mode: body.mode,
        title: mention.authorName,
        body: mention.text,
      });
      return {
        content:
          generated ||
          (body.mode === 'quote'
            ? `"${mention.text}"\n\n— ${mention.authorName}`
            : mention.text),
      };
    }

    const theme = await this._repository.getTheme(organizationId, body.themeId!);
    if (!theme) {
      throw new NotFoundException('Theme not found');
    }
    const samples = theme.mentions
      .map((mention) => `${mention.authorName}: ${mention.text}`)
      .join('\n');
    const generated = await this._openaiService.draftStalkerPost({
      mode: 'post',
      title: theme.title,
      body: `${theme.summary}\n\n${samples}`,
    });
    return {
      content: generated || `${theme.title}\n\n${theme.summary}`,
    };
  }

  async pollOrganization(organizationId: string): Promise<StalkerPollResult> {
    this.assertEnabled();
    const projects = await this._repository.listProjects(organizationId);
    if (!projects.length) {
      return { sources: [], totals: emptyTotals() };
    }
    const sources: StalkerPollSource[] = [];
    const totals = emptyTotals();
    for (const project of projects) {
      try {
        const result = await this.scanOneProject(
          organizationId,
          project,
          'schedule'
        );
        sources.push(...result.sources);
        totals.found += result.totals.found;
        totals.stored += result.totals.stored;
        totals.duplicates += result.totals.duplicates;
        totals.offTopic += result.totals.offTopic;
      } catch (err) {
        console.error(
          'Stalker poll project failed',
          organizationId,
          project.id,
          err
        );
      }
    }
    return { sources, totals };
  }

  async pollAll() {
    if (!isStalkerEnabled()) {
      return;
    }
    const organizations = await this._repository.listProjectOrganizations();
    for (const organization of organizations) {
      try {
        await this.pollOrganization(organization.organizationId);
      } catch (err) {
        console.error(
          'Stalker poll org failed',
          organization.organizationId,
          err
        );
      }
    }
  }

  async listDueProjectScans() {
    if (!isStalkerEnabled()) {
      return [] as {
        organizationId: string;
        projectId: string;
        trigger: StalkerScanTrigger;
      }[];
    }
    const cutoff = new Date(Date.now() - stalkerProjectIntervalMs());
    const due = await this._repository.listDueProjects(cutoff);
    const ready: {
      organizationId: string;
      projectId: string;
      trigger: StalkerScanTrigger;
    }[] = [];
    for (const project of due) {
      try {
        const active = await this._repository.activeScan(project.id);
        if (active) {
          continue;
        }
        ready.push({
          organizationId: project.organizationId,
          projectId: project.id,
          trigger: 'schedule',
        });
      } catch (err) {
        console.error('Stalker due project failed', project.id, err);
      }
    }
    return ready;
  }

  async requestScan(
    organizationId: string,
    projectId: string,
    trigger: StalkerScanTrigger
  ) {
    this.assertEnabled();
    await this.requireProject(organizationId, projectId);
    if (trigger === 'manual') {
      const recent = await this._repository.latestManualScan(
        projectId,
        new Date(Date.now() - MANUAL_SCAN_GAP_MS)
      );
      if (recent) {
        throw new HttpException(
          'A check just ran. Try again in a couple of minutes',
          429
        );
      }
    }
    const active = await this._repository.activeScan(projectId);
    if (active) {
      return { runId: active.id, status: active.status, projectId };
    }
    const run = await this._repository.createScanRun({
      organizationId,
      projectId,
      trigger,
    });
    await this.startProjectScan({
      organizationId,
      projectId,
      trigger,
      runId: run.id,
    });
    return { runId: run.id, status: 'queued' as const, projectId };
  }

  async requestOrganizationScans(
    organizationId: string,
    trigger: StalkerScanTrigger
  ) {
    this.assertEnabled();
    const projects = await this._repository.listProjects(organizationId);
    const runs = [];
    for (const project of projects) {
      try {
        runs.push(await this.requestScan(organizationId, project.id, trigger));
      } catch (err) {
        console.error('Stalker scan request failed', project.id, err);
        runs.push({
          projectId: project.id,
          status: 'failed',
          error: err instanceof HttpException ? err.message : 'Scan could not start',
        });
      }
    }
    return { runs };
  }

  async latestScan(organizationId: string, projectId: string) {
    this.assertEnabled();
    await this.requireProject(organizationId, projectId);
    const run = await this._repository.latestScan(projectId);
    if (!run) {
      return {
        runId: null,
        status: 'idle',
        trigger: null,
        startedAt: null,
        finishedAt: null,
        error: '',
        sources: [],
        totals: emptyTotals(),
      };
    }
    const result = this.readScanResult(run.result);
    return {
      runId: run.id,
      status: run.status,
      trigger: run.trigger,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
      error: run.error || result.sources.find((source) => source.error)?.error || '',
      sources: result.sources,
      totals: result.totals,
    };
  }

  async executeProjectScan(input: {
    organizationId: string;
    projectId: string;
    trigger: string;
    runId?: string;
  }): Promise<StalkerPollResult> {
    if (!isStalkerEnabled()) {
      return { sources: [], totals: emptyTotals() };
    }
    let runId = input.runId || '';
    if (!runId) {
      const active = await this._repository.activeScan(input.projectId);
      if (active) {
        return this.readScanResult(active.result);
      }
      const created = await this._repository.createScanRun({
        organizationId: input.organizationId,
        projectId: input.projectId,
        trigger: input.trigger || 'schedule',
        status: 'queued',
      });
      runId = created.id;
    }
    await this._repository.markScanRunning(runId);
    try {
      const project = await this.requireProject(
        input.organizationId,
        input.projectId
      );
      const result = await this.scanOneProject(
        input.organizationId,
        project,
        input.trigger || 'schedule'
      );
      const failed = result.sources.some((source) => !source.ok);
      const error = failed
        ? result.sources.find((source) => source.error)?.error || 'Scan failed'
        : '';
      await this._repository.finishScanRun(
        runId,
        failed ? 'failed' : 'succeeded',
        result as unknown as Prisma.InputJsonValue,
        error
      );
      await this._repository.touchLastScan(input.projectId);
      return result;
    } catch (err) {
      console.error('Stalker scan project failed', input.projectId, err);
      await this._repository.finishScanRun(
        runId,
        'failed',
        null,
        safeProviderError(err)
      );
      await this._repository.touchLastScan(input.projectId);
      throw err;
    }
  }

  private readScanResult(value: unknown): StalkerPollResult {
    if (!value || typeof value !== 'object') {
      return { sources: [], totals: emptyTotals() };
    }
    const result = value as StalkerPollResult;
    return {
      sources: Array.isArray(result.sources) ? result.sources : [],
      totals: result.totals || emptyTotals(),
    };
  }

  private async startProjectScan(input: {
    organizationId: string;
    projectId: string;
    trigger: StalkerScanTrigger;
    runId: string;
  }) {
    const client = this._temporalService?.client?.getRawClient?.();
    if (!client?.workflow?.start) {
      console.error(
        'Stalker scan could not start, Temporal client is missing',
        input.projectId
      );
      await this._repository.finishScanRun(
        input.runId,
        'failed',
        null,
        'Scan could not start'
      );
      return;
    }
    try {
      await client.workflow.start('stalkerScanProjectWorkflow', {
        workflowId: `stalker-scan-${input.projectId}`,
        taskQueue: 'main',
        workflowIdConflictPolicy: WorkflowIdConflictPolicy.USE_EXISTING,
        args: [input],
      });
    } catch (err) {
      if (alreadyRunning(err)) {
        return;
      }
      console.error('Stalker scan start failed', input.projectId, err);
      await this._repository.finishScanRun(
        input.runId,
        'failed',
        null,
        'Scan could not start'
      );
    }
  }

  private async scanOneProject(
    organizationId: string,
    project: {
      id: string;
      name: string;
      description: string;
      webhookUrl: string;
      brandName: string;
      aliases: string;
      exclusions: string;
      handleX: string;
      handleRedditUser: string;
      handleRedditSubreddit: string;
      handleYoutube: string;
      handleLinkedin: string;
      handleInstagram: string;
      handleFacebook: string;
      alertsEnabled: boolean;
      alertEmail: string;
      alertScope: StalkerAlertScope;
      alertDelivery: StalkerAlertDelivery;
      spikeEnabled: boolean;
      spikeMultiplier: number;
      sentimentDropEnabled: boolean;
      sentimentDropPoints: number;
      alertCooldownHours: number;
    },
    trigger: string
  ): Promise<StalkerPollResult> {
    const integrations = await this.organizationIntegrations(organizationId);
    const bag = this.tokenBag();
    const commentBatches: {
      integrationId: string;
      sourceId: string;
      drafts: StalkerMentionDraft[];
    }[] = [];
    const commentErrors: { sourceId: string; error: string }[] = [];
    let youtubeTried = false;
    let youtubeOk = false;
    let youtubeError = '';

    for (const integration of integrations) {
      const provider = this._integrationManager.getSocialIntegration(
        integration.providerIdentifier
      );
      if (!provider?.collectStalkerMentions) {
        continue;
      }
      const sourceId = this.sourceIdFor(integration.providerIdentifier);
      if (sourceId === 'youtube') {
        if (youtubeOk) {
          continue;
        }
        youtubeTried = true;
      }
      try {
        const called = await this.callWithFreshToken(
          integration,
          bag,
          (current) =>
            provider.collectStalkerMentions!({
              accessToken: current.token,
              integration: current,
              keywords: [],
            })
        );
        if ('error' in called) {
          if (sourceId === 'youtube') {
            youtubeError = called.error;
            continue;
          }
          commentErrors.push({ sourceId, error: called.error });
          continue;
        }
        if (sourceId === 'youtube') {
          youtubeOk = true;
        }
        commentBatches.push({
          integrationId: called.integration.id,
          sourceId,
          drafts: called.value.slice(0, 40),
        });
      } catch (err) {
        console.error('Stalker collect failed', integration.id, err);
        const message = sourceFailure(sourceId, safeProviderError(err));
        if (sourceId === 'youtube') {
          youtubeError = message;
          continue;
        }
        commentErrors.push({ sourceId, error: message });
      }
    }
    if (youtubeTried && !youtubeOk && youtubeError) {
      commentErrors.push({ sourceId: 'youtube', error: youtubeError });
    }

    const identity = readIdentity(project);
    const searched = await this.searchProject(
      organizationId,
      project,
      integrations,
      identity,
      bag
    );
    const sources = [...searched.sources];
    const totals = emptyTotals();
    totals.found += searched.found;
    totals.stored += searched.stored;
    totals.duplicates += searched.duplicates;
    for (const batch of commentBatches) {
      const tagged = tagDrafts(batch.drafts, identity, false);
      const saved = await this.storeMentions(
        organizationId,
        project,
        batch.integrationId,
        tagged,
        new Map()
      );
      const row = this.sourceRow(sources, project.id, batch.sourceId);
      row.found += batch.drafts.length;
      row.stored += saved.stored;
      totals.found += batch.drafts.length;
      totals.stored += saved.stored;
      totals.duplicates += saved.duplicates;
    }
    for (const failure of commentErrors) {
      const row = this.sourceRow(sources, project.id, failure.sourceId);
      row.ok = false;
      row.error = row.error || failure.error;
    }
    totals.offTopic += await this.classifyOrganization(organizationId, project);
    await this.clusterOrganization(organizationId, project.id);
    this.logScan(project.id, trigger, { sources, totals });
    return { sources, totals };
  }

  private logScan(
    projectId: string,
    trigger: string,
    result: StalkerPollResult
  ) {
    const parts = result.sources.map((source) => {
      if (!source.ok) {
        const message = (source.error || 'failed').replace(/"/g, "'");
        return `${source.id} error="${message}"`;
      }
      return `${source.id} ok searched=${source.searched} found=${source.found} stored=${source.stored}`;
    });
    console.log(
      `Stalker scan project=${projectId} trigger=${trigger} ${parts.join(
        ' '
      )} dupes=${result.totals.duplicates}`
    );
  }

  private async organizationIntegrations(organizationId: string) {
    const integrations = await this._repository.listActiveSocial();
    return integrations.filter(
      (integration) => integration.organizationId === organizationId
    );
  }

  private async requireProject(organizationId: string, projectId: string) {
    const project = await this._repository.getProject(
      organizationId,
      projectId
    );
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  private async searchProject(
    organizationId: string,
    project: {
      id: string;
      name: string;
      webhookUrl: string;
      brandName: string;
      aliases: string;
      exclusions: string;
      handleX: string;
      handleRedditUser: string;
      handleRedditSubreddit: string;
      handleYoutube: string;
      handleLinkedin: string;
      handleInstagram: string;
      handleFacebook: string;
    },
    integrations: Integration[],
    identity: ReturnType<typeof readIdentity>,
    bag: { fresh: Map<string, Integration>; blocked: Set<string> }
  ) {
    const keywords = await this._repository.listKeywords(
      organizationId,
      project.id
    );
    const cursors = await this._repository.listCursors(project.id);
    const cursorMap = new Map(
      cursors.map((cursor) => [`${cursor.source}:${cursor.phraseKey}`, cursor])
    );
    const now = Date.now();
    const sources: StalkerPollSource[] = [];
    let found = 0;
    let stored = 0;
    let duplicates = 0;
    for (const source of this._sources.all()) {
      const stat: StalkerPollSource = {
        projectId: project.id,
        id: source.id,
        ok: true,
        searched: 0,
        found: 0,
        stored: 0,
      };
      const identifier = source.integrationIdentifier();
      const preferApiKey = source.searchesWithoutAccount?.() === true;
      const candidates =
        identifier && !preferApiKey
          ? integrations.filter(
              (item) => item.providerIdentifier === identifier
            )
          : [];
      const collected: StalkerMentionDraft[] = [];
      const phrases = [identity.brand, ...identity.aliases].filter(
        (phrase) => phrase.length >= 2
      );
      const query = source.buildQuery({
        phrases,
        handle: handleForSource(source.id, identity),
        subreddit: identity.handles.redditSubreddit,
      });
      const field = listenField[source.id];
      const selected = orderKeywordsForScan(
        keywords.filter((keyword) => keyword[field]),
        cursors,
        source.id
      );
      const keywordIds = new Map(
        selected.map((keyword) => [keyword.phrase.toLowerCase(), keyword.id])
      );
      const wantsSearch = !!query.trim() || selected.length > 0;
      if (!wantsSearch) {
        continue;
      }
      if (
        !preferApiKey &&
        !candidates.length &&
        !source.enabled(undefined)
      ) {
        stat.ok = false;
        stat.error = sourceFailure(source.id, source.statusDetail(false));
        for (const keyword of selected) {
          await this._repository.noteScanFailure(
            project.id,
            source.id,
            keyword.phrase.toLowerCase(),
            stat.error
          );
        }
        sources.push(stat);
        continue;
      }
      const pull = async (
        phrase: string,
        phraseKey: string,
        keywordPhrase?: string
      ) => {
        const cursor = cursorMap.get(`${source.id}:${phraseKey}`);
        const scan = resolveScanSince({
          now,
          cursorAt: cursor?.cursorAt,
          backfillUntil: cursor?.backfillUntil,
          lookbackMs: SEARCH_SINCE_MS,
        });
        const outcome = await this.searchWithFallback(
          source,
          phrase,
          scan.since,
          candidates,
          bag,
          preferApiKey
        );
        if (outcome.error || !outcome.drafts) {
          const message =
            outcome.error ||
            stat.error ||
            sourceFailure(source.id, 'Search failed');
          stat.ok = false;
          stat.error = message;
          await this._repository.noteScanFailure(
            project.id,
            source.id,
            phraseKey,
            message
          );
          return;
        }
        stat.searched += 1;
        stat.found += outcome.drafts.length;
        collected.push(
          ...tagDrafts(
            outcome.drafts.map((draft) => ({
              ...draft,
              keywordPhrase: keywordPhrase || draft.keywordPhrase,
            })),
            identity,
            true
          )
        );
        await this._repository.finishScan(
          project.id,
          source.id,
          phraseKey,
          scan.backfill
        );
      };
      if (query.trim()) {
        await pull(query, 'brand');
      }
      for (const keyword of selected) {
        await pull(keyword.phrase, keyword.phrase.toLowerCase(), keyword.phrase);
      }
      const blocked = new Map<string, Set<string>>();
      for (const keyword of keywords) {
        const handles = String(
          (keyword as { excludeAccounts?: string }).excludeAccounts || ''
        )
          .split(/[\s,]+/)
          .map((handle) => handle.replace(/^@/, '').toLowerCase())
          .filter(Boolean);
        if (handles.length) {
          blocked.set(keyword.phrase.toLowerCase(), new Set(handles));
        }
      }
      const unique = dedupeDrafts(collected)
        .filter((draft) => {
          const phrase = (draft.keywordPhrase || '').toLowerCase();
          const handles = phrase ? blocked.get(phrase) : undefined;
          if (!handles?.size) {
            return true;
          }
          const handle = (draft.authorHandle || '').replace(/^@/, '').toLowerCase();
          return !handle || !handles.has(handle);
        })
        .slice(0, 80);
      const healthy = candidates.find((item) => !bag.blocked.has(item.id));
      const used = healthy
        ? bag.fresh.get(healthy.id) || healthy
        : undefined;
      const saved = await this.storeMentions(
        organizationId,
        project,
        identifier && used ? used.id : null,
        unique,
        keywordIds
      );
      stat.stored += saved.stored;
      found += stat.found;
      stored += stat.stored;
      duplicates += saved.duplicates;
      sources.push(stat);
    }
    return { sources, found, stored, duplicates };
  }

  private async searchWithFallback(
    source: {
      id: string;
      enabled: (auth?: { accessToken?: string }) => boolean;
      search: (
        keyword: string,
        since: Date,
        auth?: { accessToken?: string }
      ) => Promise<StalkerMentionDraft[]>;
    },
    phrase: string,
    since: Date,
    candidates: Integration[],
    bag: { fresh: Map<string, Integration>; blocked: Set<string> },
    preferApiKey: boolean
  ) {
    if (preferApiKey || !candidates.length) {
      return this.cachedSearch(source, phrase, since, undefined, bag);
    }
    let last: { drafts: StalkerMentionDraft[] | null; error?: string } = {
      drafts: null,
      error: sourceFailure(source.id, 'token'),
    };
    for (const candidate of candidates) {
      if (bag.blocked.has(candidate.id)) {
        last = { drafts: null, error: sourceFailure(source.id, 'token') };
        continue;
      }
      const current = bag.fresh.get(candidate.id) || candidate;
      const outcome = await this.cachedSearch(
        source,
        phrase,
        since,
        current,
        bag
      );
      if (!outcome.error && outcome.drafts) {
        return outcome;
      }
      last = outcome.error
        ? outcome
        : { drafts: null, error: sourceFailure(source.id, 'Search failed') };
      if (!/token|credential|reconnect|unauth|invalid/i.test(last.error || '')) {
        return last;
      }
    }
    return last;
  }

  private async cachedSearch(
    source: {
      id: string;
      enabled: (auth?: { accessToken?: string }) => boolean;
      search: (
        keyword: string,
        since: Date,
        auth?: { accessToken?: string }
      ) => Promise<StalkerMentionDraft[]>;
    },
    phrase: string,
    since: Date,
    integration: Integration | undefined,
    bag: { fresh: Map<string, Integration>; blocked: Set<string> }
  ): Promise<{ drafts: StalkerMentionDraft[] | null; error?: string }> {
    const cachePhrase = `${phrase.toLowerCase()}|${Math.floor(
      since.getTime() / (60 * 60 * 1000)
    )}`;
    const cached = await this._repository.readSearchCache(
      source.id,
      cachePhrase,
      POLL_WINDOW_MS
    );
    if (cached) {
      return { drafts: cached };
    }
    const execute = async (
      auth?: { accessToken?: string }
    ): Promise<{ drafts: StalkerMentionDraft[] | null; error?: string }> => {
      if (!source.enabled(auth)) {
        return {
          drafts: null,
          error: sourceFailure(source.id),
        };
      }
      const drafts = await source.search(phrase, since, auth);
      await this._repository.writeSearchCache(source.id, cachePhrase, drafts);
      return { drafts };
    };
    try {
      if (!integration) {
        return await execute(undefined);
      }
      const called = await this.callWithFreshToken(integration, bag, (current) =>
        execute({ accessToken: current.token })
      );
      if ('error' in called) {
        return { drafts: null, error: called.error };
      }
      return called.value;
    } catch (err) {
      console.error('Stalker search failed', source.id, phrase, err);
      return {
        drafts: null,
        error: sourceFailure(source.id, safeProviderError(err)),
      };
    }
  }

  private tokenBag() {
    return {
      fresh: new Map<string, Integration>(),
      blocked: new Set<string>(),
    };
  }

  private sourceIdFor(providerIdentifier: string) {
    if (providerIdentifier.startsWith('instagram')) {
      return 'instagram';
    }
    if (providerIdentifier === 'facebook') {
      return 'facebook';
    }
    return providerIdentifier;
  }

  private sourceRow(
    sources: StalkerPollSource[],
    projectId: string,
    id: string
  ) {
    const existing = sources.find(
      (source) => source.projectId === projectId && source.id === id
    );
    if (existing) {
      return existing;
    }
    const created: StalkerPollSource = {
      projectId,
      id,
      ok: true,
      searched: 0,
      found: 0,
      stored: 0,
    };
    sources.push(created);
    return created;
  }

  private async ensureToken(
    integration: Integration,
    bag: { fresh: Map<string, Integration>; blocked: Set<string> }
  ): Promise<{ integration: Integration } | { error: string }> {
    const current = bag.fresh.get(integration.id) || integration;
    if (bag.blocked.has(current.id)) {
      return {
        error: sourceFailure(this.sourceIdFor(current.providerIdentifier), 'token'),
      };
    }
    if (!tokenExpiresSoon(current.tokenExpiration)) {
      return { integration: current };
    }
    const refreshed = await this.forceRefresh(current, bag);
    if (!refreshed) {
      return {
        error: sourceFailure(this.sourceIdFor(current.providerIdentifier), 'token'),
      };
    }
    return { integration: refreshed };
  }

  private async forceRefresh(
    integration: Integration,
    bag: { fresh: Map<string, Integration>; blocked: Set<string> }
  ): Promise<Integration | null> {
    if (bag.blocked.has(integration.id)) {
      return null;
    }
    if (!integration.refreshToken) {
      bag.blocked.add(integration.id);
      return null;
    }
    const data = await this._refreshIntegrationService.refresh(integration);
    if (!data || !data.accessToken) {
      bag.blocked.add(integration.id);
      return null;
    }
    const provider = this._integrationManager.getSocialIntegration(
      integration.providerIdentifier
    );
    if (provider?.refreshCron) {
      this._refreshIntegrationService
        .startRefreshWorkflow(
          integration.organizationId,
          integration.id,
          provider
        )
        .catch((err) => {
          console.error('Stalker could not re-arm token refresh', integration.id, err);
        });
    }
    const expiresIn = data.expiresIn && data.expiresIn > 0 ? data.expiresIn : 3600;
    const next: Integration = {
      ...integration,
      token: data.accessToken,
      refreshToken: data.refreshToken || integration.refreshToken,
      tokenExpiration: new Date(Date.now() + expiresIn * 1000),
    };
    bag.fresh.set(integration.id, next);
    return next;
  }

  private async callWithFreshToken<T>(
    integration: Integration,
    bag: { fresh: Map<string, Integration>; blocked: Set<string> },
    run: (current: Integration) => Promise<T>
  ): Promise<{ value: T; integration: Integration } | { error: string }> {
    const ready = await this.ensureToken(integration, bag);
    if ('error' in ready) {
      return ready;
    }
    try {
      return {
        value: await run(ready.integration),
        integration: ready.integration,
      };
    } catch (err) {
      if (!isProviderAuthFailure(err)) {
        throw err;
      }
      const refreshed = await this.forceRefresh(ready.integration, bag);
      if (!refreshed) {
        return {
          error: sourceFailure(
            this.sourceIdFor(ready.integration.providerIdentifier),
            'token'
          ),
        };
      }
      try {
        return { value: await run(refreshed), integration: refreshed };
      } catch (retryErr) {
        if (isProviderAuthFailure(retryErr)) {
          return {
            error: sourceFailure(
              this.sourceIdFor(refreshed.providerIdentifier),
              'token'
            ),
          };
        }
        throw retryErr;
      }
    }
  }

  private async classifyOrganization(
    organizationId: string,
    project: {
      id: string;
      name: string;
      description: string;
      brandName: string;
      aliases: string;
      alertsEnabled: boolean;
      alertEmail: string;
      alertScope: StalkerAlertScope;
      alertDelivery: StalkerAlertDelivery;
      spikeEnabled: boolean;
      spikeMultiplier: number;
      sentimentDropEnabled: boolean;
      sentimentDropPoints: number;
      alertCooldownHours: number;
    }
  ) {
    const projectId = project.id;
    const categories = await this._repository.listCategories(
      organizationId,
      projectId
    );
    if (!categories.length) {
      return 0;
    }
    const byName = new Map(
      categories.map((category) => [category.name.toLowerCase(), category])
    );
    const pending = await this._repository.unclassified(
      organizationId,
      projectId
    );
    const saved: {
      id: string;
      categoryName: string;
      sentiment: string;
      urgency: number;
      relevant: boolean;
    }[] = [];
    for (let index = 0; index < pending.length; index += 20) {
      const batch = pending.slice(index, index + 20);
      const classified = await this.classifyBatch(batch, categories, project);
      const rows = classified.flatMap((item) => {
        const named = byName.get(item.categoryName.trim().toLowerCase());
        const fallback = fallbackClassification(item.text || '', categories);
        const match =
          named ||
          byName.get(fallback.categoryName.trim().toLowerCase()) ||
          categories[0];
        if (!match) {
          return [];
        }
        return [
          {
            id: item.id,
            category: legacyCategory(match.name),
            categoryName: match.name,
            categoryId: match.id,
            sentiment: item.relevant ? item.sentiment : 'NEUTRAL',
            urgency: item.relevant ? item.urgency : 0,
            relevant: item.relevant,
          },
        ];
      });
      await this._repository.saveClassification(organizationId, rows);
      saved.push(
        ...rows.map((row) => ({
          id: row.id,
          categoryName: row.categoryName,
          sentiment: row.sentiment,
          urgency: row.urgency,
          relevant: row.relevant,
        }))
      );
    }
    await this.dispatchAlerts(organizationId, project, saved);
    return saved.filter((item) => !item.relevant).length;
  }

  private async classifyBatch(
    batch: { id: string; text: string }[],
    categories: { name: string; description: string }[],
    project: { name: string; description: string; brandName: string; aliases: string }
  ) {
    const listed = categories.map((category) => ({
      name: category.name,
      description: category.description,
    }));
    const brand = {
      name: project.brandName || project.name,
      aliases: project.aliases || '',
      description: project.description || '',
    };
    const ask = async (items: { id: string; text: string }[]) => {
      if (!this._openaiService.hasApiKey()) {
        return [];
      }
      try {
        return await this._openaiService.classifyStalkerMentions(
          items,
          listed,
          brand
        );
      } catch (err) {
        console.error('Stalker classification failed', err);
        return [];
      }
    };
    let classified = await ask(batch);
    if (classified.length) {
      const got = new Set(classified.map((item) => item.id));
      const missing = batch.filter((item) => !got.has(item.id));
      if (missing.length) {
        classified = [...classified, ...(await ask(missing))];
      }
    }
    const byId = new Map(classified.map((item) => [item.id, item]));
    return batch.map((item) => {
      const hit = byId.get(item.id);
      if (!hit) {
        return { id: item.id, text: item.text, ...fallbackClassification(item.text, categories) };
      }
      return { ...hit, text: item.text };
    });
  }

  private async dispatchAlerts(
    organizationId: string,
    project: {
      id: string;
      name: string;
      alertsEnabled: boolean;
      alertEmail: string;
      alertScope: StalkerAlertScope;
      alertDelivery: StalkerAlertDelivery;
      spikeEnabled: boolean;
      spikeMultiplier: number;
      sentimentDropEnabled: boolean;
      sentimentDropPoints: number;
      alertCooldownHours: number;
      digestEnabled?: boolean;
      digestDismissed?: boolean;
      digestHour?: number;
      digestTimezone?: string;
      digestGroupName?: string;
      digestSentOn?: string;
    },
    saved: {
      id: string;
      categoryName: string;
      sentiment: string;
      urgency: number;
      relevant: boolean;
    }[]
  ) {
    const digestOn = !!project.digestEnabled && !project.digestDismissed;
    const rules =
      typeof this._repository.listAlertRules === 'function'
        ? await this._repository.listAlertRules(organizationId, project.id)
        : [];
    if (!project.alertsEnabled && !digestOn && !rules.some((rule) => rule.enabled)) {
      return;
    }
    const matches = project.alertsEnabled
      ? saved.filter((item) =>
          mentionMatchesScope(project.alertScope as StalkerAlertScopeName, item)
        )
      : [];
    if (matches.length) {
      const rows = await this._repository.mentionsByIds(
        organizationId,
        matches.map((item) => item.id)
      );
      const byId = new Map(rows.map((row) => [row.id, row]));
      for (const item of matches) {
        const row = byId.get(item.id);
        if (!row) {
          continue;
        }
        const title = `${item.categoryName} · ${row.authorName}`;
        const body = [row.text, row.url || ''].filter(Boolean).join('\n');
        await this._repository.createAlert({
          organizationId,
          projectId: project.id,
          mentionId: item.id,
          kind: StalkerAlertKind.MENTION,
          channel: StalkerAlertChannel.IN_APP,
          status: StalkerAlertStatus.SENT,
          dedupeKey: `mention:${item.id}:IN_APP`,
          title,
          body,
          sentAt: new Date(),
        });
        if (project.alertEmail.includes('@')) {
          await this._repository.createAlert({
            organizationId,
            projectId: project.id,
            mentionId: item.id,
            kind: StalkerAlertKind.MENTION,
            channel: StalkerAlertChannel.EMAIL,
            status: StalkerAlertStatus.PENDING,
            dedupeKey: `mention:${item.id}:EMAIL`,
            title,
            body,
          });
        }
      }
    }
    const relevant = saved.filter((item) => item.relevant);
    if (relevant.length && (digestOn || rules.some((rule) => rule.enabled))) {
      const rows = await this._repository.mentionsByIds(
        organizationId,
        relevant.map((item) => item.id)
      );
      const email = project.alertEmail.includes('@')
        ? project.alertEmail
        : '';
      const wanted = (project.digestGroupName || 'My brand').toLowerCase();
      for (const row of rows) {
        if (!email) {
          break;
        }
        const groupName = (
          row.keyword?.group?.name || 'My brand'
        ).toLowerCase();
        const inDigest =
          digestOn &&
          (groupName === wanted || (!row.keywordId && wanted === 'my brand'));
        if (inDigest) {
          await this._repository.createAlert({
            organizationId,
            projectId: project.id,
            mentionId: row.id,
            kind: StalkerAlertKind.MENTION,
            channel: StalkerAlertChannel.EMAIL,
            status: StalkerAlertStatus.PENDING,
            dedupeKey: `digest:${row.id}:EMAIL`,
            title: `${row.authorName} mentioned ${project.name}`,
            body: [row.text, row.url || ''].filter(Boolean).join('\n'),
          });
        }
        for (const rule of rules) {
          if (!rule.enabled) {
            continue;
          }
          const filters =
            rule.filters && typeof rule.filters === 'object'
              ? (rule.filters as Record<string, unknown>)
              : {};
          if (
            !ruleMatches(filters, {
              source: row.source,
              authorName: row.authorName,
              authorHandle: row.authorHandle,
              keywordId: row.keywordId,
              categoryId: row.categoryId,
              sentiment: row.sentiment,
              likeCount: row.likeCount,
              replyCount: row.replyCount,
            })
          ) {
            continue;
          }
          await this._repository.createAlert({
            organizationId,
            projectId: project.id,
            mentionId: row.id,
            kind: StalkerAlertKind.MENTION,
            channel: StalkerAlertChannel.EMAIL,
            status: StalkerAlertStatus.PENDING,
            dedupeKey: `rule:${rule.id}:${row.id}`,
            title: rule.name,
            body: [row.text, row.url || ''].filter(Boolean).join('\n'),
          });
        }
      }
    }
    if (project.alertsEnabled) {
      await this.evaluateThresholds(organizationId, project);
    }
    await this.flushEmails({ ...project, organizationId });
  }

  private async evaluateThresholds(
    organizationId: string,
    project: {
      id: string;
      name: string;
      alertEmail: string;
      spikeEnabled: boolean;
      spikeMultiplier: number;
      sentimentDropEnabled: boolean;
      sentimentDropPoints: number;
      alertCooldownHours: number;
    }
  ) {
    const cooldownMs = Math.max(1, project.alertCooldownHours || 12) * 60 * 60 * 1000;
    const since = new Date(Date.now() - cooldownMs);
    const now = Date.now();
    if (project.spikeEnabled) {
      const recentStart = new Date(now - SPIKE_WINDOW_MS);
      const previousStart = new Date(now - SPIKE_WINDOW_MS * 2);
      const [recent, previous] = await Promise.all([
        this._repository.countMentionsBetween(
          organizationId,
          project.id,
          recentStart,
          new Date(now)
        ),
        this._repository.countMentionsBetween(
          organizationId,
          project.id,
          previousStart,
          recentStart
        ),
      ]);
      const open = await this._repository.latestAlert(
        project.id,
        StalkerAlertKind.VOLUME_SPIKE,
        since
      );
      if (
        !open &&
        shouldFireVolumeSpike({
          recent,
          previous,
          multiplier: project.spikeMultiplier || 2,
        })
      ) {
        await this.recordThreshold(
          organizationId,
          project,
          StalkerAlertKind.VOLUME_SPIKE,
          `Mention volume spiked for ${project.name}`,
          `${recent} mentions arrived in the last 6 hours, compared with ${previous} in the previous 6 hours.`,
          cooldownMs
        );
      }
    }
    if (project.sentimentDropEnabled) {
      const recentStart = new Date(now - SENTIMENT_WINDOW_MS);
      const previousStart = new Date(now - SENTIMENT_WINDOW_MS * 2);
      const nowDate = new Date(now);
      const [recentTotal, recentNegative, previousTotal, previousNegative] =
        await Promise.all([
          this._repository.countMentionsBetween(
            organizationId,
            project.id,
            recentStart,
            nowDate
          ),
          this._repository.countMentionsBetween(
            organizationId,
            project.id,
            recentStart,
            nowDate,
            StalkerSentiment.NEGATIVE
          ),
          this._repository.countMentionsBetween(
            organizationId,
            project.id,
            previousStart,
            recentStart
          ),
          this._repository.countMentionsBetween(
            organizationId,
            project.id,
            previousStart,
            recentStart,
            StalkerSentiment.NEGATIVE
          ),
        ]);
      const open = await this._repository.latestAlert(
        project.id,
        StalkerAlertKind.SENTIMENT_DROP,
        since
      );
      if (
        !open &&
        shouldFireSentimentDrop({
          recentNegative,
          recentTotal,
          previousNegative,
          previousTotal,
          points: project.sentimentDropPoints || 20,
        })
      ) {
        await this.recordThreshold(
          organizationId,
          project,
          StalkerAlertKind.SENTIMENT_DROP,
          `Negative sentiment rose for ${project.name}`,
          `Negative mentions are ${sentimentShare(
            recentNegative,
            recentTotal
          )}% of the last 24 hours, up from ${sentimentShare(
            previousNegative,
            previousTotal
          )}% in the previous 24 hours.`,
          cooldownMs
        );
      }
    }
  }

  private async recordThreshold(
    organizationId: string,
    project: { id: string; alertEmail: string },
    kind: StalkerAlertKind,
    title: string,
    body: string,
    cooldownMs: number
  ) {
    const bucket = Math.floor(Date.now() / cooldownMs);
    await this._repository.createAlert({
      organizationId,
      projectId: project.id,
      kind,
      channel: StalkerAlertChannel.IN_APP,
      status: StalkerAlertStatus.SENT,
      dedupeKey: `${kind}:${bucket}:IN_APP`,
      title,
      body,
      sentAt: new Date(),
    });
    if (project.alertEmail.includes('@')) {
      await this._repository.createAlert({
        organizationId,
        projectId: project.id,
        kind,
        channel: StalkerAlertChannel.EMAIL,
        status: StalkerAlertStatus.PENDING,
        dedupeKey: `${kind}:${bucket}:EMAIL`,
        title,
        body,
      });
    }
  }

  private async flushEmails(project: {
    id: string;
    name: string;
    organizationId?: string;
    alertEmail: string;
    alertDelivery: StalkerAlertDelivery;
    digestEnabled?: boolean;
    digestDismissed?: boolean;
    digestHour?: number;
    digestTimezone?: string;
    digestSentOn?: string;
  }) {
    if (!project.alertEmail.includes('@')) {
      return;
    }
    const pending = await this._repository.pendingEmails(project.id);
    if (!pending.length) {
      return;
    }
    const mentionEmails = pending.filter(
      (alert) => alert.kind === StalkerAlertKind.MENTION
    );
    const others = pending.filter(
      (alert) => alert.kind !== StalkerAlertKind.MENTION
    );
    const digestEmails = mentionEmails.filter((alert) =>
      alert.dedupeKey.startsWith('digest:')
    );
    const instantEmails = mentionEmails.filter(
      (alert) => !alert.dedupeKey.startsWith('digest:')
    );
    const organizationId = project.organizationId || '';
    const room = async () => {
      if (!organizationId || typeof this._repository.countSentEmails !== 'function') {
        return DAILY_EMAIL_CAP;
      }
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      const sent = await this._repository.countSentEmails(organizationId, start);
      return Math.max(0, DAILY_EMAIL_CAP - sent);
    };
    let left = await room();
    const legacyDigest =
      !project.digestEnabled &&
      project.alertDelivery === StalkerAlertDelivery.DIGEST;
    const legacyBatch = legacyDigest
      ? instantEmails.filter((alert) => alert.dedupeKey.includes(':EMAIL'))
      : [];
    const oneByOne = instantEmails.filter(
      (alert) => !legacyBatch.some((item) => item.id === alert.id)
    );
    for (const alert of oneByOne) {
      if (left <= 0) {
        break;
      }
      await this.sendAlertEmail(project.alertEmail, alert);
      left -= 1;
    }
    if (legacyBatch.length && left > 0) {
      const ok = await this.sendDigest(
        project.alertEmail,
        project.name,
        legacyBatch
      );
      if (ok) {
        left -= 1;
      }
    }
    const clock = digestClock(project.digestTimezone || 'UTC');
    const digestDue =
      !!project.digestEnabled &&
      !project.digestDismissed &&
      clock.hour >= (project.digestHour ?? 8) &&
      project.digestSentOn !== clock.day;
    if (digestEmails.length && digestDue && left > 0) {
      const ok = await this.sendDigest(
        project.alertEmail,
        project.name,
        digestEmails
      );
      if (ok) {
        await this._repository.markDigestSent(project.id, clock.day);
      }
    }
    left = await room();
    for (const alert of others) {
      if (left <= 0) {
        break;
      }
      await this.sendAlertEmail(project.alertEmail, alert);
      left -= 1;
    }
  }

  private async sendDigest(
    to: string,
    projectName: string,
    alerts: { id: string; title: string; body: string }[]
  ) {
    const html = alerts
      .map(
        (alert) =>
          `<p><strong>${escapeHtml(alert.title)}</strong></p><p>${escapeHtml(
            alert.body
          ).replace(/\n/g, '<br/>')}</p>`
      )
      .join('');
    const ok = await this._emailService.sendEmailSync(
      to,
      `Stalker digest: ${alerts.length} mention${
        alerts.length === 1 ? '' : 's'
      } for ${projectName}`,
      html
    );
    await this._repository.markAlerts(
      alerts.map((alert) => alert.id),
      ok ? StalkerAlertStatus.SENT : StalkerAlertStatus.FAILED,
      ok ? '' : 'Email was not sent. Check EMAIL_FROM_ADDRESS and EMAIL_FROM_NAME.'
    );
    return ok;
  }

  private async sendAlertEmail(
    to: string,
    alert: { id: string; title: string; body: string }
  ) {
    const ok = await this._emailService.sendEmailSync(
      to,
      alert.title,
      `<p>${escapeHtml(alert.body).replace(/\n/g, '<br/>')}</p>`
    );
    await this._repository.markAlert(
      alert.id,
      ok ? StalkerAlertStatus.SENT : StalkerAlertStatus.FAILED,
      ok ? '' : 'Email was not sent. Check EMAIL_FROM_ADDRESS and EMAIL_FROM_NAME.'
    );
  }

  private async storeMentions(
    organizationId: string,
    project: { id: string; webhookUrl: string },
    integrationId: string | null,
    drafts: StalkerMentionDraft[],
    keywordIds: Map<string, string>
  ) {
    if (!drafts.length) {
      return { stored: 0, duplicates: 0 };
    }
    const started = new Date(Date.now() - 2000);
    const stored = await this._repository.insertMentions(
      organizationId,
      project.id,
      integrationId,
      drafts,
      keywordIds
    );
    await this.emitCreated(
      organizationId,
      project,
      drafts.map((draft) => draft.externalId),
      started
    );
    return {
      stored,
      duplicates: Math.max(0, drafts.length - stored),
    };
  }

  private async emitCreated(
    organizationId: string,
    project: { id: string; webhookUrl: string },
    externalIds: string[],
    started: Date
  ) {
    const url = (project.webhookUrl || '').trim();
    if (!url || !externalIds.length) {
      return;
    }
    try {
      if (!(await isSafePublicHttpsUrl(url))) {
        return;
      }
      const mentions = await this._repository.mentionsCreatedSince(
        organizationId,
        project.id,
        externalIds,
        started
      );
      for (const mention of mentions) {
        try {
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'mention.created',
              projectId: project.id,
              mention,
            }),
            // @ts-ignore — undici option, not in lib.dom fetch types
            dispatcher: getSsrfSafeDispatcher(),
          });
        } catch (err) {
          console.error('Stalker webhook failed', err);
        }
      }
    } catch (err) {
      console.error('Stalker webhook failed', err);
    }
  }

  private async identityFields(
    body: StalkerIdentityDto,
    fallbackBrand: string,
    partial: boolean
  ) {
    const data: Prisma.StalkerProjectUpdateManyMutationInput = {};
    const write = (
      present: boolean,
      key: keyof Prisma.StalkerProjectUpdateManyMutationInput,
      value: string | boolean | number
    ) => {
      if (partial && !present) {
        return;
      }
      (data as Record<string, string | boolean | number>)[key] = value;
    };
    if (!partial || body.webhookUrl !== undefined) {
      const webhookUrl = (body.webhookUrl || '').trim().slice(0, 300);
      if (webhookUrl && !(await isSafePublicHttpsUrl(webhookUrl))) {
        throw new BadRequestException(
          'Webhook URL must be a public https address'
        );
      }
      data.webhookUrl = webhookUrl;
    }
    write(
      body.brandName !== undefined,
      'brandName',
      (body.brandName || fallbackBrand || '').trim().slice(0, 80)
    );
    write(
      body.aliases !== undefined,
      'aliases',
      splitTerms(body.aliases || '').join('\n')
    );
    write(
      body.exclusions !== undefined,
      'exclusions',
      splitTerms(body.exclusions || '', 20).join('\n')
    );
    write(body.handleX !== undefined, 'handleX', cleanHandle(body.handleX || ''));
    write(
      body.handleRedditUser !== undefined,
      'handleRedditUser',
      cleanHandle(body.handleRedditUser || '')
    );
    write(
      body.handleRedditSubreddit !== undefined,
      'handleRedditSubreddit',
      cleanHandle(body.handleRedditSubreddit || '')
    );
    write(
      body.handleYoutube !== undefined,
      'handleYoutube',
      cleanHandle(body.handleYoutube || '')
    );
    write(
      body.handleLinkedin !== undefined,
      'handleLinkedin',
      cleanHandle(body.handleLinkedin || '')
    );
    write(
      body.handleInstagram !== undefined,
      'handleInstagram',
      cleanHandle(body.handleInstagram || '')
    );
    write(
      body.handleFacebook !== undefined,
      'handleFacebook',
      cleanHandle(body.handleFacebook || '')
    );
    write(
      body.alertEmail !== undefined,
      'alertEmail',
      (body.alertEmail || '').trim().slice(0, 120)
    );
    write(body.alertsEnabled !== undefined, 'alertsEnabled', !!body.alertsEnabled);
    if (body.alertScope) {
      data.alertScope = body.alertScope;
    }
    if (body.alertDelivery) {
      data.alertDelivery = body.alertDelivery;
    }
    write(body.spikeEnabled !== undefined, 'spikeEnabled', !!body.spikeEnabled);
    write(
      body.sentimentDropEnabled !== undefined,
      'sentimentDropEnabled',
      !!body.sentimentDropEnabled
    );
    if (typeof body.spikeMultiplier === 'number') {
      data.spikeMultiplier = clampInt(body.spikeMultiplier, 2, 10);
    }
    if (typeof body.sentimentDropPoints === 'number') {
      data.sentimentDropPoints = clampInt(body.sentimentDropPoints, 5, 80);
    }
    if (typeof body.alertCooldownHours === 'number') {
      data.alertCooldownHours = clampInt(body.alertCooldownHours, 1, 168);
    }
    write(body.digestEnabled !== undefined, 'digestEnabled', !!body.digestEnabled);
    write(
      body.digestDismissed !== undefined,
      'digestDismissed',
      !!body.digestDismissed
    );
    if (typeof body.digestHour === 'number') {
      data.digestHour = clampInt(body.digestHour, 0, 23);
    }
    write(
      body.digestTimezone !== undefined,
      'digestTimezone',
      (body.digestTimezone || 'UTC').trim().slice(0, 64) || 'UTC'
    );
    write(
      body.digestGroupName !== undefined,
      'digestGroupName',
      (body.digestGroupName || 'My brand').trim().slice(0, 40) || 'My brand'
    );
    return data;
  }

  private async clusterOrganization(organizationId: string, projectId: string) {
    if (!this._openaiService.hasApiKey()) {
      return;
    }
    const recent = await this._repository.recentForThemes(
      organizationId,
      projectId
    );
    if (recent.length < 2) {
      return;
    }
    try {
      const themes = await this._openaiService.clusterStalkerThemes(recent);
      await this._repository.replaceThemes(organizationId, projectId, themes);
    } catch (err) {
      console.error('Stalker themes failed', err);
    }
  }
}
