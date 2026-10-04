import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StalkerCategory, StalkerMentionStatus } from '@prisma/client';
import { StalkerRepository } from '@gitroom/nestjs-libraries/database/prisma/stalker/stalker.repository';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { OpenaiService } from '@gitroom/nestjs-libraries/openai/openai.service';
import { StalkerSourceManager } from '@gitroom/nestjs-libraries/stalker/stalker.source.manager';
import { StalkerSourceId } from '@gitroom/nestjs-libraries/stalker/stalker.source';
import {
  CreateStalkerKeywordDto,
  CreateStalkerProjectDto,
  StalkerDraftDto,
  StalkerMentionQueryDto,
} from '@gitroom/nestjs-libraries/dtos/stalker/stalker.dto';
import { StalkerMentionDraft } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';

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

@Injectable()
export class StalkerService {
  constructor(
    private _repository: StalkerRepository,
    private _integrationManager: IntegrationManager,
    private _sources: StalkerSourceManager,
    private _openaiService: OpenaiService
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
    return {
      enabled: true,
      pollHours: POLL_HOURS,
      maxKeywords: MAX_KEYWORDS,
      keywordsSearchedPerRun: KEYWORDS_PER_POLL,
      openAi: this._openaiService.hasApiKey(),
      sources,
      commentSources,
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
    const project = await this._repository.createProject(organizationId, {
      name: body.name.trim(),
      description: (body.description || '').trim(),
      color,
      keywords,
      categories,
    });
    return this._repository.getProject(organizationId, project.id);
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
    return this._repository.listKeywords(organizationId, projectId);
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

  async analytics(organizationId: string, projectId: string) {
    this.assertEnabled();
    if (!projectId) {
      throw new BadRequestException('Choose a project');
    }
    await this.requireProject(organizationId, projectId);
    const raw = await this._repository.analytics(organizationId, projectId);
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
        .map(([date, count]) => ({ date, count })),
    };
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
      for (const batch of commentBatches) {
        await this._repository.insertMentions(
          organizationId,
          project.id,
          batch.integrationId,
          batch.drafts,
          new Map()
        );
      }
      await this.searchProject(organizationId, project.id, integrations);
      await this.classifyOrganization(organizationId, project.id);
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
    projectId: string,
    integrations: { id: string; providerIdentifier: string; token: string }[]
  ) {
    const keywords = await this._repository.listKeywords(
      organizationId,
      projectId
    );
    const since = new Date(Date.now() - SEARCH_SINCE_MS);
    for (const source of this._sources.all()) {
      const field = listenField[source.id];
      const selected = keywords
        .filter((keyword) => keyword[field])
        .slice(0, KEYWORDS_PER_POLL);
      if (!selected.length) {
        continue;
      }
      const identifier = source.integrationIdentifier();
      const integration = identifier
        ? integrations.find(
            (item) => item.providerIdentifier === identifier
          )
        : undefined;
      const auth = identifier
        ? { accessToken: integration?.token }
        : undefined;
      const keywordIds = new Map(
        selected.map((keyword) => [keyword.phrase.toLowerCase(), keyword.id])
      );
      const collected: StalkerMentionDraft[] = [];
      for (const keyword of selected) {
        const cached = await this._repository.readSearchCache(
          source.id,
          keyword.phrase,
          POLL_WINDOW_MS
        );
        let drafts = cached;
        if (!drafts) {
          if (!source.enabled(auth)) {
            continue;
          }
          try {
            drafts = await source.search(keyword.phrase, since, auth);
          } catch (err) {
            console.error(
              'Stalker search failed',
              source.id,
              keyword.phrase,
              err
            );
            continue;
          }
          await this._repository.writeSearchCache(
            source.id,
            keyword.phrase,
            drafts
          );
        }
        for (const draft of drafts) {
          collected.push({ ...draft, keywordPhrase: keyword.phrase });
        }
      }
      await this._repository.insertMentions(
        organizationId,
        projectId,
        identifier && integration ? integration.id : null,
        collected.slice(0, 80),
        keywordIds
      );
    }
  }

  private async classifyOrganization(
    organizationId: string,
    projectId: string
  ) {
    const categories = await this._repository.listCategories(
      organizationId,
      projectId
    );
    if (!this._openaiService.hasApiKey() || !categories.length) {
      return;
    }
    const byName = new Map(
      categories.map((category) => [category.name.toLowerCase(), category])
    );
    const pending = await this._repository.unclassified(
      organizationId,
      projectId
    );
    for (let index = 0; index < pending.length; index += 20) {
      const batch = pending.slice(index, index + 20);
      try {
        const classified = await this._openaiService.classifyStalkerMentions(
          batch,
          categories.map((category) => ({
            name: category.name,
            description: category.description,
          }))
        );
        await this._repository.saveClassification(
          organizationId,
          classified.flatMap((item) => {
            const match = byName.get(item.categoryName.trim().toLowerCase());
            if (!match) {
              return [];
            }
            return [
              {
                id: item.id,
                category: legacyCategory(match.name),
                categoryId: match.id,
                sentiment: item.sentiment,
                urgency: item.urgency,
              },
            ];
          })
        );
      } catch (err) {
        console.error('Stalker classification failed', err);
      }
    }
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
