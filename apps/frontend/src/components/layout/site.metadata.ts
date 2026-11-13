import type { Metadata } from 'next';

export const SITE_NAME = 'crea8.one';
export const MARKETING_ORIGIN = 'https://crea8.one';
export const SITE_DESCRIPTION =
  'Plan, publish and learn from your audience, in one place.';
export const SITE_IMAGE = '/crea8one-logo.png';

// Unset means on. One flag turns indexing, the sitemap, llms.txt, and
// descriptive titles back on together.
export function siteStealth() {
  return (process.env.SITE_STEALTH ?? 'true').trim().toLowerCase() !== 'false';
}

/** Browser tab title. The page name comes first, then the brand. */
export function documentTitle(label: string) {
  return `${label} · ${SITE_NAME}`;
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
  if (siteStealth()) {
    return {
      title: { default: SITE_NAME, template: SITE_NAME },
      robots: { index: false, follow: false },
    };
  }
  return {
    title: {
      default: SITE_NAME,
      template: `%s · ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    robots: {
      index: false,
      follow: false,
    },
    ...socialMetadata(),
  };
}

export function publicPageMetadata(): Metadata {
  if (siteStealth()) {
    return {
      title: { default: SITE_NAME, template: '%s' },
      robots: { index: false, follow: false },
    };
  }
  return {
    title: {
      default: SITE_NAME,
      template: `%s · ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    robots: {
      index: true,
      follow: true,
    },
    ...socialMetadata(),
  };
}

const STEALTH_INDEX = new Set(['/privacy', '/terms', '/data-deletion', '/refund-policy']);

export function legalPageMetadata(label: string, path: string): Metadata {
  const canonical = `${MARKETING_ORIGIN}${path}`;
  const title = `${label} — ${SITE_NAME}`;
  const stealth = siteStealth();
  const index = stealth ? STEALTH_INDEX.has(path) : true;
  return {
    title: { absolute: title },
    ...(stealth ? {} : { description: `${label} for ${SITE_NAME}.` }),
    robots: index ? { index: true, follow: true } : { index: false, follow: false },
    alternates: { canonical },
    ...(stealth
      ? {}
      : {
          openGraph: {
            title,
            description: `${label} for ${SITE_NAME}.`,
            url: canonical,
            siteName: SITE_NAME,
          },
        }),
  };
}
