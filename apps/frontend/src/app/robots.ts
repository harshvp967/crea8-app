import type { MetadataRoute } from 'next';
import { publicSiteOrigin } from '@gitroom/frontend/components/layout/site.origin';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/p/', '/privacy', '/terms', '/data-deletion'],
      disallow: ['/'],
    },
    sitemap: `${publicSiteOrigin()}/sitemap.xml`,
  };
}
