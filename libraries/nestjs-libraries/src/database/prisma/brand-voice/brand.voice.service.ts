import { ForbiddenException, Injectable } from '@nestjs/common';
import { Organization } from '@prisma/client';
import { aiDraftsEnabledForOrg } from '@gitroom/nestjs-libraries/database/prisma/posts/ai.drafts.flag';
import {
  activeVoice,
  cleanSamples,
  parseVoice,
} from '@gitroom/nestjs-libraries/database/prisma/brand-voice/brand.voice';
import { BrandVoiceRepository } from '@gitroom/nestjs-libraries/database/prisma/brand-voice/brand.voice.repository';
import { CreditsService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/credits.service';
import {
  BillingBlocked,
  creditUpgradeMessage,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.rules';
import { OpenaiService } from '@gitroom/nestjs-libraries/openai/openai.service';
import { BrandVoiceSamplesDto } from '@gitroom/nestjs-libraries/dtos/brand-voice/brand.voice.dto';

export type BrandVoiceResult = {
  enabled: boolean;
  traits: string[];
  sample: string;
  count: number;
  learnedAt: string;
  message?: string;
  error?: string;
};

@Injectable()
export class BrandVoiceService {
  constructor(
    private _brandVoiceRepository: BrandVoiceRepository,
    private _credits: CreditsService,
    private _openaiService: OpenaiService
  ) {}

  private assertEnabled(orgId: string) {
    if (!aiDraftsEnabledForOrg(orgId)) {
      throw new ForbiddenException('Not available');
    }
  }

  async voiceForDrafts(orgId: string): Promise<string | null> {
    const row = await this._brandVoiceRepository.find(orgId);
    return activeVoice(row);
  }

  private empty(extra: Partial<BrandVoiceResult> = {}): BrandVoiceResult {
    return {
      enabled: false,
      traits: [],
      sample: '',
      count: 0,
      learnedAt: '',
      ...extra,
    };
  }

  private present(
    row: { enabled: boolean; traits: string } | null,
    extra: Partial<BrandVoiceResult> = {}
  ): BrandVoiceResult {
    const learned = parseVoice(row?.traits);
    return {
      enabled: !!row?.enabled,
      traits: learned?.traits || [],
      sample: learned?.sample || '',
      count: learned?.count || 0,
      learnedAt: learned?.learnedAt || '',
      ...extra,
    };
  }

  async get(org: Organization): Promise<BrandVoiceResult> {
    this.assertEnabled(org.id);
    return this.present(await this._brandVoiceRepository.find(org.id));
  }

  async extract(
    org: Organization,
    body: BrandVoiceSamplesDto
  ): Promise<BrandVoiceResult> {
    this.assertEnabled(org.id);
    const samples = cleanSamples(body.samples);
    if (samples.length < 3 || samples.length > 5) {
      return this.empty({ error: 'Paste 3 to 5 posts.' });
    }

    if (await this._credits.aiPostBlocked(org.id)) {
      return this.empty({ error: creditUpgradeMessage() });
    }

    if (!this._openaiService.hasApiKey()) {
      return this.empty({
        error: 'AI is not set up yet.',
      });
    }

    let learned: { traits: string[]; sample: string };
    try {
      learned = await this._openaiService.extractBrandVoice(samples);
    } catch {
      return this.empty({
        error: 'Could not read the voice. Try again.',
      });
    }

    try {
      await this._credits.recordAiPostCall(
        org.id,
        `brand-voice:${org.id}:${Date.now()}`
      );
    } catch (err) {
      if (err instanceof BillingBlocked) {
        return this.empty({ error: err.message });
      }
      throw err;
    }
    const saved = await this._brandVoiceRepository.save(
      org.id,
      JSON.stringify({
        traits: learned.traits,
        sample: learned.sample.slice(0, 400),
        count: samples.length,
        learnedAt: new Date().toISOString(),
      })
    );
    return this.present(saved);
  }

  async setEnabled(org: Organization, enabled: boolean): Promise<BrandVoiceResult> {
    this.assertEnabled(org.id);
    const row = await this._brandVoiceRepository.find(org.id);
    if (!parseVoice(row?.traits)) {
      return this.empty({ error: 'Save a voice before turning it on.' });
    }
    const saved = await this._brandVoiceRepository.setEnabled(org.id, enabled);
    return this.present(saved);
  }
}
