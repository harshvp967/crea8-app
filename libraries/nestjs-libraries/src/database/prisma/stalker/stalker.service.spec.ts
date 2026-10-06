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
  orderKeywordsForScan,
  StalkerService,
} from '@gitroom/nestjs-libraries/database/prisma/stalker/stalker.service';
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
    expect(rows[0].lastScan).toBe(scanned.toISOString());
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
