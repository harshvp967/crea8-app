import { parse } from 'tldts';

export const CSRF_COOKIE = 'csrf';
export const CSRF_HEADER = 'x-csrf-token';
export const CSRF_REQUIRED_HEADER = 'x-csrf-required';

// SameSite is per registrable domain (eTLD+1), not per origin. app.crea8.one
// and api.crea8.one are one site. A Vercel host and a Railway host are not.
export function registrableDomain(value: string | undefined): string {
  const raw = (value || '').trim();
  if (!raw) {
    return '';
  }
  try {
    const parsed = parse(raw.includes('://') ? raw : `https://${raw}`);
    return (parsed.domain || parsed.hostname || '').toLowerCase();
  } catch {
    return '';
  }
}

export function frontendAndBackendShareSite(
  frontendUrl = process.env.FRONTEND_URL,
  backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL
): boolean {
  const front = registrableDomain(frontendUrl);
  const back = registrableDomain(backendUrl);
  if (!front || !back) {
    return false;
  }
  return front === back;
}

// Lax when the browser will send the cookie on first-party POSTs. None when
// the API is on another site, so the session still arrives, and CSRF is the
// token check rather than the cookie attribute.
export function authCookieSameSite(
  frontendUrl = process.env.FRONTEND_URL,
  backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL
): 'lax' | 'none' {
  return frontendAndBackendShareSite(frontendUrl, backendUrl) ? 'lax' : 'none';
}

export function securedCookieFlags(httpOnly = true) {
  if (process.env.NOT_SECURED) {
    return {};
  }
  return {
    secure: true as const,
    httpOnly,
    sameSite: authCookieSameSite(),
  };
}
