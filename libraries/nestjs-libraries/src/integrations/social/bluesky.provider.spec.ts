jest.mock('@atproto/api', () => {
  const login = jest.fn();
  const getPostThread = jest.fn();
  const post = jest.fn();
  const repost = jest.fn();
  class BskyAgent {
    login = login;
    getPostThread = getPostThread;
    post = post;
    repost = repost;
  }
  (BskyAgent as unknown as { api: Record<string, jest.Mock> }).api = {
    login,
    getPostThread,
    post,
    repost,
  };
  class RichText {
    text: string;
    facets: unknown[] = [];
    constructor(options: { text: string }) {
      this.text = options.text;
    }
  }
  class AtpAgent {}
  class BlobRef {}
  return {
    BskyAgent,
    RichText,
    AtpAgent,
    BlobRef,
    AppBskyEmbedVideo: {},
    AppBskyVideoDefs: {},
  };
});

jest.mock('@gitroom/helpers/auth/auth.service', () => ({
  AuthService: {
    fixedDecryption: () =>
      JSON.stringify({
        service: 'https://bsky.social',
        identifier: 'user.bsky.social',
        password: 'app-password',
      }),
  },
}));

jest.mock('@gitroom/helpers/utils/timer', () => ({
  timer: jest.fn().mockResolvedValue(undefined),
}));

import { BskyAgent } from '@atproto/api';
import { BadBody } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import {
  BlueskyProvider,
  isBlueskyPostMissing,
} from '@gitroom/nestjs-libraries/integrations/social/bluesky.provider';

const agentApi = (
  BskyAgent as unknown as { api: Record<string, jest.Mock> }
).api;

const postUri =
  'at://did:plc:lf5m6yz5reef3we3r3bjk4bd/app.bsky.feed.post/3mxvmuuqdhq2y';

const integration = { customInstanceDetails: 'sealed' } as any;

const notFound = (name = 'NotFoundError') =>
  Object.assign(new Error(`Post not found: ${postUri}`), {
    name,
    error: 'NotFound',
    status: 400,
  });

describe('Bluesky missing post detection', () => {
  it('recognizes NotFound and ignores other client errors', () => {
    expect(isBlueskyPostMissing(notFound())).toBe(true);
    expect(isBlueskyPostMissing(notFound('XRPCError'))).toBe(true);
    expect(
      isBlueskyPostMissing(
        Object.assign(new Error(`Post not found: ${postUri}`), {
          name: 'Error',
        })
      )
    ).toBe(true);
    expect(
      isBlueskyPostMissing(
        Object.assign(new Error('Invalid Request'), {
          name: 'XRPCError',
          error: 'InvalidRequest',
          status: 400,
        })
      )
    ).toBe(false);
    expect(
      isBlueskyPostMissing(
        Object.assign(new Error('Upstream Failure'), {
          name: 'XRPCError',
          error: 'InternalServerError',
          status: 500,
        })
      )
    ).toBe(false);
    expect(isBlueskyPostMissing(new Error('socket hang up'))).toBe(false);
    expect(isBlueskyPostMissing(null)).toBe(false);
  });
});

describe('Bluesky autoPlugPost', () => {
  const provider = new BlueskyProvider();

  beforeEach(() => {
    agentApi.login.mockReset().mockResolvedValue({});
    agentApi.getPostThread.mockReset();
    agentApi.post.mockReset().mockResolvedValue({ uri: 'at://reply' });
    agentApi.repost.mockReset().mockResolvedValue({});
  });

  it('turns a NotFound thread into a non-retryable BadBody and does not post', async () => {
    agentApi.getPostThread.mockRejectedValue(notFound());

    const error = await provider
      .autoPlugPost(integration, postUri, {
        likesAmount: '10',
        post: 'a follow-up offer',
      })
      .catch((err) => err);

    expect(error).toBeInstanceOf(BadBody);
    expect(error.type).toBe('bad_body');
    expect(error.nonRetryable).toBe(true);
    expect(error.message).toContain('Post not found');
    expect(agentApi.post).not.toHaveBeenCalled();
  });

  it('stops when the thread view is a deleted or blocked post', async () => {
    agentApi.getPostThread.mockResolvedValue({
      data: { thread: { $type: 'app.bsky.feed.defs#notFoundPost' } },
    });

    await expect(
      provider.autoPlugPost(integration, postUri, {
        likesAmount: '1',
        post: 'a follow-up offer',
      })
    ).rejects.toBeInstanceOf(BadBody);

    agentApi.getPostThread.mockResolvedValue({
      data: { thread: { $type: 'app.bsky.feed.defs#blockedPost' } },
    });

    await expect(
      provider.autoRepostPost(integration, postUri, { likesAmount: '1' })
    ).rejects.toBeInstanceOf(BadBody);
    expect(agentApi.repost).not.toHaveBeenCalled();
  });

  it('rethrows transient XRPC errors so the plug can retry', async () => {
    const upstream = Object.assign(new Error('Upstream Failure'), {
      name: 'XRPCError',
      error: 'InternalServerError',
      status: 500,
    });
    agentApi.getPostThread.mockRejectedValue(upstream);

    await expect(
      provider.autoPlugPost(integration, postUri, {
        likesAmount: '10',
        post: 'a follow-up offer',
      })
    ).rejects.toBe(upstream);

    const invalidRequest = Object.assign(new Error('Invalid Request'), {
      name: 'XRPCError',
      error: 'InvalidRequest',
      status: 400,
    });
    agentApi.getPostThread.mockRejectedValue(invalidRequest);

    await expect(
      provider.autoRepostPost(integration, postUri, { likesAmount: '10' })
    ).rejects.toBe(invalidRequest);
  });
});
