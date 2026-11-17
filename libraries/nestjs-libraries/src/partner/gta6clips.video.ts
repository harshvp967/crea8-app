import { GTA6CLIPS_VIDEO_GRACE_DAYS } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';

// Same cap as getMaxSize('video/mp4') in custom.upload.validation.ts.
const MAX_PARTNER_VIDEO_BYTES = 1024 * 1024 * 1024;
import {
  classifyPartnerUrl,
  fetchAllowlisted,
  FetchLike,
  HostDeps,
  isPartnerVideoUrl,
} from '@gitroom/nestjs-libraries/partner/gta6clips.host';

export const PARTNER_VIDEO_GRACE_MS = GTA6CLIPS_VIDEO_GRACE_DAYS * 24 * 60 * 60 * 1000;

export type VideoFailure = 'expired' | 'missing' | 'non-video' | 'too-large' | 'redirect' | 'address';

function unixMs(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n < 10_000_000_000 ? n * 1000 : n;
}

function awsExpiry(params: URLSearchParams) {
  const date = params.get('X-Amz-Date') || '';
  const seconds = Number(params.get('X-Amz-Expires'));
  if (!/^\d{8}T\d{6}Z$/.test(date) || !Number.isFinite(seconds)) {
    return null;
  }
  const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${date.slice(9, 11)}:${date.slice(11, 13)}:${date.slice(13, 15)}Z`;
  const start = Date.parse(iso);
  if (!Number.isFinite(start)) {
    return null;
  }
  return start + seconds * 1000;
}

function jwtExpiry(token: string) {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }
  try {
    const json = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { exp?: unknown };
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

// The login JWT is 10 minutes. The video URL is a separate signature and has
// to outlive the scheduled time by a week so a late publish can still read it.
export function signedUrlExpiry(url: string): number | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const params = parsed.searchParams;
  const direct =
    unixMs(params.get('exp') || '') ||
    unixMs(params.get('expires') || '') ||
    unixMs(params.get('Expires') || '');
  if (direct) {
    return direct;
  }
  const aws = awsExpiry(params);
  if (aws) {
    return aws;
  }
  for (const key of ['token', 'sig', 'signature']) {
    const raw = params.get(key) || '';
    const exp = raw ? jwtExpiry(raw) : null;
    if (exp) {
      return exp;
    }
  }
  return null;
}

export function videoCoversSchedule(url: string, publishAt: Date | string) {
  if (!isPartnerVideoUrl(url)) {
    return false;
  }
  const exp = signedUrlExpiry(url);
  const at = publishAt instanceof Date ? publishAt.getTime() : Date.parse(publishAt);
  if (exp == null || !Number.isFinite(at)) {
    return false;
  }
  return exp >= at + PARTNER_VIDEO_GRACE_MS;
}

export function partnerVideoPaths(images: unknown): string[] {
  if (!Array.isArray(images)) {
    return [];
  }
  return images.flatMap((item) => {
    const path = item && typeof item === 'object' ? (item as { path?: unknown }).path : '';
    return typeof path === 'string' && isPartnerVideoUrl(path) ? [path] : [];
  });
}

export function assertVideosCoverSchedule(images: unknown, publishAt: Date | string) {
  for (const url of partnerVideoPaths(images)) {
    if (!videoCoversSchedule(url, publishAt)) {
      return { ok: false as const, reason: 'window' as const };
    }
  }
  return { ok: true as const };
}

export function classifyFetch(
  status: number,
  contentType: string,
  bytes: number
): VideoFailure | null {
  if (status === 404 || status === 410 || status === 401 || status === 403 || status >= 400) {
    return status === 404 ? 'missing' : 'expired';
  }
  const type = contentType.split(';')[0].trim().toLowerCase();
  if (type !== 'video/mp4') {
    return 'non-video';
  }
  if (Number.isFinite(bytes) && bytes > MAX_PARTNER_VIDEO_BYTES) {
    return 'too-large';
  }
  return null;
}

export function partnerFailureMessage(reason: VideoFailure | 'window' | 'redirect' | 'address') {
  if (reason === 'non-video') {
    return 'The video link is not a video.';
  }
  if (reason === 'too-large') {
    return 'The video is too large.';
  }
  if (reason === 'window') {
    return 'The video link expires before the scheduled time.';
  }
  return 'The video link is no longer available.';
}

export async function inspectPartnerVideo(
  url: string,
  deps: HostDeps & { fetch: FetchLike }
) {
  const host = await classifyPartnerUrl(url, deps);
  if (host.ok === false) {
    return { ok: false as const, reason: host.reason === 'address' ? 'address' as const : 'redirect' as const };
  }
  let response: { status: number; headers: { get(name: string): string | null }; cancel?: () => Promise<void> };
  try {
    response = await fetchAllowlisted(
      url,
      { method: 'HEAD', headers: { 'accept-encoding': 'identity' } },
      deps
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message === 'address') {
      return { ok: false as const, reason: 'address' as const };
    }
    return { ok: false as const, reason: 'redirect' as const };
  }
  if (response.status === 405) {
    try {
      response = await fetchAllowlisted(
        url,
        { method: 'GET', headers: { 'accept-encoding': 'identity', range: 'bytes=0-0' } },
        deps
      );
    } catch {
      return { ok: false as const, reason: 'expired' as const };
    }
  }
  const failure = classifyFetch(
    response.status,
    response.headers.get('content-type') || '',
    Number(response.headers.get('content-length'))
  );
  if (response.cancel) {
    await response.cancel();
  }
  if (failure) {
    return { ok: false as const, reason: failure };
  }
  return { ok: true as const };
}
