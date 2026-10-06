jest.mock('@gitroom/nestjs-libraries/integrations/integration.manager', () => ({
  IntegrationManager: class IntegrationManager {},
}));
jest.mock(
  '@gitroom/nestjs-libraries/integrations/refresh.integration.service',
  () => ({
    RefreshIntegrationService: class RefreshIntegrationService {},
  })
);
jest.mock('@gitroom/nestjs-libraries/openai/openai.service', () => ({
  OpenaiService: class OpenaiService {},
}));
jest.mock('@gitroom/nestjs-libraries/services/email.service', () => ({
  EmailService: class EmailService {},
}));

import { Integration } from '@prisma/client';
import {
  nextScheduledScan,
  orderKeywordsForScan,
  scanRunStatus,
  stalkerAnalyticsDetail,
  stalkerProjectIntervalMs,
  StalkerService,
} from '@gitroom/nestjs-libraries/database/prisma/stalker/stalker.service';
import { mentionRange } from '@gitroom/nestjs-libraries/database/prisma/stalker/stalker.repository';
import { X_PLAN_ERROR } from '@gitroom/nestjs-libraries/stalker/sources/x.stalker.source';

const authError = () => {
  const error = new Error('Invalid Credentials') as Error & {
    response?: { status: number };
  };
  error.response = { status: 401 };
  return error;
};

const project = {
  id: 'proj',
  organizationId: 'org',
  name: 'Brand',
  description: '',
  webhookUrl: '',
  brandName: 'brand',
  aliases: '',
  exclusions: '',
  handleX: '',
  handleRedditUser: '',
  handleRedditSubreddit: '',
  handleYoutube: '',
  handleLinkedin: '',
  handleInstagram: '',
  handleFacebook: '',
};

const integration = (tokenExpiration: Date, token = 'stale'): Integration =>
  ({
    id: 'int',
    organizationId: 'org',
    providerIdentifier: 'youtube',
    token,
    refreshToken: 'refresh',
    tokenExpiration,
  }) as Integration;

const mention = {
  externalId: 'yt-video:1',
  source: 'YOUTUBE_SEARCH' as const,
  authorName: 'Ada',
  authorHandle: 'ada',
  text: 'brand mention',
  url: 'https://www.youtube.com/watch?v=1',
};

