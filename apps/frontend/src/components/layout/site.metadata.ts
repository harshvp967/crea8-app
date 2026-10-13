import type { Metadata } from 'next';

export const SITE_NAME = 'Crea8one';
export const SITE_DESCRIPTION =
  'Plan, publish and learn from your audience, in one place.';
export const SITE_IMAGE = '/crea8one-logo.png';

const PUBLIC_SITE_ORIGIN = 'https://crea8.one';

export function publicSiteOrigin() {
  const raw = (process.env.FRONTEND_URL || '').trim().replace(/\/+$/, '');
  if (!raw) {
    return PUBLIC_SITE_ORIGIN;
  }
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === 'app.crea8.one'
    ) {
      return PUBLIC_SITE_ORIGIN;
    }
    return url.origin;
  } catch {
    return PUBLIC_SITE_ORIGIN;
  }
}

export function isAppHostNoindex(hostHeader: string) {
  const host = hostHeader.split(',')[0].trim().split(':')[0].toLowerCase();
  return host === 'app.crea8.one';
}

function metadataBase() {
  const value = (process.env.FRONTEND_URL || '').trim();
  if (!value) {
    return undefined;
  }
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function socialMetadata(): Pick<Metadata, 'openGraph' | 'twitter' | 'metadataBase'> {
  return {
    metadataBase: metadataBase(),
    openGraph: {
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      siteName: SITE_NAME,
      type: 'website',
      images: [{ url: SITE_IMAGE, alt: SITE_NAME }],
    },
    twitter: {
      card: 'summary_large_image',
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      images: [SITE_IMAGE],
    },
  };
}

export function appPageMetadata(): Metadata {
  return {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    robots: {
      index: false,
      follow: false,
    },
    ...socialMetadata(),
  };
}

export function publicPageMetadata(): Metadata {
  return {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    robots: {
      index: true,
      follow: true,
    },
    ...socialMetadata(),
  };
}
