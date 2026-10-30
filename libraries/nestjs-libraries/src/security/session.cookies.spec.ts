import {
  clearSessionCookies,
  expiredSessionCookies,
  logoutLoginUrl,
  serializeExpiredSessionCookie,
  sessionCookieOptions,
  SESSION_COOKIE_NAMES,
} from '@gitroom/helpers/auth/session.cookies';

describe('logout session cookies', () => {
  const previous = {
    FRONTEND_URL: process.env.FRONTEND_URL,
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
    NOT_SECURED: process.env.NOT_SECURED,
  };

  afterEach(() => {
    restore('FRONTEND_URL', previous.FRONTEND_URL);
    restore('NEXT_PUBLIC_BACKEND_URL', previous.NEXT_PUBLIC_BACKEND_URL);
    restore('NOT_SECURED', previous.NOT_SECURED);
  });

  it('expires host-only and parent-domain cookies and lands on /auth/login', () => {
    process.env.FRONTEND_URL = 'https://preview.example.com';
    process.env.NEXT_PUBLIC_BACKEND_URL = 'https://api.example.com';
    delete process.env.NOT_SECURED;

    const headers: string[] = [];
    clearSessionCookies({
      append: (_field, value) => {
        headers.push(value);
      },
    });

    expect(logoutLoginUrl('https://app.crea8.one/auth/logout')).toBe(
      'https://app.crea8.one/auth/login'
    );
    expect(logoutLoginUrl('https://app.crea8.one/auth/logout?next=/analytics')).toBe(
      'https://app.crea8.one/auth/login'
    );

    for (const name of SESSION_COOKIE_NAMES) {
      const rows = headers.filter((header) => header.startsWith(`${name}=`));
      expect(rows).toHaveLength(3);
      expect(rows.every((header) => /Path=\//.test(header))).toBe(true);
      expect(rows.every((header) => /Max-Age=0/.test(header))).toBe(true);
      expect(rows.some((header) => !/Domain=/i.test(header))).toBe(true);
      expect(rows.some((header) => /Domain=\.crea8\.one/.test(header))).toBe(true);
      expect(rows.some((header) => /Domain=\.example\.com/.test(header))).toBe(true);
    }
  });

  it('does not repeat .crea8.one when that is already the frontend domain', () => {
    process.env.FRONTEND_URL = 'https://app.crea8.one';
    process.env.NEXT_PUBLIC_BACKEND_URL = 'https://api.crea8.one';
    delete process.env.NOT_SECURED;

    const cookies = expiredSessionCookies();
    const auth = cookies.filter((cookie) => cookie.name === 'auth');
    expect(auth.map((cookie) => cookie.domain ?? 'host')).toEqual([
      'host',
      '.crea8.one',
    ]);
    expect(auth.every((cookie) => cookie.path === '/')).toBe(true);
    expect(serializeExpiredSessionCookie(auth[0])).not.toMatch(/Domain=/);
    expect(serializeExpiredSessionCookie(auth[1])).toContain('Domain=.crea8.one');
  });

  it('login stores the session cookie on path /', () => {
    process.env.FRONTEND_URL = 'https://app.crea8.one';
    process.env.NEXT_PUBLIC_BACKEND_URL = 'https://api.crea8.one';
    delete process.env.NOT_SECURED;

    const options = sessionCookieOptions(new Date('2030-01-01T00:00:00.000Z'));
    expect(options.path).toBe('/');
    expect(options.domain).toBe('.crea8.one');
    expect(options.httpOnly).toBe(true);
    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe('lax');
  });
});

function restore(key: 'FRONTEND_URL' | 'NEXT_PUBLIC_BACKEND_URL' | 'NOT_SECURED', value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