const build = (options: {
  tokenExpiration: Date;
  token?: string;
  search: (auth?: { accessToken?: string }) => Promise<typeof mention[]>;
  refresh: jest.Mock;
  social?: Integration[];
  source?: {
    id: string;
    label: string;
    filter: string;
    integrationIdentifier: () => string | null;
    enabled: (auth?: { accessToken?: string }) => boolean;
    statusDetail: (available: boolean) => string;
    buildQuery: () => string;
    search: (keyword: string, since: Date, auth?: { accessToken?: string }) => Promise<unknown>;
  };
}) => {
  const repository = {
    listProjects: jest.fn().mockResolvedValue([project]),
    listActiveSocial: jest.fn().mockResolvedValue(
      options.social || [integration(options.tokenExpiration, options.token)]
    ),
    listKeywords: jest.fn().mockResolvedValue([]),
    listCursors: jest.fn().mockResolvedValue([]),
    listProjectOrganizations: jest
      .fn()
      .mockResolvedValue([{ organizationId: 'org' }]),
    getProject: jest.fn().mockResolvedValue(project),
    ensureGroups: jest.fn().mockResolvedValue([]),
    keywordFacts: jest.fn().mockResolvedValue([]),
    listGroups: jest.fn().mockResolvedValue([]),
    activeScan: jest.fn().mockResolvedValue(null),
    latestScan: jest.fn().mockResolvedValue(null),
    latestManualScan: jest.fn().mockResolvedValue(null),
    createScanRun: jest.fn().mockResolvedValue({ id: 'run-1' }),
    markScanRunning: jest.fn().mockResolvedValue({ count: 1 }),
    finishScanRun: jest.fn().mockResolvedValue({ count: 1 }),
    touchLastScan: jest.fn().mockResolvedValue({ count: 1 }),
    listDueProjects: jest.fn().mockResolvedValue([]),
    readSearchCache: jest.fn().mockResolvedValue(null),
    writeSearchCache: jest.fn().mockResolvedValue(undefined),
    finishScan: jest.fn().mockResolvedValue(undefined),
    noteScanFailure: jest.fn().mockResolvedValue(undefined),
    insertMentions: jest.fn().mockResolvedValue(1),
    existingKeywordIds: jest.fn(async (_p: string, ids: string[]) => new Set(ids)),
    listCategories: jest.fn().mockResolvedValue([]),
  };
  const source = options.source || {
    id: 'youtube' as const,
    label: 'YouTube',
    filter: 'YOUTUBE_SEARCH',
    integrationIdentifier: () => 'youtube',
    searchesWithoutAccount: () => !!(process.env.YOUTUBE_STALKER_API_KEY || '').trim(),
    enabled: (auth?: { accessToken?: string }) =>
      !!(process.env.YOUTUBE_STALKER_API_KEY || '').trim() || !!auth?.accessToken,
    statusDetail: () => 'Connect a YouTube channel',
    buildQuery: () => 'brand',
    search: jest.fn((_keyword: string, _since: Date, auth?: { accessToken?: string }) =>
      options.search(auth)
    ),
  };
  const service = new StalkerService(
    repository as never,
    {
      getSocialIntegration: () => ({ refreshCron: false }),
      stalkerCommentSources: (): unknown[] => [],
    } as never,
    { all: () => [source] } as never,
    { hasApiKey: () => false } as never,
    {} as never,
    {
      refresh: options.refresh,
      startRefreshWorkflow: jest.fn(),
    } as never,
    {} as never
  );
  return { service, repository, source, refresh: options.refresh };
};

