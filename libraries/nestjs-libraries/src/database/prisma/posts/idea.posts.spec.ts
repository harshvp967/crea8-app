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
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service',
  () => ({
    IntegrationService: class IntegrationService {},
  })
);
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/posts/posts.service',
  () => ({
    PostsService: class PostsService {},
  })
);
jest.mock('@gitroom/nestjs-libraries/integrations/integration.manager', () => ({
  IntegrationManager: class IntegrationManager {},
}));
jest.mock('@gitroom/nestjs-libraries/openai/openai.service', () => ({
  OpenaiService: class OpenaiService {},
}));
jest.mock('@gitroom/nestjs-libraries/openai/extract.content.service', () => ({
  ExtractContentService: class ExtractContentService {},
}));
jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/brand-voice/brand.voice.service',
  () => ({
    BrandVoiceService: class BrandVoiceService {},
  })
);

import { aiDraftsEnabledForOrg } from '@gitroom/nestjs-libraries/database/prisma/posts/ai.drafts.flag';
import {
  clipPlain,
  futureSlot,
  ideaPrompt,
  ideaSource,
  loneUrl,
  monthStart,
  plainToPostHtml,
} from '@gitroom/nestjs-libraries/database/prisma/posts/idea.posts';
import { ForbiddenException } from '@nestjs/common';
import { IdeaPostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/idea.posts.service';

describe('ai drafts allowlist', () => {
  const previous = process.env.AI_DRAFTS_ORG_IDS;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.AI_DRAFTS_ORG_IDS;
    } else {
      process.env.AI_DRAFTS_ORG_IDS = previous;
    }
  });

  it('stays off when the list is empty or missing', () => {
    process.env.AI_DRAFTS_ORG_IDS = '';
    expect(aiDraftsEnabledForOrg('org-1')).toBe(false);
    delete process.env.AI_DRAFTS_ORG_IDS;
    expect(aiDraftsEnabledForOrg('org-1')).toBe(false);
    expect(aiDraftsEnabledForOrg('')).toBe(false);
    expect(aiDraftsEnabledForOrg(null)).toBe(false);
  });

  it('turns on only for organization ids in the list', () => {
    process.env.AI_DRAFTS_ORG_IDS = ' org-a , org-b ';
    expect(aiDraftsEnabledForOrg('org-a')).toBe(true);
    expect(aiDraftsEnabledForOrg('org-b')).toBe(true);
    expect(aiDraftsEnabledForOrg('org-c')).toBe(false);
  });

  it('stays off for an organization that is not listed when there is no star', () => {
    process.env.AI_DRAFTS_ORG_IDS = 'org-a,org-b';
    expect(aiDraftsEnabledForOrg('org-c')).toBe(false);
    expect(aiDraftsEnabledForOrg('org-a')).toBe(true);
  });

  it('turns on every organization when the list contains a star', () => {
    process.env.AI_DRAFTS_ORG_IDS = '*';
    expect(aiDraftsEnabledForOrg('org-1')).toBe(true);
    expect(aiDraftsEnabledForOrg('org-2')).toBe(true);
    expect(aiDraftsEnabledForOrg('')).toBe(false);
    expect(aiDraftsEnabledForOrg(null)).toBe(false);
  });

  it('treats a spaced star entry as every organization', () => {
    process.env.AI_DRAFTS_ORG_IDS = ' org-a , * ';
    expect(aiDraftsEnabledForOrg('org-a')).toBe(true);
    expect(aiDraftsEnabledForOrg('org-c')).toBe(true);
    expect(aiDraftsEnabledForOrg('any-other-org')).toBe(true);
  });
});

describe('one idea drafts', () => {
  it('counts a calendar month in UTC', () => {
    expect(monthStart(new Date('2026-10-19T03:00:00.000Z')).toISOString()).toBe(
      '2026-10-01T00:00:00.000Z'
    );
  });

  it('treats a lone link as a link and leaves mixed text alone', () => {
    expect(loneUrl('https://example.com/post')).toBe('https://example.com/post');
    expect(loneUrl('see https://example.com')).toBeNull();
    expect(loneUrl('javascript:alert(1)')).toBeNull();
    expect(ideaSource('https://example.com/a', 'Hello   there')).toContain(
      'Hello there'
    );
    expect(ideaSource('a rough idea')).toBe('a rough idea');
  });

  it('keeps drafts inside the length and wraps them as post html', () => {
    expect(clipPlain('abcdef', 3)).toBe('abc');
    expect(plainToPostHtml('One\n\nTwo')).toBe('<p>One</p><p>Two</p>');
    expect(plainToPostHtml('<b>x</b>')).toBe('<p>&lt;b&gt;x&lt;/b&gt;</p>');
  });

  it('moves a past slot to the next day and keeps a future one', () => {
    const now = new Date('2026-10-19T15:00:00.000Z');
    expect(futureSlot('2026-10-19T10:00:00', now)).toBe('2026-10-20T15:00:00');
    expect(futureSlot('2026-10-19T18:30:00', now)).toBe('2026-10-19T18:30:00');
  });

  it('adds the brand voice only when one is passed', () => {
    const quiet = ideaPrompt({
      source: 'ship the update',
      channels: [
        {
          id: 'ch-1',
          name: 'News',
          provider: 'x',
          maxLength: 280,
          style: 'Short',
        },
      ],
    });
    expect(quiet.system).not.toContain('brand voice');
    const voiced = ideaPrompt({
      source: 'ship the update',
      channels: [
        {
          id: 'ch-1',
          name: 'News',
          provider: 'x',
          maxLength: 280,
          style: 'Short',
        },
      ],
      voice: 'Warm and direct.',
    });
    expect(voiced.system).toContain('Warm and direct.');
    expect(voiced.user).toContain('id: ch-1');
  });
});

