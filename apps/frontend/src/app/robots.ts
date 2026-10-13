import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import {
  isAppHostNoindex,
  publicSiteOrigin,
} from '@gitroom/frontend/components/layout/site.metadata';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headerList = await headers();
  const host =
    headerList.get('x-forwarded-host') || headerList.get('host') || '';
  if (isAppHostNoindex(host)) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
    };
  }

  return {
    rules: {
      userAgent: '*',
      allow: ['/p/', '/privacy', '/terms', '/data-deletion'],
      disallow: ['/'],
    },
    sitemap: `${publicSiteOrigin()}/sitemap.xml`,
  };
}
