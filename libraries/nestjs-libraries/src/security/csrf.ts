import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import {
  authCookieSameSite,
  CSRF_COOKIE,
  CSRF_HEADER,
  CSRF_REQUIRED_HEADER,
  frontendAndBackendShareSite,
} from '@gitroom/helpers/auth/cookie.policy';
import { getCookieUrlFromDomain } from '@gitroom/helpers/subdomain/subdomain.management';

export { CSRF_COOKIE, CSRF_HEADER, CSRF_REQUIRED_HEADER };

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Cookie session is not the authenticator on these. API keys, MCP bearer
// tokens, and inbound payment webhooks must keep working without a browser token.
const EXEMPT_PREFIXES = [
  '/public',
  '/mcp',
  '/mcp-oauth',
  '/sse',
  '/message',
  '/stripe',
  '/payment',
  '/monitor',
  '/.well-known',
];

export function createCsrfToken() {
  return randomBytes(32).toString('hex');
}

export function requestPath(url: string | undefined) {
  const raw = (url || '').split('?')[0];
  if (!raw) {
    return '/';
  }
  return raw.startsWith('/') ? raw : `/${raw}`;
}

export function csrfExemptPath(url: string | undefined) {
  const path = requestPath(url);
  return EXEMPT_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

export function unsafeMethod(method: string | undefined) {
  return UNSAFE.has((method || 'GET').toUpperCase());
}

function originOf(value: string) {
  const raw = (value || '').trim();
  if (!raw) {
    return '';
  }
  try {
    return new URL(raw).origin.toLowerCase();
  } catch {
    return '';
  }
}

export function allowedRequestOrigins(
  frontendUrl = process.env.FRONTEND_URL,
  mainUrl = process.env.MAIN_URL,
  backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL
) {
  const origins = new Set<string>();
  const extra = (process.env.EXTRA_CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  for (const value of [frontendUrl, mainUrl, backendUrl, ...extra]) {
    const origin = originOf(value || '');
    if (origin) {
      origins.add(origin);
    }
  }
  return origins;
}

export function originOnAllowlist(
  originOrReferer: string | undefined,
  allowlist = allowedRequestOrigins()
) {
  const origin = originOf(originOrReferer || '');
  if (!origin) {
    return false;
  }
  return allowlist.has(origin);
}

function tokensMatch(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length || a.length < 32) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export function headerToken(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw || '').trim();
}

export type CsrfRequest = {
  method?: string;
  originalUrl?: string;
  url?: string;
  path?: string;
  headers: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string | undefined>;
};

// Null means the request may proceed. A string is the reason it must not.
export function csrfProblem(req: CsrfRequest): string | null {
  if (!unsafeMethod(req.method)) {
    return null;
  }
  const path = req.originalUrl || req.url || req.path;
  if (csrfExemptPath(path)) {
    return null;
  }
  // No session cookie: API-key, bearer, and server-side header auth.
  if (!req.cookies?.auth) {
    return null;
  }
  const origin = headerToken(req.headers.origin);
  const referer = headerToken(req.headers.referer || req.headers.referrer);
  if (!origin && !referer) {
    return 'origin';
  }
  if (origin && !originOnAllowlist(origin)) {
    return 'origin';
  }
  if (!origin && referer && !originOnAllowlist(referer)) {
    return 'origin';
  }
  const cookie = (req.cookies?.[CSRF_COOKIE] || '').trim();
  const sent = headerToken(req.headers[CSRF_HEADER]);
  if (!cookie || !sent || !tokensMatch(cookie, sent)) {
    return 'token';
  }
  return null;
}

export function csrfCookieOptions() {
  const shared = frontendAndBackendShareSite();
  const base = process.env.NOT_SECURED
    ? {}
    : {
        secure: true as const,
        sameSite: authCookieSameSite(),
      };
  return {
    ...base,
    httpOnly: false,
    path: '/',
    ...(shared && process.env.FRONTEND_URL
      ? { domain: getCookieUrlFromDomain(process.env.FRONTEND_URL) }
      : {}),
  };
}

// Bound the timestamp into the MAC the same way a receiver must, so a captured
// body cannot be replayed with a fresh timestamp.
export function signedWebhookPayload(timestamp: string, body: string) {
  return `${timestamp}.${body}`;
}

export function hmacSha256Hex(secret: string, value: string) {
  return createHmac('sha256', secret).update(value).digest('hex');
}

// Issues the double-submit cookie and blocks cookie-authenticated mutations
// whose Origin is off the allowlist or whose header does not match the cookie.
export function csrfGuard(req: any, res: any, next: () => void) {
  const existing = (req.cookies?.[CSRF_COOKIE] || '').trim();
  const token = existing.length >= 64 ? existing : createCsrfToken();
  if (token !== existing) {
    res.cookie(CSRF_COOKIE, token, csrfCookieOptions());
  }
  res.setHeader(CSRF_HEADER, token);
  if (csrfProblem(req)) {
    res.setHeader(CSRF_REQUIRED_HEADER, '1');
    res.status(403).json({ message: 'CSRF token missing or invalid' });
    return;
  }
  next();
}
