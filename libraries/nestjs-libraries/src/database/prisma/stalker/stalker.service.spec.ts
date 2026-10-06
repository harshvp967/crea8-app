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
import { StalkerService } from '@gitroom/nestjs-libraries/database/prisma/stalker/stalker.service';

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
}) => {
  const repository = {
    listProjects: jest.fn().mockResolvedValue([project]),
    listActiveSocial: jest.fn().mockResolvedValue([
      integration(options.tokenExpiration, options.token),
    ]),
    listKeywords: jest.fn().mockResolvedValue([]),
    listCursors: jest.fn().mockResolvedValue([]),
    readSearchCache: jest.fn().mockResolvedValue(null),
    writeSearchCache: jest.fn().mockResolvedValue(undefined),
    finishScan: jest.fn().mockResolvedValue(undefined),
    noteScanFailure: jest.fn().mockResolvedValue(undefined),
    insertMentions: jest.fn().mockResolvedValue(1),
    listCategories: jest.fn().mockResolvedValue([]),
  };
  const source = {
    id: 'youtube' as const,
    label: 'YouTube',
    filter: 'YOUTUBE_SEARCH',
    integrationIdentifier: () => 'youtube',
    enabled: (auth?: { accessToken?: string }) => !!auth?.accessToken,
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
    } as never
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
});
