export const PRODUCTION_SITE_ORIGIN = 'https://app.crea8.one';

function configuredOrigin() {
  return (process.env.FRONTEND_URL || '').trim().replace(/\/+$/, '');
}

function isLocalOrigin(value: string) {
  if (!value) {
    return true;
  }
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0';
  } catch {
    return /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(value);
  }
}

// Production must not advertise a localhost FRONTEND_URL. A real origin is kept.
export function publicSiteOrigin() {
  const configured = configuredOrigin();
  if (process.env.NODE_ENV === 'production' && isLocalOrigin(configured)) {
    return PRODUCTION_SITE_ORIGIN;
  }
  return configured || 'http://localhost:4200';
}
