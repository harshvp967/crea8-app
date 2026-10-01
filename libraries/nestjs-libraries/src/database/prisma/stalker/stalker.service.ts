import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StalkerRepository } from '@gitroom/nestjs-libraries/database/prisma/stalker/stalker.repository';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { OpenaiService } from '@gitroom/nestjs-libraries/openai/openai.service';
import {
  CreateStalkerKeywordDto,
  StalkerDraftDto,
  StalkerMentionQueryDto,
} from '@gitroom/nestjs-libraries/dtos/stalker/stalker.dto';
import { StalkerMentionDraft } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';

export const isStalkerEnabled = () => process.env.STALKER_ENABLED === 'true';

const MAX_KEYWORDS = 10;
const KEYWORDS_PER_POLL = 5;

@Injectable()
export class StalkerService {
  constructor(
    private _repository: StalkerRepository,
    private _integrationManager: IntegrationManager,
    private _openaiService: OpenaiService
  ) {}

  assertEnabled() {
    if (!isStalkerEnabled()) {
      throw new NotFoundException('Stalker is disabled');
    }
  }

  status() {
    this.assertEnabled();
    return {
      enabled: true,
      pollHours: 6,
      maxKeywords: MAX_KEYWORDS,
      keywordsSearchedPerRun: KEYWORDS_PER_POLL,
      openAi: this._openaiService.hasApiKey(),
    };
  }

  mentions(organizationId: string, query: StalkerMentionQueryDto) {
    this.assertEnabled();
    return this._repository.listMentions(organizationId, query);
  }

  keywords(organizationId: string) {
    this.assertEnabled();
    return this._repository.listKeywords(organizationId);
  }

  async createKeyword(organizationId: string, body: CreateStalkerKeywordDto) {
    this.assertEnabled();
    const phrase = body.phrase.trim().replace(/\s+/g, ' ');
    if (phrase.length < 2) {
      throw new BadRequestException('Keyword is too short');
    }
    const existing = await this._repository.findKeyword(organizationId, phrase);
    if (existing) {
      return existing;
    }
    const total = await this._repository.countKeywords(organizationId);
    if (total >= MAX_KEYWORDS) {
      throw new BadRequestException(`You can save up to ${MAX_KEYWORDS} keywords`);
    }
    return this._repository.createKeyword(organizationId, phrase);
  }

  async deleteKeyword(organizationId: string, id: string) {
    this.assertEnabled();
    await this._repository.deleteKeyword(organizationId, id);
    return { deleted: true };
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

    const [integrations, keywords] = await Promise.all([
      this._repository.listActiveSocial(),
      this._repository.listKeywords(organizationId),
    ]);
    const orgIntegrations = integrations.filter(
      (integration) => integration.organizationId === organizationId
    );
    const phrases = keywords.map((keyword) => keyword.phrase);
    const keywordIds = new Map(
      keywords.map((keyword) => [keyword.phrase.toLowerCase(), keyword.id])
    );
    let keywordSearchUsed = false;

    for (const integration of orgIntegrations) {
      const provider = this._integrationManager.getSocialIntegration(
        integration.providerIdentifier
      );
      if (!provider?.collectStalkerMentions) {
        continue;
      }
      const passKeywords =
        !!provider.searchesPublicKeywords && !keywordSearchUsed
          ? phrases.slice(0, KEYWORDS_PER_POLL)
          : [];
      if (passKeywords.length) {
        keywordSearchUsed = true;
      }

      let drafts: StalkerMentionDraft[] = [];
      try {
        drafts = await provider.collectStalkerMentions({
          accessToken: integration.token,
          integration,
          keywords: passKeywords,
        });
      } catch (err) {
        console.error('Stalker collect failed', integration.id, err);
        continue;
      }

      await this._repository.insertMentions(
        organizationId,
        integration.id,
        drafts.slice(0, 40),
        keywordIds
      );
    }

    await this.classifyOrganization(organizationId);
    await this.clusterOrganization(organizationId);
    return { ok: true };
  }

  async pollAll() {
    if (!isStalkerEnabled()) {
      return;
    }
    const integrations = await this._repository.listActiveSocial();
    const organizationIds = [
      ...new Set(integrations.map((integration) => integration.organizationId)),
    ];
    for (const organizationId of organizationIds) {
      await this.pollOrganization(organizationId);
    }
  }

  private async classifyOrganization(organizationId: string) {
    if (!this._openaiService.hasApiKey()) {
      return;
    }
    const pending = await this._repository.unclassified(organizationId);
    for (let index = 0; index < pending.length; index += 20) {
      const batch = pending.slice(index, index + 20);
      try {
        const classified = await this._openaiService.classifyStalkerMentions(
          batch
        );
        await this._repository.saveClassification(organizationId, classified);
      } catch (err) {
        console.error('Stalker classification failed', err);
      }
    }
  }

  private async clusterOrganization(organizationId: string) {
    if (!this._openaiService.hasApiKey()) {
      return;
    }
    const recent = await this._repository.recentForThemes(organizationId);
    if (recent.length < 2) {
      return;
    }
    try {
      const themes = await this._openaiService.clusterStalkerThemes(recent);
      await this._repository.replaceThemes(organizationId, themes);
    } catch (err) {
      console.error('Stalker themes failed', err);
    }
  }
}
