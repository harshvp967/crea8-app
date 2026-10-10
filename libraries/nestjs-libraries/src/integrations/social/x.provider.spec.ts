jest.mock('twitter-api-v2', () => {
  const v2 = {
    singleTweet: jest.fn(),
    tweetLikedBy: jest.fn(),
    retweet: jest.fn(),
    tweet: jest.fn(),
    userTimeline: jest.fn(),
    tweets: jest.fn(),
    userByUsername: jest.fn(),
  };
  const TwitterApi = jest.fn().mockImplementation(() => ({ v2 }));
  (TwitterApi as unknown as { __v2: typeof v2 }).__v2 = v2;
  return { TwitterApi };
});

import { TwitterApi } from 'twitter-api-v2';
import dayjs from 'dayjs';
import {
  XProvider,
  chunkIds,
  resetXReadCache,
  xKeepsLinks,
  xMetricChange,
  xRateLimitWaitMs,
  X_POST_LOOKUP_BATCH,
} from '@gitroom/nestjs-libraries/integrations/social/x.provider';

const v2 = (TwitterApi as unknown as { __v2: Record<string, jest.Mock> }).__v2;

const integration = { token: 'access:secret', internalId: 'user-1' } as any;

const metrics = (partial: Record<string, number>) => ({
  impression_count: 0,
  bookmark_count: 0,
  like_count: 0,
  quote_count: 0,
  reply_count: 0,
  retweet_count: 0,
  ...partial,
});

describe('X provider credit use', () => {
  beforeEach(() => {
    resetXReadCache();
    delete process.env.STRIP_LINKS_FROM_X_POSTS;
    delete process.env.DISABLE_X_ANALYTICS;
    process.env.X_API_KEY = 'key';
    process.env.X_API_SECRET = 'secret';
    for (const fn of Object.values(v2)) {
      fn.mockReset();
    }
  });

  it('strips links by default and keeps them when asked', () => {
    const provider = new XProvider();
    expect(provider.stripLinks()).toBe(true);
    expect(provider.keepsLinks({})).toBe(false);
    expect(provider.keepsLinks({ include_links: true })).toBe(true);
    expect(provider.keepsLinks({ post_type: 'article' })).toBe(true);
    expect(xKeepsLinks(false, {})).toBe(true);
    process.env.STRIP_LINKS_FROM_X_POSTS = 'false';
    expect(provider.stripLinks()).toBe(false);
    expect(provider.keepsLinks({})).toBe(true);
  });

  it('chunks post ids at the lookup limit and dedupes them', () => {
    const ids = Array.from({ length: X_POST_LOOKUP_BATCH + 2 }, (_, i) => String(i));
    ids.push('0');
    const chunks = chunkIds(ids);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(100);
    expect(chunks[1]).toEqual(['100', '101']);
  });

  it('does not invent a percentage when the earlier half is empty', () => {
    expect(xMetricChange(0, 10)).toBe(0);
    expect(xMetricChange(2, 4)).toBe(100);
    expect(xMetricChange(4, 2)).toBe(-50);
    expect(xRateLimitWaitMs(0)).toBeNull();
    expect(xRateLimitWaitMs(Math.floor(Date.now() / 1000) + 600)).toBeNull();
    const soon = Math.floor(Date.now() / 1000) + 2;
    const wait = xRateLimitWaitMs(soon);
    expect(wait).not.toBeNull();
    expect(wait as number).toBeLessThanOrEqual(2000);
  });

  it('counts likes from the post lookup, not liking_users', async () => {
    v2.singleTweet.mockResolvedValue({
      data: { public_metrics: metrics({ like_count: 4 }) },
    });
    v2.retweet.mockResolvedValue({});
    const provider = new XProvider();

    await expect(
      provider.autoRepostPost(integration, 'post-1', { likesAmount: '5' })
    ).resolves.toBe(false);
    expect(v2.tweetLikedBy).not.toHaveBeenCalled();
    expect(v2.retweet).not.toHaveBeenCalled();
    expect(v2.singleTweet).toHaveBeenCalledWith('post-1', {
      'tweet.fields': ['public_metrics'],
    });

    resetXReadCache();
    v2.singleTweet.mockResolvedValue({
      data: { public_metrics: metrics({ like_count: 5 }) },
    });
    await expect(
      provider.autoRepostPost(integration, 'post-1', { likesAmount: '5' })
    ).resolves.toBe(true);
    expect(v2.retweet).toHaveBeenCalledWith('user-1', 'post-1');

    resetXReadCache();
    v2.singleTweet.mockResolvedValue({
      data: { public_metrics: metrics({ like_count: 9 }) },
    });
    await provider.autoPlugPost(integration, 'post-2', {
      likesAmount: '1',
      post: 'see https://example.com/offer now',
    });
    expect(v2.tweet).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'see now',
        reply: { in_reply_to_tweet_id: 'post-2' },
      })
    );
    expect(v2.tweetLikedBy).not.toHaveBeenCalled();
  });

  it('reads timeline metrics and only batches ids that came back without them', async () => {
    const provider = new XProvider();
    v2.userTimeline.mockResolvedValue({
      data: {
        data: [
          {
            id: 'old',
            created_at: dayjs().subtract(10, 'day').toISOString(),
            public_metrics: metrics({ like_count: 2, impression_count: 1 }),
          },
          {
            id: 'new',
            created_at: dayjs().subtract(1, 'day').toISOString(),
            public_metrics: metrics({ like_count: 4, impression_count: 3 }),
          },
        ],
      },
      meta: {},
    });

    const rows = await provider.analytics('account', 'access:secret', 14);
    const likes = rows.find((row) => row.label === 'LIKE');
    expect(likes?.percentageChange).toBe(100);
    expect(likes?.data.map((point) => point.total)).toEqual(['2', '4']);
    expect(v2.tweets).not.toHaveBeenCalled();
    expect(v2.userTimeline.mock.calls[0][1]['tweet.fields']).toEqual([
      'id',
      'created_at',
      'public_metrics',
    ]);
    expect(v2.userTimeline.mock.calls[0][1]['user.fields']).toBeUndefined();

    await provider.analytics('account', 'access:secret', 14);
    expect(v2.userTimeline).toHaveBeenCalledTimes(1);
  });

  it('looks up missing metrics in batches of 100', async () => {
    const provider = new XProvider();
    const first = Array.from({ length: 100 }, (_, i) => ({ id: String(i) }));
    v2.userTimeline
      .mockResolvedValueOnce({
        data: { data: first },
        meta: { next_token: 'next' },
      })
      .mockResolvedValueOnce({
        data: { data: [{ id: '100' }] },
        meta: {},
      });
    v2.tweets.mockImplementation(async (ids: string[]) => ({
      data: ids.map((id) => ({
        id,
        created_at: dayjs().toISOString(),
        public_metrics: metrics({ like_count: 1 }),
      })),
    }));

    await provider.analytics('account-2', 'access:secret', 7);

    expect(v2.tweets).toHaveBeenCalledTimes(2);
    expect(v2.tweets.mock.calls[0][0]).toHaveLength(100);
    expect(v2.tweets.mock.calls[1][0]).toEqual(['100']);
  });
});
