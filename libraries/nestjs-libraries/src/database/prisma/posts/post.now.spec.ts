import { readFileSync } from 'fs';
import { join } from 'path';
import {
  editorLoadedPost,
  postErrorWrite,
  postFailureReason,
  postNowShouldFailNow,
  publishedPostWrite,
} from '@gitroom/nestjs-libraries/database/prisma/posts/post.failure';

const root = join(__dirname, '../../../../../../');

function providerFailure(message: string) {
  return Object.assign(new Error('Activity task failed'), {
    cause: Object.assign(new Error(message), {
      type: 'refresh_token',
      details: [
        {
          identifier: 'bluesky',
          json: JSON.stringify({ message, error: 'ExpiredToken', status: 401 }),
        },
      ],
    }),
  });
}

describe('post now failure', () => {
  const reason = 'Token has expired';
  const failure = providerFailure(reason);

  it('stores the provider reason instead of a stringified activity error', () => {
    expect(JSON.stringify(new Error(reason))).toBe('{}');
    expect(JSON.stringify(failure)).not.toBe(reason);
    expect(postFailureReason(failure)).toBe(reason);
    expect(postErrorWrite('ERROR', failure)).toEqual({
      state: 'ERROR',
      error: reason,
    });
  });

  it('puts that reason on the post the preview and editor load', () => {
    const stored = postErrorWrite('ERROR', failure);
    const loaded = editorLoadedPost({
      id: 'post-1',
      content: 'hello',
      ...stored,
      integration: {
        id: 'channel-1',
        name: 'Bluesky',
        picture: null,
        providerIdentifier: 'bluesky',
        profile: 'creator.bsky.social',
        token: 'access-token',
        refreshToken: 'refresh-token',
      },
    });

    expect(loaded.state).toBe('ERROR');
    expect(loaded.error).toBe(reason);
    expect(loaded.integration).toEqual({
      id: 'channel-1',
      name: 'Bluesky',
      picture: null,
      providerIdentifier: 'bluesky',
      profile: 'creator.bsky.social',
    });
    expect(loaded.integration).not.toHaveProperty('token');
  });

  it('does not leave a successful post now Scheduled', () => {
    const published = publishedPostWrite(
      'at://did:plc:example/app.bsky.feed.post/abc',
      'https://bsky.app/profile/creator.bsky.social/post/abc'
    );

    expect(published.state).toBe('PUBLISHED');
    expect(published.state).not.toBe('QUEUE');
  });

  it('fails post now on the first terminal error and allows one token refresh', () => {
    expect(postNowShouldFailNow('unknown', false, false)).toBe(true);
    expect(postNowShouldFailNow('stop', false, false)).toBe(true);
    expect(postNowShouldFailNow('bad-body', false, false)).toBe(true);
    expect(postNowShouldFailNow('timeout', false, false)).toBe(true);
    expect(postNowShouldFailNow('retry', false, false)).toBe(true);
    expect(postNowShouldFailNow('retry', true, false)).toBe(false);
    expect(postNowShouldFailNow('retry', true, true)).toBe(true);
  });

  it('keeps the in-flight v1.1.3 workflow and starts new posts on v1.1.4', () => {
    const previous = readFileSync(
      join(root, 'apps/orchestrator/src/workflows/post-workflows/post.workflow.v1.1.3.ts'),
      'utf8'
    );
    const next = readFileSync(
      join(root, 'apps/orchestrator/src/workflows/post-workflows/post.workflow.v1.1.4.ts'),
      'utf8'
    );
    const starter = readFileSync(
      join(root, 'libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts'),
      'utf8'
    );

    expect(previous).toContain('export async function postWorkflowV113');
    expect(previous).toContain("return { type: 'unknown', message: '' }");
    expect(previous).not.toContain('postNowShouldFailNow');
    expect(next).toContain('export async function postWorkflowV114');
    expect(next).toContain('postNowShouldFailNow');
    expect(next).toContain('postFailureReason');
    expect(starter).toContain("workflow.start('postWorkflowV114'");
    expect(starter).toContain("body.type === 'now'");
  });

  it('returns post.error on the calendar query the tooltip already reads', () => {
    const repository = readFileSync(
      join(root, 'libraries/nestjs-libraries/src/database/prisma/posts/posts.repository.ts'),
      'utf8'
    );
    const calendarQuery = repository.slice(
      repository.indexOf('async getPosts('),
      repository.indexOf('async getPostsList(')
    );
    const previous = readFileSync(
      join(root, 'apps/orchestrator/src/workflows/post-workflows/post.workflow.v1.1.3.ts'),
      'utf8'
    );

    expect(calendarQuery).toContain('error: true');
    expect(previous).toContain('export async function postWorkflowV113');
    expect(previous).not.toContain('postNowShouldFailNow');
  });
});
