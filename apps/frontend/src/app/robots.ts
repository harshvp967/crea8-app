import type { MetadataRoute } from 'next';
import { publicSiteOrigin } from '@gitroom/frontend/components/layout/site.origin';
import { siteStealth } from '@gitroom/frontend/components/layout/site.metadata';

export const dynamic = 'force-dynamic';

const LEGAL = ['/privacy', '/terms', '/data-deletion', '/refund-policy'];

export default function robots(): MetadataRoute.Robots {
  const stealth = siteStealth();
  return {
    rules: {
      userAgent: '*',
      allow: stealth ? LEGAL : ['/p/', ...LEGAL, '/pricing'],
      disallow: ['/'],
    },
    sitemap: `${publicSiteOrigin()}/sitemap.xml`,
  };
}