describe('StalkerService token refresh', () => {
  const previous = process.env.STALKER_ENABLED;
  const previousKey = process.env.YOUTUBE_STALKER_API_KEY;

  beforeEach(() => {
    process.env.STALKER_ENABLED = 'true';
    delete process.env.YOUTUBE_STALKER_API_KEY;
  });

  afterAll(() => {
    process.env.STALKER_ENABLED = previous;
    if (previousKey === undefined) {
      delete process.env.YOUTUBE_STALKER_API_KEY;
    } else {
      process.env.YOUTUBE_STALKER_API_KEY = previousKey;
    }
  });

  it('refreshes an expired token and searches with the new one', async () => {
    const refresh = jest.fn().mockResolvedValue({
      accessToken: 'fresh',
      refreshToken: 'refresh',
      expiresIn: 3600,
    });
    const seen: string[] = [];
    const { service, source } = build({
      tokenExpiration: new Date(Date.now() - 60_000),
      search: async (auth) => {
        seen.push(auth?.accessToken || '');
        return [mention];
      },
      refresh,
    });

    const result = await service.pollOrganization('org');

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(['fresh']);
    expect(source.search).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      sources: [
        {
          projectId: 'proj',
          id: 'youtube',
          ok: true,
          searched: 1,
          found: 1,
          stored: 1,
          offTopic: 0,
        },
      ],
      totals: { found: 1, stored: 1, duplicates: 0, offTopic: 0 },
    });
  });

  it('retries a 401 once with a refreshed token', async () => {
    const refresh = jest.fn().mockResolvedValue({
      accessToken: 'fresh',
      refreshToken: 'refresh',
      expiresIn: 3600,
    });
    const seen: string[] = [];
    const { service } = build({
      tokenExpiration: new Date(Date.now() + 60 * 60 * 1000),
      search: async (auth) => {
        seen.push(auth?.accessToken || '');
        if (auth?.accessToken !== 'fresh') {
          throw authError();
        }
        return [mention];
      },
      refresh,
    });

    const result = await service.pollOrganization('org');

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(['stale', 'fresh']);
    expect(result.sources[0]).toEqual(
      expect.objectContaining({ id: 'youtube', ok: true, stored: 1 })
    );
    expect(result.totals).toEqual({
      found: 1,
      stored: 1,
      duplicates: 0,
      offTopic: 0,
    });
  });

  it('does not refresh again when the retry is still unauthorized', async () => {
    const refresh = jest.fn().mockResolvedValue({
      accessToken: 'fresh',
      refreshToken: 'refresh',
      expiresIn: 3600,
    });
    const { service, source } = build({
      tokenExpiration: new Date(Date.now() + 60 * 60 * 1000),
      search: async () => {
        throw authError();
      },
      refresh,
    });

    const result = await service.pollOrganization('org');

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(source.search).toHaveBeenCalledTimes(2);
    expect(result.sources[0].ok).toBe(false);
    expect(result.sources[0].error).toContain('Reconnect YouTube');
    expect(result.totals.stored).toBe(0);
  });

  it('uses the YouTube API key without a channel token', async () => {
    process.env.YOUTUBE_STALKER_API_KEY = 'yt-key';
    const refresh = jest.fn();
    const { service, source } = build({
      tokenExpiration: new Date(Date.now() - 60_000),
      search: async () => [mention],
      refresh,
    });

    const result = await service.pollOrganization('org');

    expect(refresh).not.toHaveBeenCalled();
    expect(source.search).toHaveBeenCalledWith(
      'brand',
      expect.any(Date),
      undefined
    );
    expect(result.sources[0].ok).toBe(true);
  });

  it('falls back to the next YouTube channel when the first refresh fails', async () => {
    const first = integration(new Date(Date.now() - 60_000), 'stale');
    first.id = 'bad';
    const second = integration(new Date(Date.now() - 60_000), 'other');
    second.id = 'good';
    const refresh = jest.fn().mockImplementation(async (current: Integration) => {
      if (current.id === 'bad') {
        return null;
      }
      return { accessToken: 'fresh-good', refreshToken: 'refresh', expiresIn: 3600 };
    });
    const seen: string[] = [];
    const { service } = build({
      tokenExpiration: new Date(),
      social: [first, second],
      search: async (auth) => {
        seen.push(auth?.accessToken || '');
        return [mention];
      },
      refresh,
    });

    const result = await service.pollOrganization('org');

    expect(seen).toEqual(['fresh-good']);
    expect(result.sources[0].ok).toBe(true);
    expect(result.sources[0].error).toBeUndefined();
  });

  it('scans every keyword, oldest cursor first', async () => {
    const keywords = Array.from({ length: 7 }, (_, index) => ({
      id: `k${index}`,
      phrase: `word${index}`,
      listenYoutube: true,
      listenReddit: false,
      listenX: false,
      listenLinkedin: false,
    }));
    const refresh = jest.fn();
    const { service, source, repository } = build({
      tokenExpiration: new Date(Date.now() + 60 * 60 * 1000),
      search: async () => [],
      refresh,
    });
    repository.listKeywords.mockResolvedValue(keywords);
    repository.listCursors.mockResolvedValue(
      keywords.slice(0, 6).map((keyword, index) => ({
        source: 'youtube',
        phraseKey: keyword.phrase.toLowerCase(),
        updatedAt: new Date(Date.now() - (6 - index) * 1000),
        cursorAt: null,
        backfillUntil: null,
        lastError: '',
      }))
    );

    await service.pollOrganization('org');

    expect((source.search as jest.Mock).mock.calls.map((call) => call[0])).toEqual([
      'brand',
      'word6',
      'word0',
      'word1',
      'word2',
      'word3',
      'word4',
      'word5',
    ]);
  });

  it('keeps polling the next organization after one throws', async () => {
    const refresh = jest.fn();
    const { service, source, repository } = build({
      tokenExpiration: new Date(Date.now() + 60 * 60 * 1000),
      search: async () => [mention],
      refresh,
    });
    repository.listProjectOrganizations.mockResolvedValue([
      { organizationId: 'bad' },
      { organizationId: 'org' },
    ]);
    repository.listProjects.mockImplementation(async (orgId: string) => {
      if (orgId === 'bad') {
        throw new Error('org down');
      }
      return [project];
    });
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await service.pollAll();

    expect(source.search).toHaveBeenCalled();
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });

  it('returns lastError on the keyword list', async () => {
    const refresh = jest.fn();
    const scanned = new Date('2026-10-06T08:00:00.000Z');
    const { service, repository } = build({
      tokenExpiration: new Date(Date.now() + 60 * 60 * 1000),
      search: async () => [],
      refresh,
    });
    repository.listKeywords.mockResolvedValue([
      {
        id: 'k1',
        phrase: 'canva',
        listenYoutube: true,
        listenReddit: false,
        listenX: false,
        listenLinkedin: false,
      },
    ]);
    repository.listCursors.mockResolvedValue([
      {
        source: 'youtube',
        phraseKey: 'canva',
        updatedAt: scanned,
        lastError: 'YouTube: channel token expired. Reconnect YouTube in Channels',
      },
    ]);

    const rows = await service.keywords('org', 'proj');

    expect(rows[0].lastError).toContain('Reconnect YouTube');
    // lastScan is the last *successful* pull; a failure alone doesn't count.
    expect(rows[0].lastScan).toBeNull();
    expect(rows[0].nextScanAt).toBeTruthy();
    expect(rows[0].scanning).toBe(false);
    expect(rows[0].backfill[0]).toEqual(
      expect.objectContaining({
        id: 'youtube',
        lastError: 'YouTube: channel token expired. Reconnect YouTube in Channels',
      })
    );
  });

  it('records a project scan and logs one line', async () => {
    const refresh = jest.fn();
    const { service, repository } = build({
      tokenExpiration: new Date(Date.now() + 60 * 60 * 1000),
      search: async () => [mention],
      refresh,
    });
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await service.executeProjectScan({
      organizationId: 'org',
      projectId: 'proj',
      trigger: 'manual',
      runId: 'run-1',
    });

    expect(result.sources[0].ok).toBe(true);
    expect(repository.markScanRunning).toHaveBeenCalledWith('run-1');
    expect(repository.finishScanRun).toHaveBeenCalledWith(
      'run-1',
      'succeeded',
      expect.any(Object),
      ''
    );
    expect(repository.touchLastScan).toHaveBeenCalledWith('proj');
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('Stalker scan project=proj trigger=manual youtube ok')
    );
    log.mockRestore();
  });

  it('lists only projects that are due and not already scanning', async () => {
    const refresh = jest.fn();
    const { service, repository } = build({
      tokenExpiration: new Date(),
      search: async () => [],
      refresh,
    });
    repository.listDueProjects.mockResolvedValue([
      { id: 'busy', organizationId: 'org' },
      { id: 'due', organizationId: 'org' },
    ]);
    repository.activeScan.mockImplementation(async (id: string) =>
      id === 'busy' ? { id: 'run' } : null
    );

    await expect(service.listDueProjectScans()).resolves.toEqual([
      { organizationId: 'org', projectId: 'due', trigger: 'schedule' },
    ]);
  });

  it('keeps an X plan error on the scan result and the keyword cursor', async () => {
    const refresh = jest.fn();
    const { service, repository } = build({
      tokenExpiration: new Date(Date.now() + 60 * 60 * 1000),
      search: async () => [],
      refresh,
      social: [],
      source: {
        id: 'x',
        label: 'X',
        filter: 'X',
        integrationIdentifier: () => null,
        enabled: () => true,
        statusDetail: () => 'Official recent search',
        buildQuery: () => '',
        search: async () => {
          throw new Error(X_PLAN_ERROR);
        },
      },
    });
    repository.listKeywords.mockResolvedValue([
      {
        id: 'k1',
        phrase: 'crea8one',
        listenYoutube: false,
        listenReddit: false,
        listenX: true,
        listenLinkedin: false,
      },
    ]);
    const logged = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await service.pollOrganization('org');

    expect(result.sources[0].ok).toBe(false);
    expect(result.sources[0].error).toBe(X_PLAN_ERROR);
    expect(repository.noteScanFailure).toHaveBeenCalledWith(
      'proj',
      'x',
      'crea8one',
      X_PLAN_ERROR
    );
    expect(logged.mock.calls.map((call) => call.join(' ')).join('\n')).toContain(X_PLAN_ERROR);
    logged.mockRestore();
    errors.mockRestore();
  });
});

