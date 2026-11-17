import dns from 'node:dns/promises';
import { isBlockedIp } from '@gitroom/nestjs-libraries/dtos/webhooks/webhook.url.validator';
import { getSsrfSafeDispatcher } from '@gitroom/nestjs-libraries/dtos/webhooks/ssrf.safe.dispatcher';

export const GTA6CLIPS_VIDEO_HOST = 'gta6clips.app';

export type HostDeps = {
  resolve: (hostname: string) => Promise<string[]>;
};

export type HostCheck = { ok: true; hostname: string } | { ok: false; reason: string };

export function partnerVideoHost(value: string) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return '';
  }
}

export function isPartnerVideoUrl(value: string | undefined | null) {
  if (!value || !value.startsWith('https://')) {
    return false;
  }
  return partnerVideoHost(value) === GTA6CLIPS_VIDEO_HOST;
}

export async function classifyPartnerUrl(value: string, deps: HostDeps): Promise<HostCheck> {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'https' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'https' };
  }
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '');
  if (hostname !== GTA6CLIPS_VIDEO_HOST) {
    return { ok: false, reason: 'host' };
  }
  let addresses: string[] = [];
  try {
    addresses = await deps.resolve(hostname);
  } catch {
    return { ok: false, reason: 'dns' };
  }
  if (!addresses.length || addresses.some((ip) => isBlockedIp(ip))) {
    return { ok: false, reason: 'address' };
  }
  return { ok: true, hostname };
}

export type FetchLike = (
  url: string,
  init: { method?: string; headers?: Record<string, string>; redirect: 'manual' }
) => Promise<{
  status: number;
  headers: { get(name: string): string | null };
  body?: unknown;
  cancel?: () => Promise<void>;
}>;

// One hop at a time. A redirect onto another host, http, or a private address stops.
export async function fetchAllowlisted(
  url: string,
  init: { method?: string; headers?: Record<string, string> },
  deps: HostDeps & { fetch: FetchLike; hops?: number }
): Promise<{ status: number; headers: { get(name: string): string | null }; body?: unknown }> {
  const hops = deps.hops ?? 0;
  if (hops > 3) {
    throw new Error('redirect');
  }
  const checked = await classifyPartnerUrl(url, deps);
  if (checked.ok === false) {
    throw new Error(checked.reason);
  }
  const response = await deps.fetch(url, {
    method: init.method,
    headers: init.headers,
    redirect: 'manual',
  });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location') || '';
    if (!location) {
      throw new Error('redirect');
    }
    const next = new URL(location, url).toString();
    if (response.cancel) {
      await response.cancel();
    }
    return fetchAllowlisted(next, init, { ...deps, hops: hops + 1 });
  }
  return response;
}

async function resolveHost(hostname: string) {
  const records = await dns.lookup(hostname, { all: true });
  return records.map((record) => record.address);
}

// Streams from the allowlisted host. The body is not written to storage.
export async function openPartnerVideo(
  url: string,
  init: { method?: string; headers?: Record<string, string> } = {}
) {
  let current = url;
  for (let hop = 0; hop < 4; hop += 1) {
    const checked = await classifyPartnerUrl(current, { resolve: resolveHost });
    if (checked.ok === false) {
      throw new Error(checked.reason);
    }
    const response = await fetch(current, {
      method: init.method,
      headers: init.headers,
      redirect: 'manual',
      // @ts-ignore undici dispatcher
      dispatcher: getSsrfSafeDispatcher(),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location') || '';
      await response.body?.cancel();
      if (!location) {
        throw new Error('redirect');
      }
      current = new URL(location, current).toString();
      continue;
    }
    return response;
  }
  throw new Error('redirect');
}
