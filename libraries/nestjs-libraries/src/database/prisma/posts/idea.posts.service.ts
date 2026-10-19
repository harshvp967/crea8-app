import { ForbiddenException, Injectable } from '@nestjs/common';
import { Organization } from '@prisma/client';
import { aiDraftsEnabledForOrg } from '@gitroom/nestjs-libraries/database/prisma/posts/ai.drafts.flag';
import {
  limitForTier,
  upgradeMessage,
} from '@gitroom/nestjs-libraries/database/prisma/posts/ai.post.limits';
import {
  clipPlain,
  futureSlot,
  ideaPrompt,
  ideaSource,
  loneUrl,
  monthStart,
  readAdditionalSettings,
} from '@gitroom/nestjs-libraries/database/prisma/posts/idea.posts';
import { IdeaPostsDto } from '@gitroom/nestjs-libraries/dtos/posts/idea.posts.dto';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { SubscriptionRepository } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.repository';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { OpenaiService } from '@gitroom/nestjs-libraries/openai/openai.service';
import { ExtractContentService } from '@gitroom/nestjs-libraries/openai/extract.content.service';

const AI_POSTS = 'ai_posts';

export type IdeaDraft = {
  integrationId: string;
  provider: string;
  name: string;
  content: string;
  publishAt: string;
  settings: Record<string, string | boolean>;
  maxLength: number;
};

export type IdeaPostsResult = {
  used: number;
  limit: number;
  limited?: boolean;
  message?: string;
  error?: string;
  drafts?: IdeaDraft[];
};

@Injectable()
export class IdeaPostsService {
  constructor(
    private _subscriptionService: SubscriptionService,
    private _subscriptionRepository: SubscriptionRepository,
    private _integrationService: IntegrationService,
    private _postsService: PostsService,
    private _integrationManager: IntegrationManager,
    private _openaiService: OpenaiService,
    private _extractContentService: ExtractContentService
  ) {}

  private assertEnabled(orgId: string) {
    if (!aiDraftsEnabledForOrg(orgId)) {
      throw new ForbiddenException('Not available');
    }
  }

  // Brand voice fills this in when that setting is on for the organization.
  protected async brandVoice(_orgId: string): Promise<string | null> {
    return null;
  }

  private async usageCounts(org: Organization) {
    const subscription = await this._subscriptionService.getSubscription(org.id);
    const limit = limitForTier(subscription?.subscriptionTier);
    const used = await this._subscriptionRepository.getCreditsFrom(
      org.id,
      monthStart(),
      AI_POSTS
    );
    return { used, limit };
  }

  async usage(org: Organization): Promise<IdeaPostsResult> {
    this.assertEnabled(org.id);
    return this.usageCounts(org);
  }

  async generate(org: Organization, body: IdeaPostsDto): Promise<IdeaPostsResult> {
    this.assertEnabled(org.id);
    const { used, limit } = await this.usageCounts(org);
    if (used >= limit) {
      return {
        used,
        limit,
        limited: true,
        message: upgradeMessage(used, limit),
      };
    }

    const channels = await this.channels(org.id, body.customer);
    if (!channels.length) {
      return {
        used,
        limit,
        error: 'Connect a channel first, then try the idea again.',
      };
    }

    if (!this._openaiService.hasApiKey()) {
      return {
        used,
        limit,
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
      posts = await this._subscriptionRepository.useCredit(
        org,
        AI_POSTS,
        () => this._openaiService.completeIdeaDrafts(prompt.system, prompt.user)
      );
    } catch {
      return {
        used,
        limit,
        error: 'Could not draft posts. Try again. Scheduling still works.',
      };
    }

    const byId = new Map(posts.map((post) => [post.id, post.content]));
    const drafts = await Promise.all(
      channels.map(async (channel) => ({
        integrationId: channel.integrationId,
        provider: channel.provider,
        name: channel.name,
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
      used: used + 1,
      limit,
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
          maxLength: maxLength > 0 ? maxLength : 1000,
          style:
            provider?.draftStyle?.() ||
            'Match the usual length and tone of this platform.',
          settings,
        };
      });
  }
}