describe('orderKeywordsForScan', () => {
  it('puts keywords that have never been scanned first', () => {
    const ordered = orderKeywordsForScan(
      [{ phrase: 'new' }, { phrase: 'old' }, { phrase: 'fresh' }],
      [
        { source: 'youtube', phraseKey: 'old', updatedAt: new Date('2026-10-01') },
        { source: 'youtube', phraseKey: 'fresh', updatedAt: new Date('2026-10-06') },
      ],
      'youtube'
    );
    expect(ordered.map((keyword) => keyword.phrase)).toEqual([
      'new',
      'old',
      'fresh',
    ]);
  });
});

describe('StalkerService relevance', () => {
  const previous = process.env.STALKER_ENABLED;
  beforeEach(() => {
    process.env.STALKER_ENABLED = 'true';
    process.env.YOUTUBE_STALKER_API_KEY = 'yt-key';
  });
  afterAll(() => {
    process.env.STALKER_ENABLED = previous;
    delete process.env.YOUTUBE_STALKER_API_KEY;
  });

  const setup = (
    pending: {
      id: string;
      text: string;
      source: string;
      matchKind: string | null;
      keywordId: string | null;
    }[],
    keywords: Record<string, unknown>[] = []
  ) => {
    const ctx = build({
      tokenExpiration: new Date(Date.now() + 60 * 60 * 1000),
      search: async () => [],
      refresh: jest.fn(),
    });
    const repo = ctx.repository as Record<string, jest.Mock>;
    repo.listKeywords.mockResolvedValue(keywords);
    repo.listCategories.mockResolvedValue([
      { id: 'c1', name: 'General', description: '' },
    ]);
    repo.unclassified = jest.fn().mockResolvedValue(pending);
    repo.saveClassification = jest.fn().mockResolvedValue(undefined);
    repo.mentionsByIds = jest.fn().mockResolvedValue([]);
    const classify = jest.fn(async (items: { id: string }[]) =>
      items.map((item) => ({
        id: item.id,
        categoryName: 'General',
        sentiment: 'POSITIVE',
        urgency: 10,
        relevant: false,
      }))
    );
    (ctx.service as unknown as { _openaiService: unknown })._openaiService = {
      hasApiKey: () => true,
      classifyStalkerMentions: classify,
      clusterStalkerThemes: jest.fn().mockResolvedValue([]),
    };
    repo.recentForThemes = jest.fn().mockResolvedValue([]);
    return { ...ctx, repo };
  };

  const savedRelevance = (repo: Record<string, jest.Mock>) =>
    Object.fromEntries(
      repo.saveClassification.mock.calls
        .flatMap((call) => call[1])
        .map((row: { id: string; relevant: boolean }) => [row.id, row.relevant])
    );

  it('keeps keyword matches relevant even when the AI says otherwise', async () => {
    const { service, repo } = setup(
      [
        { id: 'kw', text: 'I love Canva', source: 'YOUTUBE_SEARCH', matchKind: 'KEYWORD', keywordId: 'k1' },
        { id: 'linked', text: 'some text', source: 'YOUTUBE_COMMENT', matchKind: null, keywordId: 'k1' },
        { id: 'phrase', text: 'canva templates rock', source: 'YOUTUBE_COMMENT', matchKind: null, keywordId: null },
        { id: 'brand', text: 'brand is great', source: 'YOUTUBE_SEARCH', matchKind: 'BRAND', keywordId: null },
        { id: 'noise', text: 'first!', source: 'YOUTUBE_COMMENT', matchKind: null, keywordId: null },
      ],
      [{ id: 'k1', phrase: 'Canva', listenYoutube: false, listenReddit: false, listenX: false, listenLinkedin: false }]
    );
    const result = await service.pollOrganization('org');
    expect(savedRelevance(repo)).toEqual({
      kw: true,
      linked: true,
      phrase: true,
      brand: false,
      noise: false,
    });
    expect(result.totals.offTopic).toBe(2);
  });

  it('keeps unmatched results off-topic even if the AI calls them relevant', async () => {
    const { service, repo } = setup([
      { id: 'fuzzy', text: 'unrelated video', source: 'YOUTUBE_COMMENT', matchKind: null, keywordId: null },
    ]);
    (service as unknown as { _openaiService: { classifyStalkerMentions: jest.Mock } })._openaiService.classifyStalkerMentions.mockImplementation(
      async (items: { id: string }[]) =>
        items.map((item) => ({ id: item.id, categoryName: 'General', sentiment: 'NEUTRAL', urgency: 0, relevant: true }))
    );
    await service.pollOrganization('org');
    expect(savedRelevance(repo)).toEqual({ fuzzy: false });
  });

  it('links brand-search results to the keyword equal to the brand and skips its duplicate search', async () => {
    const { service, repository, source } = setup([], [
      { id: 'kb', phrase: 'Brand', listenYoutube: true, listenReddit: false, listenX: false, listenLinkedin: false },
      { id: 'kc', phrase: 'canva', listenYoutube: true, listenReddit: false, listenX: false, listenLinkedin: false },
    ]);
    (source.search as jest.Mock).mockImplementation(async (keyword: string) =>
      keyword === 'brand'
        ? [{ ...mention, externalId: 'b1', text: 'brand rocks', keywordPhrase: keyword }]
        : [{ ...mention, externalId: 'c1', text: 'canva rocks', keywordPhrase: keyword }]
    );
    await service.pollOrganization('org');
    expect((source.search as jest.Mock).mock.calls.map((call) => call[0])).toEqual(['brand', 'canva']);
    const [, , , drafts, ids] = repository.insertMentions.mock.calls[0];
    expect(ids.get('brand')).toBe('kb');
    expect(ids.get('canva')).toBe('kc');
    const brandDraft = drafts.find((draft: { externalId: string }) => draft.externalId === 'b1');
    expect(brandDraft.keywordPhrase).toBe('Brand');
    expect(brandDraft.matchKind).toBe('BRAND');
  });

  it('reports per-source off-topic counts for Check now', async () => {
    const { service, source } = setup([
      { id: 'noise', text: 'nothing', source: 'YOUTUBE_SEARCH', matchKind: null, keywordId: null },
    ]);
    (source.search as jest.Mock).mockResolvedValue([mention]);
    const result = await service.pollOrganization('org');
    expect(result.sources[0]).toEqual(
      expect.objectContaining({ id: 'youtube', stored: 1, offTopic: 1 })
    );
  });
});

