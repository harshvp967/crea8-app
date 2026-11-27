import {
  remoteMediaInfo,
  totalFromContentRange,
} from '@gitroom/nestjs-libraries/integrations/remote.media.size';

const url =
  'https://bucket.account.r2.cloudflarestorage.com/video.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc';

function reply(status: number, headers: Record<string, string>) {
  return new Response(status === 204 ? null : 'x', { status, headers });
}

describe('remoteMediaInfo', () => {
  it('uses HEAD when the server answers it', async () => {
    const calls: any[] = [];
    const info = await remoteMediaInfo(url, async (_u, init) => {
      calls.push(init);
      return reply(200, { 'content-length': '1234', 'content-type': 'video/mp4' });
    });
    expect(info).toEqual({ size: 1234, contentType: 'video/mp4' });
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('HEAD');
  });

  it('falls back to a ranged GET when a presigned GET URL refuses HEAD', async () => {
    const calls: any[] = [];
    const info = await remoteMediaInfo(url, async (_u, init) => {
      calls.push(init);
      if (init.method === 'HEAD') {
        // R2 403 body has its own length; it must not be read as the size.
        return reply(403, { 'content-length': '231', 'content-type': 'text/plain' });
      }
      return reply(206, {
        'content-range': 'bytes 0-0/95329971',
        'content-length': '1',
        'content-type': 'video/mp4',
      });
    });
    expect(info).toEqual({ size: 95329971, contentType: 'video/mp4' });
    expect(calls[1].headers.Range).toBe('bytes=0-0');
  });

  it('accepts a 200 from a server that ignores Range', async () => {
    const info = await remoteMediaInfo(url, async (_u, init) =>
      init.method === 'HEAD'
        ? reply(405, {})
        : reply(200, { 'content-length': '500', 'content-type': 'image/png' })
    );
    expect(info).toEqual({ size: 500, contentType: 'image/png' });
  });

  it('returns null when neither request gives a size', async () => {
    const info = await remoteMediaInfo(url, async () => reply(403, { 'content-length': '231' }));
    expect(info).toBeNull();
  });

  it('falls back when HEAD throws', async () => {
    const info = await remoteMediaInfo(url, async (_u, init) => {
      if (init.method === 'HEAD') throw new Error('socket hang up');
      return reply(206, { 'content-range': 'bytes 0-0/42' });
    });
    expect(info?.size).toBe(42);
  });
});

describe('totalFromContentRange', () => {
  it('reads the total', () => {
    expect(totalFromContentRange('bytes 0-0/95329971')).toBe(95329971);
    expect(totalFromContentRange('bytes */123')).toBe(123);
    expect(totalFromContentRange('bytes 0-0/*')).toBe(0);
    expect(totalFromContentRange(null)).toBe(0);
  });
});
