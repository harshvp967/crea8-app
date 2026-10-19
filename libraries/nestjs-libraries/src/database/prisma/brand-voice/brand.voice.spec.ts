import { activeVoice, cleanSamples } from '@gitroom/nestjs-libraries/database/prisma/brand-voice/brand.voice';
import { ForbiddenException } from '@nestjs/common';
import { BrandVoiceService } from '@gitroom/nestjs-libraries/database/prisma/brand-voice/brand.voice.service';

jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service',
  () => ({
    SubscriptionService: class SubscriptionService {},
  })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.repository',
  () => ({
    SubscriptionRepository: class SubscriptionRepository {},
  })
);
jest.mock('@gitroom/nestjs-libraries/openai/openai.service', () => ({
  OpenaiService: class OpenaiService {},
}));
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/brand-voice/brand.voice.repository',
  () => ({
    BrandVoiceRepository: class BrandVoiceRepository {},
  })
);

describe('brand voice', () => {
  it('applies traits only when the switch is on', () => {
    expect(activeVoice(null)).toBeNull();
    expect(activeVoice({ enabled: false, traits: 'Warm.' })).toBeNull();
    expect(activeVoice({ enabled: true, traits: '   ' })).toBeNull();
    expect(activeVoice({ enabled: true, traits: ' Warm and direct. ' })).toBe(
      'Warm and direct.'
    );
    expect(
      activeVoice({
        enabled: true,
        traits: JSON.stringify({
          traits: ['Friendly', 'Short sentences'],
          sample: 'Want to try it?',
          count: 3,
          learnedAt: '2026-10-19T00:00:00.000Z',
        }),
      })
    ).toContain('Friendly');
  });

  it('keeps three to five non-empty samples', () => {
    expect(cleanSamples([' one ', '', 'two', 'three'])).toEqual([
      'one',
      'two',
      'three',
    ]);
  });
});

describe('BrandVoiceService flag', () => {
  const previous = process.env.AI_DRAFTS_ORG_IDS;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.AI_DRAFTS_ORG_IDS;
    } else {
      process.env.AI_DRAFTS_ORG_IDS = previous;
    }
  });

  it('does not read or write a voice when the organization is off the list', async () => {
    delete process.env.AI_DRAFTS_ORG_IDS;
    const repository = { find: jest.fn(), save: jest.fn(), setEnabled: jest.fn() };
    const openai = { hasApiKey: jest.fn(), extractBrandVoice: jest.fn() };
    const service = new BrandVoiceService(
      repository as any,
      { getSubscription: jest.fn() } as any,
      { getCreditsFrom: jest.fn(), useCredit: jest.fn() } as any,
      openai as any
    );
    await expect(service.get({ id: 'org-1' } as any)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    await expect(
      service.extract({ id: 'org-1' } as any, {
        samples: ['one', 'two', 'three'],
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.find).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
    expect(openai.extractBrandVoice).not.toHaveBeenCalled();
  });
});
