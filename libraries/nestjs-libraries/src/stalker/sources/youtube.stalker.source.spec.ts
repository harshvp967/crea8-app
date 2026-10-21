jest.mock('googleapis', () => {
  const searchList = jest.fn();
  const commentThreadsList = jest.fn();
  const videosList = jest.fn();
  const youtube = jest.fn(() => ({
    search: { list: searchList },
    commentThreads: { list: commentThreadsList },
    videos: { list: videosList },
  }));
  return {
    google: {
      youtube,
      auth: {
        OAuth2: jest.fn().mockImplementation(() => ({
          setCredentials: jest.fn(),
        })),
      },
    },
    __searchList: searchList,
    __commentThreadsList: commentThreadsList,
    __videosList: videosList,
  };
});

import { google } from 'googleapis';
import {
  cachedYoutubeChannelComments,
  resetYoutubeStalkerCache,
  YoutubeChannelMiss,
  YoutubeStalkerSource,
} from '@gitroom/nestjs-libraries/stalker/sources/youtube.stalker.source';

const mocked = jest.requireMock('googleapis') as {
  __searchList: jest.Mock;
  __commentThreadsList: jest.Mock;
  __videosList: jest.Mock;
};

describe('youtube stalker search', () => {
  const previous = process.env.YOUTUBE_STALKER_API_KEY;
  const source = new YoutubeStalkerSource();

  beforeEach(async () => {
    mocked.__searchList.mockReset();
    mocked.__commentThreadsList.mockReset();
    mocked.__videosList.mockReset();
    (google.youtube as unknown as jest.Mock).mockClear();
    process.env.YOUTUBE_STALKER_API_KEY = 'public-search-key';
    delete process.env.YOUTUBE_STALKER_CACHE_HOURS;
    await resetYoutubeStalkerCache();
  });

  afterAll(() => {
    process.env.YOUTUBE_STALKER_API_KEY = previous;
  });

  it('sends YOUTUBE_STALKER_API_KEY as the key query param', async () => {
    mocked.__searchList.mockResolvedValue({ data: { items: [] } });
    await source.search('crea8', new Date('2026-10-01T00:00:00.000Z'));
    expect(google.youtube).toHaveBeenCalledWith({ version: 'v3' });
    expect(mocked.__searchList).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'public-search-key', q: 'crea8' })
    );
  });

  it('turns an API-key 401 into a short error', async () => {
    mocked.__searchList.mockRejectedValue({
      message: 'Invalid Credentials',
      response: {
        status: 401,
        data: { error: { message: 'Invalid Credentials' } },
      },
    });
    await expect(
      source.search('crea8', new Date('2026-10-01T00:00:00.000Z'))
    ).rejects.toThrow('API key was rejected');
  });

  it('keeps video drafts when comment auth fails', async () => {
    mocked.__searchList.mockResolvedValue({
      data: {
        items: [
          {
            id: { videoId: 'v1' },
            snippet: {
              title: 'Hello',
              description: 'World',
              channelTitle: 'Chan',
            },
          },
        ],
      },
    });
    mocked.__commentThreadsList.mockRejectedValue({
      message: 'Invalid Credentials',
      response: { status: 401 },
    });
    const drafts = await source.search(
      'crea8',
      new Date('2026-10-01T00:00:00.000Z')
    );
    expect(drafts.map((draft) => draft.externalId)).toEqual(['yt-video:v1']);
  });

  it('reuses a search that already covers this cursor and filters older videos', async () => {
    mocked.__searchList.mockResolvedValue({
      data: {
        items: [
          {
            id: { videoId: 'new' },
            snippet: {
              title: 'New',
              description: 'n',
              channelTitle: 'C',
              publishedAt: '2026-10-08T00:00:00.000Z',
            },
          },
          {
            id: { videoId: 'old' },
            snippet: {
              title: 'Old',
              description: 'o',
              channelTitle: 'C',
              publishedAt: '2026-10-01T00:00:00.000Z',
            },
          },
        ],
      },
    });
    mocked.__commentThreadsList.mockResolvedValue({ data: { items: [] } });
    const wide = new Date('2026-09-01T00:00:00.000Z');
    const narrow = new Date('2026-10-06T00:00:00.000Z');
    const first = await source.search('crea8', wide);
    const second = await source.search('crea8', narrow);
    expect(mocked.__searchList).toHaveBeenCalledTimes(1);
    expect(mocked.__commentThreadsList).toHaveBeenCalledTimes(2);
    expect(first.map((draft) => draft.externalId)).toEqual([
      'yt-video:new',
      'yt-video:old',
    ]);
    expect(second.map((draft) => draft.externalId)).toEqual(['yt-video:new']);
  });

  it('fetches again when the cursor is older than the cached search', async () => {
    mocked.__searchList.mockResolvedValue({ data: { items: [] } });
    const narrow = new Date('2026-10-06T00:00:00.000Z');
    const wide = new Date('2026-09-01T00:00:00.000Z');
    await source.search('crea8', narrow);
    await source.search('crea8', wide);
    expect(mocked.__searchList).toHaveBeenCalledTimes(2);
    expect(mocked.__searchList.mock.calls[1][0].publishedAfter).toBe(
      wide.toISOString()
    );
  });

  it('stops calling YouTube after the quota is exceeded', async () => {
    mocked.__searchList.mockRejectedValue({
      message: 'The request cannot be completed because you have exceeded your quota.',
      errors: [{ reason: 'quotaExceeded' }],
    });
    const since = new Date('2026-10-01T00:00:00.000Z');
    await expect(source.search('crea8', since)).rejects.toThrow(
      'quota exceeded, retrying next scan'
    );
    mocked.__searchList.mockClear();
    await expect(source.search('other phrase', since)).rejects.toThrow(
      'quota exceeded, retrying next scan'
    );
    expect(mocked.__searchList).not.toHaveBeenCalled();
  });

  it('keeps the video when comment quota is exceeded and blocks the next search', async () => {
    mocked.__searchList.mockResolvedValue({
      data: {
        items: [
          {
            id: { videoId: 'v1' },
            snippet: { title: 'Hello', description: 'World', channelTitle: 'Chan' },
          },
        ],
      },
    });
    mocked.__commentThreadsList.mockRejectedValue({
      errors: [{ reason: 'dailyLimitExceeded' }],
    });
    const since = new Date('2026-10-01T00:00:00.000Z');
    const drafts = await source.search('crea8', since);
    expect(drafts.map((draft) => draft.externalId)).toEqual(['yt-video:v1']);
    mocked.__searchList.mockClear();
    await expect(source.search('another', since)).rejects.toThrow(
      'quota exceeded, retrying next scan'
    );
    expect(mocked.__searchList).not.toHaveBeenCalled();
  });

  it('reuses channel comments and does not cache a failed read', async () => {
    const draft = {
      externalId: 'yt-comment:1',
      source: 'YOUTUBE_COMMENT' as const,
      authorName: 'Ada',
      text: 'hello',
    };
    const load = jest.fn().mockResolvedValue([draft]);
    await expect(cachedYoutubeChannelComments('chan', load)).resolves.toEqual([draft]);
    await expect(cachedYoutubeChannelComments('chan', load)).resolves.toEqual([draft]);
    expect(load).toHaveBeenCalledTimes(1);

    await resetYoutubeStalkerCache();
    const missed = jest
      .fn()
      .mockRejectedValueOnce(new YoutubeChannelMiss())
      .mockResolvedValueOnce([draft]);
    await expect(cachedYoutubeChannelComments('chan', missed)).resolves.toEqual([]);
    await expect(cachedYoutubeChannelComments('chan', missed)).resolves.toEqual([draft]);
    expect(missed).toHaveBeenCalledTimes(2);
  });

  it('joins brand, aliases, and keywords into one OR query', () => {
    expect(
      source.buildQuery({
        phrases: ['crea8', 'crea8.one', 'post ideas'],
        handle: 'crea8',
      })
    ).toBe('crea8|crea8.one|"post ideas"|@crea8');
    expect(source.foldsKeywordsIntoQuery()).toBe(true);
  });

  it('asks for 50 videos and a second page only when the first page is full and in window', async () => {
    const since = new Date('2026-10-01T00:00:00.000Z');
    const page = (count: number, token?: string, start = 0) => ({
      data: {
        nextPageToken: token,
        items: Array.from({ length: count }, (_, index) => ({
          id: { videoId: `v${start + index}` },
          snippet: {
            title: `Title ${start + index}`,
            description: 'crea8',
            channelTitle: 'Chan',
            publishedAt: '2026-10-08T00:00:00.000Z',
          },
        })),
      },
    });
    mocked.__searchList
      .mockResolvedValueOnce(page(50, 'p2'))
      .mockResolvedValueOnce(page(1, undefined, 50));
    mocked.__videosList.mockImplementation(async ({ id }: { id: string[] }) => ({
      data: {
        items: id.map((videoId) => ({
          id: videoId,
          statistics: { commentCount: '0' },
        })),
      },
    }));
    const drafts = await source.search('crea8', since);
    expect(mocked.__searchList).toHaveBeenCalledTimes(2);
    expect(mocked.__searchList.mock.calls[0][0].maxResults).toBe(50);
    expect(mocked.__searchList.mock.calls[0][0].pageToken).toBeUndefined();
    expect(mocked.__searchList.mock.calls[1][0].pageToken).toBe('p2');
    expect(mocked.__videosList.mock.calls.map((call) => call[0].id.length)).toEqual([
      50, 1,
    ]);
    expect(mocked.__commentThreadsList).not.toHaveBeenCalled();
    expect(drafts).toHaveLength(51);

    mocked.__searchList.mockClear();
    mocked.__searchList.mockResolvedValue(page(2, 'ignored'));
    await resetYoutubeStalkerCache();
    await source.search('short', since);
    expect(mocked.__searchList).toHaveBeenCalledTimes(1);
  });

  it('stops at the first stored video and skips its comments', async () => {
    const narrow = new Date('2026-10-06T00:00:00.000Z');
    const wide = new Date('2026-09-01T00:00:00.000Z');
    const video = (videoId: string, publishedAt: string) => ({
      id: { videoId },
      snippet: {
        title: videoId,
        description: 'crea8',
        channelTitle: 'Chan',
        publishedAt,
      },
    });
    mocked.__videosList.mockImplementation(async ({ id }: { id: string[] }) => ({
      data: {
        items: id.map((videoId) => ({
          id: videoId,
          statistics: { commentCount: '3' },
        })),
      },
    }));
    mocked.__commentThreadsList.mockResolvedValue({ data: { items: [] } });
    mocked.__searchList.mockResolvedValueOnce({
      data: { items: [video('v1', '2026-10-08T00:00:00.000Z')] },
    });
    await source.search('crea8', narrow);
    mocked.__searchList.mockResolvedValueOnce({
      data: {
        nextPageToken: 'p2',
        items: [
          video('v2', '2026-10-09T00:00:00.000Z'),
          video('v1', '2026-10-08T00:00:00.000Z'),
          video('v3', '2026-10-07T00:00:00.000Z'),
        ],
      },
    });
    mocked.__commentThreadsList.mockClear();
    mocked.__videosList.mockClear();
    const drafts = await source.search('crea8', wide);
    expect(mocked.__searchList).toHaveBeenCalledTimes(2);
    expect(drafts.map((draft) => draft.externalId)).toEqual([
      'yt-video:v2',
      'yt-video:v1',
    ]);
    expect(mocked.__videosList.mock.calls[0][0].id).toEqual(['v2']);
    expect(mocked.__commentThreadsList).toHaveBeenCalledTimes(1);
    expect(mocked.__commentThreadsList.mock.calls[0][0].maxResults).toBe(50);
    expect(mocked.__commentThreadsList.mock.calls[0][0].videoId).toBe('v2');
  });
});
