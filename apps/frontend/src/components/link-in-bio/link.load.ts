import type { PublicLink } from '@gitroom/frontend/components/link-in-bio/link.api';

export async function loadPublicLink(path: string, revalidate?: number): Promise<PublicLink | null> {
  const base = (process.env.BACKEND_INTERNAL_URL || '').replace(/\/$/, '');
  if (!base) {
    return null;
  }
  try {
    const response = await fetch(`${base}${path}`, revalidate ? { next: { revalidate } } : { cache: 'no-store' });
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
  const initial = gated ? { ...page, blocks: [], capture: null } : page;
  return { gated, initial };
}
