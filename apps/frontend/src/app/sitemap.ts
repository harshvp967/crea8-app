import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import {
  isAppHostNoindex,
  publicSiteOrigin,
} from '@gitroom/frontend/components/layout/site.metadata';

const PUBLIC_PATHS = ['/privacy', '/terms', '/data-deletion'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headerList = await headers();
  const host =
    headerList.get('x-forwarded-host') || headerList.get('host') || '';
  if (isAppHostNoindex(host)) {
    return [];
  }

  const origin = publicSiteOrigin();
  return PUBLIC_PATHS.map((path) => ({
    url: `${origin}${path}`,
    lastModified: new Date('2026-10-10'),
  }));
}