describe('StalkerService keywords and scan status', () => {
  const previous = process.env.STALKER_ENABLED;
  beforeEach(() => {
    process.env.STALKER_ENABLED = 'true';
    delete process.env.STALKER_PROJECT_INTERVAL_HOURS;
    delete process.env.STALKER_POLL_MINUTES;
  });
  afterAll(() => {
    process.env.STALKER_ENABLED = previous;
  });
  const kw = (id: string, phrase: string, on = true) => ({
    id,
    phrase,
    listenYoutube: on,
    listenReddit: false,
    listenX: false,
    listenLinkedin: false,
  });
  const make = () =>
    build({
      tokenExpiration: new Date(Date.now() + 60 * 60 * 1000),
      search: async () => [],
      refresh: jest.fn(),
    });

  it('defaults the project interval to 3 hours', () => {
    expect(stalkerProjectIntervalMs()).toBe(3 * 60 * 60 * 1000);
  });

  it('computes run status from attempted sources only', () => {
    expect(scanRunStatus([{ ok: true }, { ok: false, skipped: true }])).toBe('succeeded');
    expect(scanRunStatus([{ ok: true }, { ok: false }])).toBe('partial');
    expect(scanRunStatus([{ ok: false }, { ok: false, skipped: true }])).toBe('failed');
  });

  it('puts the next scan on the schedule tick after lastScanAt + interval', () => {
    const now = Date.parse('2026-10-06T09:10:00.000Z');
    const last = new Date('2026-10-06T08:20:00.000Z');
    expect(nextScheduledScan(last, now).toISOString()).toBe('2026-10-06T12:00:00.000Z');
    expect(nextScheduledScan(null, now).toISOString()).toBe('2026-10-06T10:00:00.000Z');
  });

  it('marks an unconfigured source nobody listens on as skipped, and the run succeeded', async () => {
    const { service, repository } = build({
      tokenExpiration: new Date(Date.now() + 60 * 60 * 1000),
      search: async () => [],
      refresh: jest.fn(),
      social: [],
      source: {
        id: 'reddit',
        label: 'Reddit',
        filter: 'REDDIT',
        integrationIdentifier: () => 'reddit',
        enabled: () => false,
        statusDetail: () => 'needs API access',
        buildQuery: () => 'brand',
        search: async () => [],
      },
    });
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const result = await service.executeProjectScan({
      organizationId: 'org',
      projectId: 'proj',
      trigger: 'manual',
      runId: 'run-1',
    });
    expect(result.sources[0]).toEqual(expect.objectContaining({ id: 'reddit', skipped: true }));
    expect(repository.finishScanRun).toHaveBeenCalledWith('run-1', 'succeeded', expect.any(Object), '');
  });

  it('does not store rows for a keyword deleted during the scan', async () => {
    const { service, repository, source } = make();
    repository.listKeywords.mockResolvedValue([kw('k1', 'canva')]);
    (repository as Record<string, jest.Mock>).existingKeywordIds = jest
      .fn()
      .mockResolvedValue(new Set());
    (source.search as jest.Mock).mockImplementation(async (keyword: string) =>
      keyword === 'canva'
        ? [{ ...mention, externalId: 'c1', text: 'canva rocks', keywordPhrase: 'canva' }]
        : []
    );
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await service.pollOrganization('org');
    expect(repository.insertMentions).not.toHaveBeenCalled();
  });

  it('counts mentions stored today in the 30 day total and the last sparkline day', async () => {
    const { service, repository } = make();
    repository.listKeywords.mockResolvedValue([{ ...kw('k1', 'canva'), group: null }]);
    repository.keywordFacts.mockResolvedValue([
      { keywordId: 'k1', createdAt: new Date(), source: 'YOUTUBE_SEARCH' },
      { keywordId: 'k1', createdAt: new Date(), source: 'YOUTUBE_SEARCH' },
      { keywordId: 'k1', createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), source: 'YOUTUBE_SEARCH' },
    ]);
    const [row] = await service.keywords('org', 'proj');
    expect(row.mentions30d).toBe(3);
    expect(row.sparkline).toHaveLength(30);
    expect(row.sparkline[29]).toBe(2);
    expect(row.sparkline.reduce((sum: number, value: number) => sum + value, 0)).toBe(3);
  });

  it('returns 404 when deleting an unknown keyword', async () => {
    const { service, repository } = make();
    (repository as Record<string, jest.Mock>).deleteKeyword = jest.fn().mockResolvedValue({ count: 0 });
    await expect(service.deleteKeyword('org', 'nope')).rejects.toThrow('Keyword not found');
  });

  it('rejects a duplicate keyword with 409 and defaults non-brand keywords to Competitors', async () => {
    const { service, repository } = make();
    const repo = repository as Record<string, jest.Mock>;
    repo.findKeyword = jest.fn().mockResolvedValueOnce({ phrase: 'canva' }).mockResolvedValue(null);
    repo.countKeywords = jest.fn().mockResolvedValue(0);
    repo.listGroups.mockResolvedValue([
      { id: 'g-brand', name: 'My brand' },
      { id: 'g-comp', name: 'Competitors' },
    ]);
    repo.createKeyword = jest.fn().mockResolvedValue({ id: 'new' });
    jest.spyOn(service, 'requestScan').mockResolvedValue({} as never);
    await expect(service.createKeyword('org', { projectId: 'proj', phrase: 'canva' } as never)).rejects.toMatchObject({ status: 409 });
    await service.createKeyword('org', { projectId: 'proj', phrase: 'canva' } as never);
    expect(repo.createKeyword.mock.calls[0][4]).toEqual(expect.objectContaining({ groupId: 'g-comp' }));
    await service.createKeyword('org', { projectId: 'proj', phrase: 'Brand' } as never);
    expect(repo.createKeyword.mock.calls[1][4]).toEqual(expect.objectContaining({ groupId: 'g-brand' }));
  });

  it('shows paused keywords with no next scan, and brand keywords from the brand cursor', async () => {
    const { service, repository } = make();
    repository.listKeywords.mockResolvedValue([kw('k1', 'canva', false), kw('kb', 'Brand', false)]);
    const at = new Date('2026-10-06T08:00:00.000Z');
    repository.listCursors.mockResolvedValue([
      { source: 'youtube', phraseKey: 'brand', updatedAt: at, lastError: '' },
    ]);
    const rows = await service.keywords('org', 'proj');
    const canva = rows.find((row) => row.id === 'k1')!;
    const brand = rows.find((row) => row.id === 'kb')!;
    expect(canva.paused).toBe(true);
    expect(canva.nextScanAt).toBeNull();
    expect(brand.paused).toBe(false);
    expect(brand.lastScan).toBe(at.toISOString());
    expect(brand.nextScanAt).toBeTruthy();
  });
});

