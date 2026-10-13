import type { PublicLink } from '@gitroom/frontend/components/link-in-bio/link.api';

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
