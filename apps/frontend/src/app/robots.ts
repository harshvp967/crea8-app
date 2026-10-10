import type { MetadataRoute } from 'next';

function siteOrigin() {
  return (process.env.FRONTEND_URL || 'http://localhost:4200').replace(
    /\/+$/,
    ''
  );
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/p/', '/privacy', '/terms', '/data-deletion'],
      disallow: ['/'],
    },
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
