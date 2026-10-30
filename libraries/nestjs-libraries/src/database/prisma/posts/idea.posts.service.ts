import { ForbiddenException, Injectable } from '@nestjs/common';
import { Organization } from '@prisma/client';
import { aiDraftsEnabledForOrg } from '@gitroom/nestjs-libraries/database/prisma/posts/ai.drafts.flag';
import {
  clipPlain,
  futureSlot,
  ideaPrompt,
  ideaSource,
  loneUrl,
  readAdditionalSettings,
} from '@gitroom/nestjs-libraries/database/prisma/posts/idea.posts';
import { IdeaPostsDto } from '@gitroom/nestjs-libraries/dtos/posts/idea.posts.dto';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { OpenaiService } from '@gitroom/nestjs-libraries/openai/openai.service';
import { ExtractContentService } from '@gitroom/nestjs-libraries/openai/extract.content.service';
import { BrandVoiceService } from '@gitroom/nestjs-libraries/database/prisma/brand-voice/brand.voice.service';
import { CreditsService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/credits.service';
import {
  BillingBlocked,
  creditUpgradeMessage,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.rules';

export type IdeaDraft = {
  integrationId: string;
  provider: string;
  name: string;
  picture?: string | null;
  content: string;
  publishAt: string;
  settings: Record<string, string | boolean>;
  maxLength: number;
};

export type IdeaPostsResult = {
  channels?: number;
  voice?: boolean;
  message?: string;
  error?: string;
  drafts?: IdeaDraft[];
};

@Injectable()
export class IdeaPostsService {
  constructor(
    private _credits: CreditsService,
    private _integrationService: IntegrationService,
    private _postsService: PostsService,
    private _integrationManager: IntegrationManager,
    private _openaiService: OpenaiService,
    private _extractContentService: ExtractContentService,
    private _brandVoiceService: BrandVoiceService
  ) {}

  private assertEnabled(orgId: string) {
    if (!aiDraftsEnabledForOrg(orgId)) {
      throw new ForbiddenException('Not available');
    }
  }

  // Applied only when this organization has saved a voice and turned it on.
  protected async brandVoice(orgId: string): Promise<string | null> {
    return this._brandVoiceService.voiceForDrafts(orgId);
  }

  async usage(org: Organization): Promise<IdeaPostsResult> {
    this.assertEnabled(org.id);
    const channels = await this.channels(org.id);
    return { channels: channels.length };
  }

  async generate(org: Organization, body: IdeaPostsDto): Promise<IdeaPostsResult> {
    this.assertEnabled(org.id);
    if (await this._credits.aiPostBlocked(org.id)) {
      return { error: creditUpgradeMessage() };
    }

    const channels = await this.channels(org.id, body.customer);
    if (!channels.length) {
      return {
        error: 'Connect a channel first, then try the idea again.',
      };
    }

    if (!this._openaiService.hasApiKey()) {
      return {
        error: 'AI is not set up yet. Scheduling still works.',
      };
    }

    const source = await this.sourceFor(body.idea);
    const voice = await this.brandVoice(org.id);
    const prompt = ideaPrompt({
      source,
      channels: channels.map((channel) => ({
        id: channel.integrationId,
        name: channel.name,
        provider: channel.provider,
        maxLength: channel.maxLength,
        style: channel.style,
      })),
      voice,
    });

    let posts: { id: string; content: string }[];
    try {
      posts = await this._openaiService.completeIdeaDrafts(
        prompt.system,
        prompt.user
      );
    } catch {
      return {
        voice: !!voice,
        error: "Couldn't write your drafts. Your idea is still here. Nothing was added, and this try did not count.",
      };
    }

    try {
      await this._credits.recordAiPostCall(org.id, `idea:${org.id}:${Date.now()}`);
    } catch (err) {
      if (err instanceof BillingBlocked) {
        return { error: err.message };
      }
      throw err;
    }

    const byId = new Map(posts.map((post) => [post.id, post.content]));
    const drafts = await Promise.all(
      channels.map(async (channel) => ({
        integrationId: channel.integrationId,
        provider: channel.provider,
        name: channel.name,
        picture: channel.picture,
        content:
          clipPlain(byId.get(channel.integrationId) || '', channel.maxLength) ||
          clipPlain(source, Math.min(channel.maxLength, 280)),
        publishAt: futureSlot(
          await this.suggest(org.id, channel.integrationId)
        ),
        settings: channel.settings,
        maxLength: channel.maxLength,
      }))
    );

    return {
      voice: !!voice,
      drafts: drafts.filter((draft) => draft.content),
    };
  }

  private async sourceFor(idea: string) {
    const url = loneUrl(idea);
    if (!url) {
      return ideaSource(idea);
    }
    try {
      const page = await Promise.race([
        this._extractContentService.extractContent(url),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 8000)
        ),
      ]);
      return ideaSource(idea, page);
    } catch {
      return ideaSource(idea);
    }
  }

  private async suggest(orgId: string, integrationId: string) {
    try {
      return await this._postsService.findFreeDateTime(orgId, integrationId);
    } catch {
      return null;
    }
  }

  private async channels(orgId: string, customer?: string) {
    const rows = await this._integrationService.getIntegrationsList(orgId);
    return rows
      .filter((row) => !row.disabled && !row.inBetweenSteps)
      .filter((row) => !customer || row.customerId === customer)
      .map((row) => {
        const provider = this._integrationManager.getSocialIntegration(
          row.providerIdentifier
        );
        const additional = readAdditionalSettings(row.additionalSettings);
        const settings = provider?.plainPostSettings?.() || {};
        const maxLength = provider?.maxLength?.(additional, settings) || 1000;
        return {
          integrationId: row.id,
          provider: row.providerIdentifier,
          name: row.name,
          picture: row.picture,
          maxLength: maxLength > 0 ? maxLength : 1000,
          style:
            provider?.draftStyle?.() ||
            'Match the usual length and tone of this platform.',
          settings,
        };
      });
  }
}
