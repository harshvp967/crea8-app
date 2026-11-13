import type { MetadataRoute } from 'next';
import { siteStealth } from '@gitroom/frontend/components/layout/site.metadata';
import { publicSiteOrigin } from '@gitroom/frontend/components/layout/site.origin';

export const dynamic = 'force-dynamic';

const LEGAL = ['/privacy', '/terms', '/data-deletion', '/refund-policy'];
const OPEN = [...LEGAL, '/pricing'];

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = siteStealth() ? LEGAL : OPEN;
  return paths.map((path) => ({
    url: `${publicSiteOrigin()}${path}`,
    lastModified: new Date('2026-10-10'),
  }));
}