describe('IdeaPostsService flag', () => {
  const previous = process.env.AI_DRAFTS_ORG_IDS;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.AI_DRAFTS_ORG_IDS;
    } else {
      process.env.AI_DRAFTS_ORG_IDS = previous;
    }
  });

  function service() {
    const openai = { hasApiKey: jest.fn(), completeIdeaDrafts: jest.fn() };
    const credits = {
      aiPostBlocked: jest.fn().mockResolvedValue(false),
      recordAiPostCall: jest.fn().mockResolvedValue({ spent: 0 }),
    };
    const integrations = { getIntegrationsList: jest.fn() };
    const built = new IdeaPostsService(
      credits as any,
      integrations as any,
      { findFreeDateTime: jest.fn().mockResolvedValue(null) } as any,
      {
        getSocialIntegration: jest.fn().mockReturnValue({
          plainPostSettings: () => ({}),
          maxLength: () => 280,
          draftStyle: () => 'Short',
        }),
      } as any,
      openai as any,
      { extractContent: jest.fn() } as any,
      { voiceForDrafts: jest.fn().mockResolvedValue(null) } as any
    );
    return { built, openai, credits, integrations };
  }

  it('blocks the draft call when the organization is not on the allowlist', async () => {
    delete process.env.AI_DRAFTS_ORG_IDS;
    const { built, openai, credits } = service();
    await expect(
      built.generate({ id: 'org-1' } as any, { idea: 'a real idea' })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(openai.completeIdeaDrafts).not.toHaveBeenCalled();
    expect(credits.recordAiPostCall).not.toHaveBeenCalled();
  });

  it('stops before the model when the credit balance cannot cover the next AI post', async () => {
    process.env.AI_DRAFTS_ORG_IDS = 'org-1';
    const { built, openai, credits } = service();
    credits.aiPostBlocked.mockResolvedValue(true);
    const result = await built.generate({ id: 'org-1' } as any, {
      idea: 'a real idea',
    });
    expect(result.error).toMatch(/out of credits/i);
    expect(result).not.toHaveProperty('limit');
    expect(openai.completeIdeaDrafts).not.toHaveBeenCalled();
    expect(credits.recordAiPostCall).not.toHaveBeenCalled();
  });

  it('records one credit-ledger call after a successful generation', async () => {
    process.env.AI_DRAFTS_ORG_IDS = 'org-1';
    const { built, openai, credits, integrations } = service();
    integrations.getIntegrationsList.mockResolvedValue([
      {
        id: 'ch-1',
        disabled: false,
        inBetweenSteps: false,
        providerIdentifier: 'x',
        name: 'News',
        picture: null,
        additionalSettings: '[]',
      },
    ]);
    openai.hasApiKey.mockReturnValue(true);
    openai.completeIdeaDrafts.mockResolvedValue([
      { id: 'ch-1', content: 'Ship the update' },
    ]);
    const result = await built.generate({ id: 'org-1' } as any, {
      idea: 'a real idea',
    });
    expect(result.drafts).toHaveLength(1);
    expect(credits.recordAiPostCall).toHaveBeenCalledWith(
      'org-1',
      expect.stringMatching(/^idea:org-1:/)
    );
    expect(result).not.toHaveProperty('used');
    expect(result).not.toHaveProperty('limit');
  });

  it('does not record a call when the model fails', async () => {
    process.env.AI_DRAFTS_ORG_IDS = 'org-1';
    const { built, openai, credits, integrations } = service();
    integrations.getIntegrationsList.mockResolvedValue([
      {
        id: 'ch-1',
        disabled: false,
        inBetweenSteps: false,
        providerIdentifier: 'x',
        name: 'News',
        picture: null,
        additionalSettings: '[]',
      },
    ]);
    openai.hasApiKey.mockReturnValue(true);
    openai.completeIdeaDrafts.mockRejectedValue(new Error('down'));
    const result = await built.generate({ id: 'org-1' } as any, {
      idea: 'a real idea',
    });
    expect(result.error).toMatch(/did not count/);
    expect(credits.recordAiPostCall).not.toHaveBeenCalled();
  });
});
