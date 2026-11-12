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
  announcement,
  clipPlain,
  COMPANY_ANNOUNCEMENT,
  futureSlot,
  ideaPrompt,
  ideaSource,
  loneUrl,
  monthStart,
  normalizeIdeaFormat,
  normalizeIdeaVoice,
  PERSONAL_ANNOUNCEMENT,
  plainToPostHtml,
  postLimit,
  shapeChannelPosts,
  SHORT_POST_CAP,
} from '@gitroom/nestjs-libraries/database/prisma/posts/idea.posts';
import { readFileSync } from 'fs';
import { join } from 'path';
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

  const longBody = 'Customers can try the update this week. '.repeat(12).trim();

  it('defaults to one short personal post inside the channel limit', () => {
    expect(normalizeIdeaFormat(undefined)).toBe('short');
    expect(normalizeIdeaFormat('one_short')).toBe('short');
    expect(normalizeIdeaFormat('one_long')).toBe('long');
    expect(normalizeIdeaVoice(undefined)).toBe('personal');
    expect(normalizeIdeaVoice('company')).toBe('company');
    expect(announcement('personal')).toBe(PERSONAL_ANNOUNCEMENT);
    expect(announcement('company')).toBe(COMPANY_ANNOUNCEMENT);
    expect(postLimit('short', 3000)).toBe(SHORT_POST_CAP);
    expect(postLimit('long', 40)).toBe(40);
    const posts = shapeChannelPosts({
      text: longBody,
      maxLength: 3000,
      supportsThread: true,
    });
    expect(posts).toHaveLength(1);
    expect(posts[0].startsWith(PERSONAL_ANNOUNCEMENT)).toBe(true);
    expect(posts[0].length).toBeLessThanOrEqual(SHORT_POST_CAP);
  });

  it('lets a long company post use the channel limit', () => {
    const posts = shapeChannelPosts({
      text: longBody,
      format: 'long',
      voice: 'company',
      maxLength: 3000,
      supportsThread: false,
    });
    expect(posts).toHaveLength(1);
    expect(posts[0].startsWith(COMPANY_ANNOUNCEMENT)).toBe(true);
    expect(posts[0].includes(PERSONAL_ANNOUNCEMENT)).toBe(false);
    expect(posts[0].length).toBeGreaterThan(SHORT_POST_CAP);
    expect(posts[0].length).toBeLessThanOrEqual(3000);
  });

  it('clips every draft to the channel limit', () => {
    const posts = shapeChannelPosts({
      text: longBody,
      format: 'long',
      voice: 'personal',
      maxLength: 40,
      supportsThread: false,
    });
    expect(posts).toHaveLength(1);
    expect(posts[0].startsWith(PERSONAL_ANNOUNCEMENT)).toBe(true);
    expect(posts[0].length).toBeLessThanOrEqual(40);
  });

  it('writes several posts when the channel supports a thread', () => {
    const posts = shapeChannelPosts({
      text: longBody,
      format: 'thread_short',
      voice: 'personal',
      maxLength: 280,
      supportsThread: true,
    });
    expect(posts.length).toBeGreaterThan(1);
    expect(posts[0].startsWith(PERSONAL_ANNOUNCEMENT)).toBe(true);
    posts.forEach((post) => {
      expect(post.length).toBeLessThanOrEqual(SHORT_POST_CAP);
      expect(post.length).toBeLessThanOrEqual(280);
    });
    const split = shapeChannelPosts({
      text: 'the product ships today',
      format: 'thread_long',
      voice: 'company',
      maxLength: 500,
      supportsThread: true,
    });
    expect(split.length).toBeGreaterThan(1);
    expect(split[0]).toBe(COMPANY_ANNOUNCEMENT);
    expect(split[1]).toContain('ships today');
  });

  it('falls back to one post when the channel cannot thread', () => {
    const posts = shapeChannelPosts({
      text: 'First note.\n\nSecond note.\n\nThird note about the launch.',
      format: 'thread_long',
      voice: 'company',
      maxLength: 120,
      supportsThread: false,
    });
    expect(posts).toHaveLength(1);
    expect(posts[0].startsWith(COMPANY_ANNOUNCEMENT)).toBe(true);
    expect(posts[0].length).toBeLessThanOrEqual(120);
  });

  it('keeps a blank-line thread and does not repeat the announcement', () => {
    const posts = shapeChannelPosts({
      text: 'The update is live.\n\nThe notes are in the changelog.\n\nTry it this week.',
      format: 'thread_long',
      voice: 'personal',
      maxLength: 280,
      supportsThread: true,
    });
    expect(posts.length).toBeGreaterThanOrEqual(3);
    expect(posts[0].startsWith(PERSONAL_ANNOUNCEMENT)).toBe(true);
    expect(posts[1].startsWith(PERSONAL_ANNOUNCEMENT)).toBe(false);
    expect(posts[1]).toContain('changelog');
    posts.forEach((post) => expect(post.length).toBeLessThanOrEqual(280));
  });

  it('asks for the company line and a thread only on channels that can post one', () => {
    const prompt = ideaPrompt({
      source: 'ship the update',
      format: 'thread_short',
      speaker: 'company',
      channels: [
        {
          id: 'ch-x',
          name: 'News',
          provider: 'x',
          maxLength: 280,
          style: 'Short',
          supportsThread: true,
        },
        {
          id: 'ch-li',
          name: 'Page',
          provider: 'linkedin',
          maxLength: 3000,
          style: 'Long',
          supportsThread: false,
        },
      ],
    });
    expect(prompt.system).toContain(COMPANY_ANNOUNCEMENT);
    expect(prompt.system).not.toContain(PERSONAL_ANNOUNCEMENT);
    expect(prompt.user).toContain('id: ch-x');
    expect(prompt.user).toContain('thread: yes');
    expect(prompt.user).toContain('thread: no');
    expect(prompt.user).toContain('postLimit: 200');
    expect(prompt.user).toContain('maxLength: 3000');
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
      spend: jest.fn(),
    };
    const integrations = { getIntegrationsList: jest.fn() };
    const built = new IdeaPostsService(
      credits as any,
      integrations as any,
      { findFreeDateTime: jest.fn().mockResolvedValue(null) } as any,
      {
        getSocialIntegration: jest.fn((identifier: string) => ({
          plainPostSettings: () => ({}),
          maxLength: () =>
            identifier === 'linkedin' ? 3000 : identifier === 'slack' ? 40 : 280,
          draftStyle: () => 'Short',
          supportsThread: () => identifier === 'x',
        })),
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
    expect(credits.spend).not.toHaveBeenCalled();
  });

  it('keeps the same credit and plan checks when format and voice are set', async () => {
    delete process.env.AI_DRAFTS_ORG_IDS;
    const blocked = service();
    await expect(
      blocked.built.generate({ id: 'org-1' } as any, {
        idea: 'a real idea',
        format: 'thread_long',
        voice: 'company',
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(blocked.openai.completeIdeaDrafts).not.toHaveBeenCalled();
    expect(blocked.credits.recordAiPostCall).not.toHaveBeenCalled();
    expect(blocked.credits.spend).not.toHaveBeenCalled();

    process.env.AI_DRAFTS_ORG_IDS = 'org-1';
    const poor = service();
    poor.credits.aiPostBlocked.mockResolvedValue(true);
    const refused = await poor.built.generate({ id: 'org-1' } as any, {
      idea: 'a real idea',
      format: 'thread_short',
      voice: 'personal',
    });
    expect(refused.error).toMatch(/out of credits/i);
    expect(poor.openai.completeIdeaDrafts).not.toHaveBeenCalled();
    expect(poor.credits.recordAiPostCall).not.toHaveBeenCalled();
    expect(poor.credits.spend).not.toHaveBeenCalled();
  });

  it('honors format and voice on every channel and still records one call', async () => {
    process.env.AI_DRAFTS_ORG_IDS = 'org-1';
    const { built, openai, credits, integrations } = service();
    const written = 'Customers can try the update this week. '.repeat(12).trim();
    integrations.getIntegrationsList.mockResolvedValue([
      {
        id: 'ch-x',
        disabled: false,
        inBetweenSteps: false,
        providerIdentifier: 'x',
        name: 'News',
        picture: null,
        additionalSettings: '[]',
      },
      {
        id: 'ch-li',
        disabled: false,
        inBetweenSteps: false,
        providerIdentifier: 'linkedin',
        name: 'Page',
        picture: null,
        additionalSettings: '[]',
      },
      {
        id: 'ch-sl',
        disabled: false,
        inBetweenSteps: false,
        providerIdentifier: 'slack',
        name: 'Room',
        picture: null,
        additionalSettings: '[]',
      },
    ]);
    openai.hasApiKey.mockReturnValue(true);
    openai.completeIdeaDrafts.mockResolvedValue([
      { id: 'ch-x', content: written },
      { id: 'ch-li', content: written },
      { id: 'ch-sl', content: written },
    ]);
    const result = await built.generate({ id: 'org-1' } as any, {
      idea: 'a real idea',
      format: 'thread_short',
      voice: 'company',
    });
    const [system, user] = openai.completeIdeaDrafts.mock.calls[0];
    expect(system).toContain(COMPANY_ANNOUNCEMENT);
    expect(user).toContain('thread: yes');
    expect(user).toContain('thread: no');
    const byId = new Map((result.drafts || []).map((draft) => [draft.integrationId, draft]));
    const thread = byId.get('ch-x');
    const single = byId.get('ch-li');
    const tight = byId.get('ch-sl');
    expect(thread.posts.length).toBeGreaterThan(1);
    expect(single.posts).toHaveLength(1);
    expect(tight.posts).toHaveLength(1);
    for (const draft of [thread, single, tight]) {
      expect(draft.posts[0].startsWith(COMPANY_ANNOUNCEMENT)).toBe(true);
      draft.posts.forEach((post) => {
        expect(post.length).toBeLessThanOrEqual(draft.maxLength);
        expect(post.length).toBeLessThanOrEqual(SHORT_POST_CAP);
      });
    }
    expect(tight.posts[0].length).toBeLessThanOrEqual(40);
    expect(credits.recordAiPostCall).toHaveBeenCalledTimes(1);
    expect(credits.recordAiPostCall).toHaveBeenCalledWith(
      'org-1',
      expect.stringMatching(/^idea:org-1:/)
    );
    expect(credits.spend).not.toHaveBeenCalled();
    expect(openai.completeIdeaDrafts).toHaveBeenCalledTimes(1);
  });
});

describe('thread support', () => {
  const providerSource = (name: string) =>
    readFileSync(join(__dirname, '../../../integrations/social', name), 'utf8');

  it('is on for thread networks and off for the others', () => {
    const turnedOn = 'override supportsThread() {\n    return true;\n  }';
    for (const name of [
      'x.provider.ts',
      'threads.provider.ts',
      'bluesky.provider.ts',
      'mastodon.provider.ts',
      'nostr.provider.ts',
      'farcaster.provider.ts',
    ]) {
      expect(providerSource(name)).toContain(turnedOn);
    }
    expect(providerSource('mastodon.custom.provider.ts')).toContain(
      'extends MastodonProvider'
    );
    expect(providerSource('mastodon.custom.provider.ts')).not.toContain(
      'supportsThread'
    );
    expect(providerSource('linkedin.provider.ts')).not.toContain('supportsThread');
    expect(providerSource('facebook.provider.ts')).not.toContain('supportsThread');
    expect(
      readFileSync(join(__dirname, '../../../integrations/social.abstract.ts'), 'utf8')
    ).toContain('supportsThread() {\n    return false;\n  }');
  });
});