describe('Stalker analytics math', () => {
  const fact = (iso: string, sentiment = 'NEUTRAL') => ({
    createdAt: new Date(iso),
    sentiment,
    authorName: 'Ada',
    authorHandle: 'ada',
    source: 'YOUTUBE_SEARCH',
  });

  it('reads YYYY-MM-DD ranges as the user\'s calendar days', () => {
    const utc = mentionRange('2026-09-07', '2026-10-06');
    expect(utc.start?.toISOString()).toBe('2026-09-07T00:00:00.000Z');
    expect(utc.end?.toISOString()).toBe('2026-10-07T00:00:00.000Z');
    const ist = mentionRange('2026-09-07', '2026-10-06', -330);
    expect(ist.start?.toISOString()).toBe('2026-09-06T18:30:00.000Z');
    expect(ist.end?.toISOString()).toBe('2026-10-06T18:30:00.000Z');
    const pacific = mentionRange('2026-10-06', '2026-10-06', '420');
    expect(pacific.end?.toISOString()).toBe('2026-10-07T07:00:00.000Z');
  });

  it('fills every day in the range and averages over the whole span', () => {
    const range = mentionRange('2026-09-07', '2026-10-06', -330);
    const detail = stalkerAnalyticsDetail(
      [fact('2026-10-06T08:21:39.000Z'), fact('2026-10-06T09:00:00.000Z', 'POSITIVE'), fact('2026-10-05T20:00:00.000Z')],
      { tz: -330, from: range.start, to: range.end, now: Date.parse('2026-10-06T11:00:00.000Z') }
    );
    expect(detail.series).toHaveLength(30);
    expect(detail.series[0].date).toBe('2026-09-07');
    const last = detail.series[detail.series.length - 1];
    // 20:00 UTC on Oct 5 is 01:30 IST on Oct 6.
    expect(last).toEqual({ date: '2026-10-06', positive: 1, negative: 0, neutral: 2 });
    expect(detail.avgPerDay).toBe(0.1);
    expect(detail.supporters).toEqual([{ authorName: 'Ada', count: 1 }]);
    // Tuesday 13:51 IST.
    expect(detail.heatmap[1][13]).toBe(1);
  });
});
