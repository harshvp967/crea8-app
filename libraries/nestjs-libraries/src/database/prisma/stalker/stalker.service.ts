import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
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
  UpdateStalkerProjectDto,
} from '@gitroom/nestjs-libraries/dtos/stalker/stalker.dto';
import { StalkerMentionDraft } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { EmailService } from '@gitroom/nestjs-libraries/services/email.service';
import { isSafePublicHttpsUrl } from '@gitroom/nestjs-libraries/dtos/webhooks/webhook.url.validator';
import { getSsrfSafeDispatcher } from '@gitroom/nestjs-libraries/dtos/webhooks/ssrf.safe.dispatcher';

export const isStalkerEnabled = () => process.env.STALKER_ENABLED === 'true';

const MAX_KEYWORDS = 10;
const KEYWORDS_PER_POLL = 5;
const POLL_HOURS = 6;
const POLL_WINDOW_MS = POLL_HOURS * 60 * 60 * 1000;
const SEARCH_SINCE_MS = 7 * 24 * 60 * 60 * 1000;

const PROJECT_COLORS = [
  '#00D9FF',
  '#7C5CFF',
  '#FFB020',
  '#FF6B6B',
  '#3DDC97',
  '#E8E8E8',
];

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

@Injectable()
export class StalkerService {
  constructor(
    private _repository: StalkerRepository,
    private _integrationManager: IntegrationManager,
    private _sources: StalkerSourceManager,
    private _openaiService: OpenaiService,
    private _emailService: EmailService
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
      maxKeywords: MAX_KEYWORDS,
      keywordsSearchedPerRun: KEYWORDS_PER_POLL,
      openAi: this._openaiService.hasApiKey(),
      sources,
      commentSources,
      suggestedHandles,
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
        reddit: keyword.reddit !== false,
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
    const project = await this._repository.createProject(organizationId, {
      name: body.name.trim(),
      description: (body.description || '').trim(),
      color,
      keywords,
      categories,
      identity,
    });
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
    const [rows, cursors] = await Promise.all([
      this._repository.listKeywords(organizationId, projectId),
      this._repository.listCursors(projectId),
    ]);
    return rows.map((row) => ({
      ...row,
      backfillArmed: cursors.some(
        (cursor) =>
          cursor.phraseKey === row.phrase.toLowerCase() && !!cursor.backfillUntil
      ),
    }));
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

  async alerts(organizationId: string, projectId: string) {
    this.assertEnabled();
    await this.requireProject(organizationId, projectId);
    return this._repository.listAlerts(organizationId, projectId);
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
    const rows = await this._repository.listMentions(organizationId, {
      ...query,
      take: 1000,
    });
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
    return this._repository.createKeyword(
      organizationId,
      body.projectId,
      phrase,
      {
        youtube: body.youtube !== false,
        reddit: body.reddit !== false,
        x: !!body.x,
        linkedin: !!body.linkedin,
      }
    );
  }

  async deleteKeyword(organizationId: string, id: string) {
    this.assertEnabled();
    await this._repository.deleteKeyword(organizationId, id);
    return { deleted: true };
  }

  async analytics(organizationId: string, projectId: string, date = '30d') {
    this.assertEnabled();
    if (!projectId) {
      throw new BadRequestException('Choose a project');
    }
    await this.requireProject(organizationId, projectId);
    const window = ['24h', '7d', '30d', 'all'].includes(date) ? date : '30d';
    const raw = await this._repository.analytics(
      organizationId,
      projectId,
      window
    );
    const days = new Map<string, number>();
    for (const row of raw.recent) {
      const key = row.createdAt.toISOString().slice(0, 10);
      days.set(key, (days.get(key) || 0) + 1);
    }
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
      overTime: [...days.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([day, count]) => ({ date: day, count })),
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
    try {
      await provider.stalkerReply({
        accessToken: integration.token,
        integration,
        postExternalId: mention.postExternalId || undefined,
        externalId: mention.externalId,
        text: body.text.trim(),
      });
    } catch (err) {
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

  async pollOrganization(organizationId: string) {
    this.assertEnabled();
    const projects = await this._repository.listProjects(organizationId);
    if (!projects.length) {
      return { ok: true };
    }
    const integrations = await this.organizationIntegrations(organizationId);
    const commentBatches: {
      integrationId: string;
      drafts: StalkerMentionDraft[];
    }[] = [];

    for (const integration of integrations) {
      const provider = this._integrationManager.getSocialIntegration(
        integration.providerIdentifier
      );
      if (!provider?.collectStalkerMentions) {
        continue;
      }
      try {
        const drafts = await provider.collectStalkerMentions({
          accessToken: integration.token,
          integration,
          keywords: [],
        });
        commentBatches.push({
          integrationId: integration.id,
          drafts: drafts.slice(0, 40),
        });
      } catch (err) {
        console.error('Stalker collect failed', integration.id, err);
      }
    }

    for (const project of projects) {
      const identity = readIdentity(project);
      await this.searchProject(
        organizationId,
        project,
        integrations,
        identity
      );
      for (const batch of commentBatches) {
        const tagged = tagDrafts(batch.drafts, identity, false);
        await this.storeMentions(
          organizationId,
          project,
          batch.integrationId,
          tagged,
          new Map()
        );
      }
      await this.classifyOrganization(organizationId, project);
      await this.clusterOrganization(organizationId, project.id);
    }
    return { ok: true };
  }

  async pollAll() {
    if (!isStalkerEnabled()) {
      return;
    }
    const organizations = await this._repository.listProjectOrganizations();
    for (const organization of organizations) {
      await this.pollOrganization(organization.organizationId);
    }
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
    integrations: { id: string; providerIdentifier: string; token: string }[],
    identity: ReturnType<typeof readIdentity>
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
    for (const source of this._sources.all()) {
      const identifier = source.integrationIdentifier();
      const integration = identifier
        ? integrations.find(
            (item) => item.providerIdentifier === identifier
          )
        : undefined;
      const auth = identifier
        ? { accessToken: integration?.token }
        : undefined;
      const collected: StalkerMentionDraft[] = [];
      const phrases = [identity.brand, ...identity.aliases].filter(
        (phrase) => phrase.length >= 2
      );
      const query = source.buildQuery({
        phrases,
        handle: handleForSource(source.id, identity),
        subreddit: identity.handles.redditSubreddit,
      });
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
        const hits = await this.cachedSearch(source, phrase, scan.since, auth);
        if (!hits) {
          return;
        }
        collected.push(
          ...tagDrafts(
            hits.map((draft) => ({
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
      const field = listenField[source.id];
      const selected = keywords
        .filter((keyword) => keyword[field])
        .slice(0, KEYWORDS_PER_POLL);
      const keywordIds = new Map(
        selected.map((keyword) => [keyword.phrase.toLowerCase(), keyword.id])
      );
      for (const keyword of selected) {
        await pull(keyword.phrase, keyword.phrase.toLowerCase(), keyword.phrase);
      }
      await this.storeMentions(
        organizationId,
        project,
        identifier && integration ? integration.id : null,
        dedupeDrafts(collected).slice(0, 80),
        keywordIds
      );
    }
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
    auth?: { accessToken?: string }
  ) {
    const cachePhrase = `${phrase.toLowerCase()}|${Math.floor(
      since.getTime() / (60 * 60 * 1000)
    )}`;
    const cached = await this._repository.readSearchCache(
      source.id,
      cachePhrase,
      POLL_WINDOW_MS
    );
    if (cached) {
      return cached;
    }
    if (!source.enabled(auth)) {
      return null;
    }
    try {
      const drafts = await source.search(phrase, since, auth);
      await this._repository.writeSearchCache(source.id, cachePhrase, drafts);
      return drafts;
    } catch (err) {
      console.error('Stalker search failed', source.id, phrase, err);
      return null;
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
      return;
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
    },
    saved: {
      id: string;
      categoryName: string;
      sentiment: string;
      urgency: number;
      relevant: boolean;
    }[]
  ) {
    if (!project.alertsEnabled) {
      return;
    }
    const matches = saved.filter((item) =>
      mentionMatchesScope(project.alertScope as StalkerAlertScopeName, item)
    );
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
    await this.evaluateThresholds(organizationId, project);
    await this.flushEmails(project);
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
    alertEmail: string;
    alertDelivery: StalkerAlertDelivery;
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
    if (
      project.alertDelivery === StalkerAlertDelivery.DIGEST &&
      mentionEmails.length
    ) {
      const html = mentionEmails
        .map(
          (alert) =>
            `<p><strong>${escapeHtml(alert.title)}</strong></p><p>${escapeHtml(
              alert.body
            ).replace(/\n/g, '<br/>')}</p>`
        )
        .join('');
      const ok = await this._emailService.sendEmailSync(
        project.alertEmail,
        `Stalker digest: ${mentionEmails.length} mention${
          mentionEmails.length === 1 ? '' : 's'
        } for ${project.name}`,
        html
      );
      await this._repository.markAlerts(
        mentionEmails.map((alert) => alert.id),
        ok ? StalkerAlertStatus.SENT : StalkerAlertStatus.FAILED,
        ok ? '' : 'Email was not sent. Check EMAIL_FROM_ADDRESS and EMAIL_FROM_NAME.'
      );
    } else {
      for (const alert of mentionEmails) {
        await this.sendAlertEmail(project.alertEmail, alert);
      }
    }
    for (const alert of others) {
      await this.sendAlertEmail(project.alertEmail, alert);
    }
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
      return;
    }
    const started = new Date(Date.now() - 2000);
    await this._repository.insertMentions(
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
