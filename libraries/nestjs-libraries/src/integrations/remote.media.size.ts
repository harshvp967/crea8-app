import { getSsrfSafeDispatcher } from '@gitroom/nestjs-libraries/dtos/webhooks/ssrf.safe.dispatcher';

export type RemoteMediaInfo = { size: number; contentType: string };

type FetchLike = (url: string, init: any) => Promise<Response>;

const defaultFetch: FetchLike = (url, init) =>
  fetch(url, { ...init, dispatcher: getSsrfSafeDispatcher() } as any);

function positive(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

// "bytes 0-0/95329971" -> 95329971. "bytes */123" (416) also carries the total.
export function totalFromContentRange(header: string | null) {
  const match = /\/(\d+)\s*$/.exec(header || '');
  return match ? positive(Number(match[1])) : 0;
}

// Size and type of a remote file without downloading it.
//
// Private R2 media reaches providers as a URL presigned for GetObject. SigV4
// signs the HTTP method, so a HEAD on that URL is refused with 403, and the
// 403 body still has its own content-length. A one-byte ranged GET is signed
// the same way as the real download, so it is the fallback.
export async function remoteMediaInfo(
  url: string,
  doFetch: FetchLike = defaultFetch
): Promise<RemoteMediaInfo | null> {
  try {
    const head = await doFetch(url, {
      method: 'HEAD',
      headers: { 'accept-encoding': 'identity' },
    });
    await head.body?.cancel();
    const size = positive(Number(head.headers.get('content-length')));
    if (head.ok && size) {
      return {
        size,
        contentType:
          head.headers.get('content-type') || 'application/octet-stream',
      };
    }
  } catch {
    // fall through to the ranged GET
  }

  const ranged = await doFetch(url, {
    headers: { Range: 'bytes=0-0', 'accept-encoding': 'identity' },
  });
  await ranged.body?.cancel();
  const contentType =
    ranged.headers.get('content-type') || 'application/octet-stream';
  if (ranged.status === 206) {
    const size = totalFromContentRange(ranged.headers.get('content-range'));
    return size ? { size, contentType } : null;
  }
  // A server that ignores Range answers 200 with the whole file's length.
  if (ranged.status === 200) {
    const size = positive(Number(ranged.headers.get('content-length')));
    return size ? { size, contentType } : null;
  }
  return null;
}
