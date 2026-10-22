import type { PublicLink } from '@gitroom/frontend/components/link-in-bio/link.api';

// Files in /public are not rewritten by Next assetPrefix. Bios on crea8.one
// and custom domains still request them from the app, which is where they live.
const APP_ICON_ORIGIN = 'https://app.crea8.one';

const SOCIAL_ICON: Record<string, string> = {
  instagram: '/icons/platforms/instagram.png',
  x: '/icons/platforms/x.png',
  youtube: '/icons/platforms/youtube.png',
  linkedin: '/icons/platforms/linkedin.png',
  tiktok: '/icons/platforms/tiktok.png',
  threads: '/icons/platforms/threads.png',
  facebook: '/icons/platforms/facebook.png',
  bluesky: '/icons/platforms/bluesky.png',
  twitch: '/icons/platforms/twitch.png',
  pinterest: '/icons/platforms/pinterest.png',
  reddit: '/icons/platforms/reddit.png',
};

export function publicIconSrc(
  path: string,
  env: { nodeEnv?: string; assetPrefix?: string } = {}
) {
  if (!path.startsWith('/')) {
    return path;
  }
  const prefix = (env.assetPrefix ?? process.env.NEXT_PUBLIC_ASSET_PREFIX ?? '').trim().replace(/\/$/, '');
  if (prefix) {
    return `${prefix}${path}`;
  }
  if ((env.nodeEnv ?? process.env.NODE_ENV) !== 'production') {
    return path;
  }
  return `${APP_ICON_ORIGIN}${path}`;
}

export function publicSocialIconSrc(network: string, env: { nodeEnv?: string; assetPrefix?: string } = {}) {
  const path = SOCIAL_ICON[network];
  return path ? publicIconSrc(path, env) : '';
}

export function publicLinkCacheSeconds() {
  if (process.env.PUBLIC_LINK_CACHE_SECONDS === '0') {
    return 0;
  }
  const value = Number(process.env.PUBLIC_LINK_CACHE_SECONDS || 60);
  if (!Number.isFinite(value) || value < 0) {
    return 60;
  }
  return Math.min(Math.floor(value), 3600);
}

export async function loadPublicLink(path: string, revalidate = publicLinkCacheSeconds()): Promise<PublicLink | null> {
  const base = (process.env.BACKEND_INTERNAL_URL || '').replace(/\/$/, '');
  if (!base) {
    return null;
  }
  try {
    const init = (
      revalidate > 0 ? { next: { revalidate, tags: ['public-link'] } } : { cache: 'no-store' }
    ) as RequestInit;
    const response = await fetch(`${base}${path}`, init);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    if (!data?.slug) {
      return null;
    }
    return data as PublicLink;
  } catch {
    return null;
  }
}

export function presentPublicLink(page: PublicLink) {
  const gated = page.sensitive && page.isPublic;
  const initial = gated ? { ...page, blocks: [], capture: null, redirectUrl: '' } : page;
  return { gated, initial };
}

export function visitorSearch(head: { get(name: string): string | null }) {
  const params = new URLSearchParams();
  const country = head.get('x-vercel-ip-country') || head.get('cf-ipcountry') || '';
  const language = (head.get('accept-language') || '').split(',')[0]?.trim() || '';
  const referrer = head.get('referer') || '';
  if (country) {
    params.set('country', country);
  }
  if (language) {
    params.set('language', language.slice(0, 35));
  }
  if (referrer) {
    params.set('referrer', referrer.slice(0, 300));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}
