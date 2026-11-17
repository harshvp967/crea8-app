import {
  LINK_ALREADY_USED,
  createPartnerVisit,
  loginHop,
  partnerComposeStaysOpen,
  runPartnerStep,
  selfStillPending,
  sessionOf,
  shouldHoldUserSelf,
  unauthenticated401Destination,
} from './compose.partner.flow';

const href = 'https://app.crea8.one/compose?token=once&caption=hello&video=https%3A%2F%2Fgta6clips.app%2Fa.mp4';

function step(input: {
  visit?: ReturnType<typeof createPartnerVisit>;
  session?: 'loading' | 'in' | 'out';
  href?: string;
  post: (path: string, body: Record<string, string>) => Promise<{ status?: string; pendingId?: string; email?: string; caption?: string; video?: string }>;
  connectedCount?: () => Promise<number>;
  replaceTokenUrl?: (next: string) => void;
}) {
  return runPartnerStep({
    visit: input.visit || createPartnerVisit(),
    href: input.href || href,
    session: input.session || 'loading',
    post: input.post,
    connectedCount: input.connectedCount || (async () => 1),
    replaceTokenUrl: input.replaceTokenUrl || (() => undefined),
  });
}

describe('gta6clips partner compose', () => {
  it('runs one exchange per token and strips the token before the call', async () => {
    const visit = createPartnerVisit();
    const order: string[] = [];
    let exchanges = 0;
    const run = () =>
      step({
        visit,
        post: async (path) => {
          order.push(path);
          exchanges += 1;
          return { status: 'replay' };
        },
        replaceTokenUrl: (next) => {
          order.push(next);
        },
      });
    const first = await run();
    const second = await run();
    expect(exchanges).toBe(1);
    expect(order[0]).toBe('/compose?caption=hello&video=https%3A%2F%2Fgta6clips.app%2Fa.mp4');
    expect(order[0]).not.toContain('token=');
    expect(order[1]).toBe('/partner/gta6clips/exchange');
    expect(first.view).toBe('used');
    expect(second.view).toBe('used');
    expect(first.view).not.toBe('preview');
    expect(LINK_ALREADY_USED).toBe('link already used');
  });

  it('links a logged-in collision and opens compose without Login', async () => {
    const visit = createPartnerVisit();
    const posts: string[] = [];
    const waiting = await step({
      visit,
      session: 'loading',
      post: async (path) => {
        posts.push(path);
        return {
          status: 'collision',
          pendingId: 'pend-1',
          email: 'ada@example.com',
          caption: 'hello',
          video: 'https://gta6clips.app/a.mp4',
        };
      },
    });
    expect(waiting).toEqual({ view: 'wait', needSession: true });
    expect(posts).toEqual(['/partner/gta6clips/exchange']);

    const opened = await step({
      visit,
      session: 'in',
      href: 'https://app.crea8.one/compose?caption=hello&video=https%3A%2F%2Fgta6clips.app%2Fa.mp4',
      post: async (path, body) => {
        posts.push(path);
        expect(body).toEqual({ pendingId: 'pend-1' });
        return { status: 'session', caption: 'hello', video: 'https://gta6clips.app/a.mp4' };
      },
      connectedCount: async () => 1,
    });
    expect(posts).toEqual(['/partner/gta6clips/exchange', '/partner/gta6clips/link']);
    expect(opened.view).toBe('compose');
    expect(opened.view).not.toBe('login');
  });

  it('shows Login only when the collision email is logged out', async () => {
    const posts: string[] = [];
    const result = await step({
      session: 'out',
      post: async (path) => {
        posts.push(path);
        return {
          status: 'collision',
          pendingId: 'pend-2',
          email: 'ada@example.com',
          caption: 'hello',
          video: 'https://gta6clips.app/a.mp4',
        };
      },
    });
    expect(posts).toEqual(['/partner/gta6clips/exchange']);
    expect(result.view).toBe('login');
    if (result.view === 'login') {
      expect(result.email).toBe('ada@example.com');
      expect(result.returnTo).toContain('/compose?pending=pend-2');
      expect(result.returnTo).not.toContain('token=');
    }
  });

  it('rejects a logged-in email mismatch without Login', async () => {
    const result = await step({
      session: 'in',
      post: async (path) => {
        if (path.endsWith('/link')) {
          return { status: 'refused', caption: 'hello', video: 'https://gta6clips.app/a.mp4' };
        }
        return { status: 'collision', pendingId: 'pend-3', email: 'ada@example.com' };
      },
    });
    expect(result.view).toBe('refused');
  });

  it('a logged-out new user is never redirected to /login', async () => {
    expect(
      shouldHoldUserSelf({ pathname: '/compose', arrivedWithToken: true, released: false })
    ).toBe(true);
    const destination = unauthenticated401Destination({
      pathname: '/compose',
      search: '?token=brand-new',
      handoff: true,
      status: 401,
      logout: true,
      onSocialCallback: false,
    });
    expect(destination).toBeNull();
    expect(loginHop(destination)).toBeNull();
    expect(loginHop(destination)).not.toBe('/login');

    const stripped = unauthenticated401Destination({
      pathname: '/compose',
      search: '',
      handoff: true,
      status: 401,
      logout: true,
      onSocialCallback: false,
    });
    expect(loginHop(stripped)).toBeNull();

    const posts: string[] = [];
    const result = await step({
      session: 'loading',
      post: async (path) => {
        posts.push(path);
        return { status: 'session', caption: 'hello', video: 'https://gta6clips.app/a.mp4' };
      },
    });
    expect(posts).toEqual(['/partner/gta6clips/exchange']);
    expect(result.view).toBe('navigate');
    expect(result.view).not.toBe('login');
    if (result.view === 'navigate') {
      expect(result.href).toContain('/compose?');
      expect(result.href).toContain('connect=1');
      expect(result.href).not.toContain('/login');
    }
  });

  it('keeps a partner compose arrival open and leaves a bare compose on the paywall', () => {
    expect(
      partnerComposeStaysOpen('/compose', 'connect=1&caption=hello&video=https://gta6clips.app/a.mp4')
    ).toBe(true);
    expect(partnerComposeStaysOpen('/compose', '?token=once')).toBe(true);
    expect(partnerComposeStaysOpen('/compose', '')).toBe(false);
    expect(partnerComposeStaysOpen('/schedule', 'caption=hello')).toBe(false);
  });

  it('still points a signed-out home 401 at the login hop', () => {
    const home = unauthenticated401Destination({
      pathname: '/',
      search: '',
      handoff: false,
      status: 401,
      logout: false,
      onSocialCallback: false,
    });
    expect(home).toBe('/');
    expect(loginHop(home)).toBe('/login');
    expect(
      selfStillPending({
        hold: true,
        loading: false,
        validating: false,
        hasUser: false,
        failed: false,
        fetchStarted: false,
      })
    ).toBe(true);
    expect(sessionOf({ hasUser: false, failed: true, pending: false })).toBe('out');
    expect(sessionOf({ userId: 'user-1', hasUser: true, failed: false, pending: true })).toBe('in');
  });
});
