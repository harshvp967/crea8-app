jest.mock('googleapis', () => {
  const searchList = jest.fn();
  const commentThreadsList = jest.fn();
  const youtube = jest.fn(() => ({
    search: { list: searchList },
    commentThreads: { list: commentThreadsList },
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
  };
});

import { google } from 'googleapis';
import { YoutubeStalkerSource } from '@gitroom/nestjs-libraries/stalker/sources/youtube.stalker.source';

const mocked = jest.requireMock('googleapis') as {
  __searchList: jest.Mock;
  __commentThreadsList: jest.Mock;
};

describe('youtube stalker search', () => {
  const previous = process.env.YOUTUBE_STALKER_API_KEY;
  const source = new YoutubeStalkerSource();

  beforeEach(() => {
    mocked.__searchList.mockReset();
    mocked.__commentThreadsList.mockReset();
    (google.youtube as unknown as jest.Mock).mockClear();
    process.env.YOUTUBE_STALKER_API_KEY = 'public-search-key';
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
});
