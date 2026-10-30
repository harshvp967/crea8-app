import { authCookieSameSite } from '@gitroom/helpers/auth/cookie.policy';
import { getCookieUrlFromDomain } from '@gitroom/helpers/subdomain/subdomain.management';

// Browsers delete a cookie only when the name, Domain, and Path match the
// one that was stored. Login uses Path=/. Sessions on app.crea8.one have
// also been stored host-only (no Domain) and on the parent domain.
export const SESSION_COOKIE_NAMES = ['auth', 'showorg', 'impersonate'] as const;
export const CREA8_PARENT_COOKIE_DOMAIN = '.crea8.one';

export type SessionCookieName = (typeof SESSION_COOKIE_NAMES)[number];

export type ExpiredSessionCookie = {
  name: SessionCookieName;
  value: '';
  path: '/';
  domain?: string;
  maxAge: 0;
  expires: Date;
  secure?: true;
  httpOnly?: true;
  sameSite?: 'lax' | 'none';
};

export function sessionCookieOptions(
  expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365)
) {
  return {
    path: '/' as const,
    domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
    expires,
    ...(!process.env.NOT_SECURED
      ? {
          secure: true as const,
          httpOnly: true as const,
          sameSite: authCookieSameSite(),
        }
      : {}),
  };
}

export function sessionClearDomains(frontendUrl = process.env.FRONTEND_URL) {
  const domains: Array<string | undefined> = [undefined, CREA8_PARENT_COOKIE_DOMAIN];
  const fromFrontend = cookieDomain(frontendUrl);
  if (
    fromFrontend &&
    fromFrontend.toLowerCase() !== CREA8_PARENT_COOKIE_DOMAIN.toLowerCase()
  ) {
    domains.push(fromFrontend);
  }
  return domains;
}

export function expiredSessionCookies(
  frontendUrl = process.env.FRONTEND_URL
): ExpiredSessionCookie[] {
  const flags = process.env.NOT_SECURED
    ? {}
    : {
        secure: true as const,
        httpOnly: true as const,
        sameSite: authCookieSameSite(),
      };
  const expires = new Date(0);
  const cookies: ExpiredSessionCookie[] = [];
  for (const name of SESSION_COOKIE_NAMES) {
    for (const domain of sessionClearDomains(frontendUrl)) {
      cookies.push({
        name,
        value: '',
        path: '/',
        ...(domain ? { domain } : {}),
        maxAge: 0,
        expires,
        ...flags,
      });
    }
  }
  return cookies;
}

export function serializeExpiredSessionCookie(cookie: ExpiredSessionCookie) {
  const parts = [
    `${cookie.name}=`,
    `Path=${cookie.path}`,
    `Max-Age=${cookie.maxAge}`,
    `Expires=${cookie.expires.toUTCString()}`,
  ];
  if (cookie.domain) {
    parts.push(`Domain=${cookie.domain}`);
  }
  if (cookie.secure) {
    parts.push('Secure');
  }
  if (cookie.httpOnly) {
    parts.push('HttpOnly');
  }
  if (cookie.sameSite) {
    parts.push(`SameSite=${cookie.sameSite === 'none' ? 'None' : 'Lax'}`);
  }
  return parts.join('; ');
}

export function clearSessionCookies(response: {
  append: (field: string, value: string) => void;
}) {
  for (const cookie of expiredSessionCookies()) {
    response.append('Set-Cookie', serializeExpiredSessionCookie(cookie));
  }
}

export function logoutLoginUrl(currentHref: string) {
  return new URL('/auth/login', currentHref).href;
}

function cookieDomain(frontendUrl: string | undefined) {
  const raw = (frontendUrl || '').trim();
  if (!raw) {
    return '';
  }
  try {
    return getCookieUrlFromDomain(raw) || '';
  } catch {
    return '';
  }
}
