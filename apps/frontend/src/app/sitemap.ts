import type { MetadataRoute } from 'next';
import { publicSiteOrigin } from '@gitroom/frontend/components/layout/site.origin';

const PUBLIC_PATHS = ['/privacy', '/terms', '/data-deletion'];

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = publicSiteOrigin();
  return PUBLIC_PATHS.map((path) => ({
    url: `${origin}${path}`,
    lastModified: new Date('2026-10-10'),
  }));
}
