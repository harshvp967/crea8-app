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
      { aiPostBlocked: jest.fn(), recordAiPostCall: jest.fn() } as any,
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

  it('records a successful learn as an AI post call and drops the monthly cap', async () => {
    process.env.AI_DRAFTS_ORG_IDS = 'org-1';
    const repository = {
      find: jest.fn(),
      save: jest.fn().mockImplementation(async (_orgId: string, traits: string) => ({
        enabled: false,
        traits,
      })),
      setEnabled: jest.fn(),
    };
    const credits = {
      aiPostBlocked: jest.fn().mockResolvedValue(false),
      recordAiPostCall: jest.fn().mockResolvedValue({ spent: 1 }),
    };
    const openai = {
      hasApiKey: jest.fn().mockReturnValue(true),
      extractBrandVoice: jest.fn().mockResolvedValue({
        traits: ['Warm'],
        sample: 'Hello',
      }),
    };
    const service = new BrandVoiceService(
      repository as any,
      credits as any,
      openai as any
    );
    const result = await service.extract({ id: 'org-1' } as any, {
      samples: ['one', 'two', 'three'],
    });
    expect(credits.recordAiPostCall).toHaveBeenCalledWith(
      'org-1',
      expect.stringMatching(/^brand-voice:org-1:/)
    );
    expect(result.traits).toEqual(['Warm']);
    expect(result).not.toHaveProperty('limit');
    expect(result).not.toHaveProperty('used');
  });

  it('does not call the model when the credit balance cannot cover the learn', async () => {
    process.env.AI_DRAFTS_ORG_IDS = 'org-1';
    const openai = {
      hasApiKey: jest.fn().mockReturnValue(true),
      extractBrandVoice: jest.fn(),
    };
    const credits = {
      aiPostBlocked: jest.fn().mockResolvedValue(true),
      recordAiPostCall: jest.fn(),
    };
    const service = new BrandVoiceService(
      { find: jest.fn(), save: jest.fn(), setEnabled: jest.fn() } as any,
      credits as any,
      openai as any
    );
    const result = await service.extract({ id: 'org-1' } as any, {
      samples: ['one', 'two', 'three'],
    });
    expect(result.error).toMatch(/out of credits/i);
    expect(openai.extractBrandVoice).not.toHaveBeenCalled();
    expect(credits.recordAiPostCall).not.toHaveBeenCalled();
  });
});
