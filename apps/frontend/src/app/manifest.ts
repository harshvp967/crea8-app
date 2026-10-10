import type { MetadataRoute } from 'next';
import { SITE_DESCRIPTION, SITE_NAME } from '@gitroom/frontend/components/layout/site.metadata';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: '#0E0E0E',
    theme_color: '#0E0E0E',
    icons: [
      {
        src: '/crea8one-favicon-32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/crea8one-apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/crea8one-logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
