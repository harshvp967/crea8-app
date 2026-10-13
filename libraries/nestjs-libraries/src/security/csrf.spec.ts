import { authCookieSameSite, frontendAndBackendShareSite } from '@gitroom/helpers/auth/cookie.policy';
import {
  csrfExemptPath,
  csrfProblem,
  createCsrfToken,
  originOnAllowlist,
} from '@gitroom/nestjs-libraries/security/csrf';

const token = createCsrfToken();

function request(overrides: Record<string, unknown> = {}) {
  return {
    method: 'POST',
    originalUrl: '/posts',
    headers: {
      origin: 'https://app.example.com',
      'x-csrf-token': token,
    },
    cookies: { auth: 'session', csrf: token },
    ...overrides,
  } as any;
}

describe('auth cookie site', () => {
  it('uses lax when the frontend and API share a registrable domain', () => {
    expect(
      frontendAndBackendShareSite('https://app.crea8.one', 'https://api.crea8.one')
    ).toBe(true);
    expect(authCookieSameSite('https://app.crea8.one', 'https://api.crea8.one')).toBe('lax');
    expect(authCookieSameSite('http://localhost:4200', 'http://localhost:3000')).toBe('lax');
  });

  it('keeps none when the hosts are different sites or the API origin is unknown', () => {
    expect(
      authCookieSameSite('https://app.crea8.one', 'https://backend.up.railway.app')
    ).toBe('none');
    expect(authCookieSameSite('https://app.crea8.one', '')).toBe('none');
  });
});

describe('csrf', () => {
  const allow = new Set(['https://app.example.com']);
  const previous = process.env.FRONTEND_URL;

  beforeEach(() => {
    process.env.FRONTEND_URL = 'https://app.example.com';
  });

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = previous;
    }
  });

  it('skips safe methods, missing session cookies, and public, MCP, and webhook paths', () => {
    expect(csrfProblem(request({ method: 'GET' }))).toBeNull();
    expect(csrfProblem(request({ cookies: {} }))).toBeNull();
    expect(csrfProblem(request({ cookies: { showorg: '1' } }))).toBeNull();
    for (const path of [
      '/public/v1/posts',
      '/public/link/ada',
      '/mcp',
      '/mcp/abc',
      '/mcp-oauth/token',
      '/sse/1',
      '/message/1',
      '/stripe',
      '/payment/stripe',
    ]) {
      expect(csrfExemptPath(path)).toBe(true);
      expect(csrfProblem(request({ originalUrl: path }))).toBeNull();
    }
  });

  it('accepts a double-submit token from an allowlisted origin', () => {
    expect(originOnAllowlist('https://app.example.com', allow)).toBe(true);
    expect(originOnAllowlist('https://app.example.com/launches', allow)).toBe(true);
    expect(originOnAllowlist('https://evil.example', allow)).toBe(false);
    expect(csrfProblem(request())).toBeNull();
  });

  it('rejects a cookie mutation with the wrong token, a foreign origin, or no origin', () => {
    expect(
      csrfProblem(request({ headers: { origin: 'https://app.example.com', 'x-csrf-token': 'nope' } }))
    ).toBe('token');
    expect(
      csrfProblem(request({ headers: { origin: 'https://evil.example', 'x-csrf-token': token } }))
    ).toBe('origin');
    expect(csrfProblem(request({ headers: { 'x-csrf-token': token } }))).toBe('origin');
    expect(
      csrfProblem(
        request({
          headers: { referer: 'https://evil.example/form', 'x-csrf-token': token },
        })
      )
    ).toBe('origin');
  });
});
