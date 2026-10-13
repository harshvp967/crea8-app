import type { MetadataRoute } from 'next';

function siteOrigin() {
  return (process.env.FRONTEND_URL || 'http://localhost:4200').replace(
    /\/+$/,
    ''
  );
}

const PUBLIC_PATHS = ['/privacy', '/terms', '/data-deletion'];

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  return PUBLIC_PATHS.map((path) => ({
    url: `${origin}${path}`,
    lastModified: new Date('2026-10-10'),
  }));
}
