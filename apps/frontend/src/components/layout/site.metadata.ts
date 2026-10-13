import type { Metadata } from 'next';

export const SITE_NAME = 'Crea8one';
export const SITE_DESCRIPTION =
  'Plan, publish and learn from your audience, in one place.';
export const SITE_IMAGE = '/crea8one-logo.png';

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
