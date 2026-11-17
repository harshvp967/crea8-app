export const LINK_ALREADY_USED = 'link already used';
export const PARTNER_HANDOFF_KEY = 'crea8.partner.handoff';

export type Session = 'loading' | 'in' | 'out';

export type PartnerBody = {
  status?: string;
  pendingId?: string;
  email?: string;
  caption?: string;
  video?: string | null;
};

export type PartnerResult =
  | { view: 'wait'; needSession?: boolean }
  | { view: 'login'; email: string; returnTo: string }
  | { view: 'used' }
  | { view: 'refused' }
  | { view: 'preview'; caption: string; video: string }
  | { view: 'compose'; caption: string; video: string }
  | { view: 'connect'; caption: string; video: string }
  | { view: 'navigate'; href: string; caption: string; video: string };

type StorageLike = {
  getItem?: (key: string) => string | null;
  setItem?: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
};

let arrivedWithToken = false;
let sessionReleased = false;
const sessionListeners = new Set<() => void>();

export function notePartnerToken() {
  arrivedWithToken = true;
}

export function partnerArrivedWithToken() {
  return arrivedWithToken;
}

export function partnerSessionReleased() {
  return sessionReleased;
}

export function releasePartnerSession() {
  if (sessionReleased) {
    return;
  }
  sessionReleased = true;
  sessionListeners.forEach((listener) => listener());
}

export function subscribePartnerSession(listener: () => void) {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

export function shouldHoldUserSelf(input: {
  pathname: string;
  arrivedWithToken: boolean;
  released: boolean;
}) {
  const path = (input.pathname || '/').replace(/\/+$/, '') || '/';
  return path === '/compose' && input.arrivedWithToken && !input.released;
}

export function markPartnerHandoff(storage: StorageLike | null) {
  try {
    storage?.setItem?.(PARTNER_HANDOFF_KEY, '1');
  } catch {
    return;
  }
}

export function readPartnerHandoff(storage: StorageLike | null) {
  try {
    return storage?.getItem?.(PARTNER_HANDOFF_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearPartnerHandoff(storage: StorageLike | null) {
  try {
    storage?.removeItem?.(PARTNER_HANDOFF_KEY);
  } catch {
    return;
  }
}

export function partnerComposeStaysOpen(pathname: string, search: string) {
  const path = (pathname || '/').replace(/\/+$/, '') || '/';
  if (path !== '/compose') {
    return false;
  }
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return (
    params.has('token') ||
    params.has('pending') ||
    params.has('connect') ||
    params.has('caption') ||
    params.has('video') ||
    params.get('partner') === 'gta6clips'
  );
}

export function skipComposeAuthRedirect(pathname: string, search: string, handoff = false) {
  const path = (pathname || '/').replace(/\/+$/, '') || '/';
  if (path !== '/compose') {
    return false;
  }
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return handoff || params.has('token') || params.has('pending');
}

// A 401 on this page used to set location to `/`, and proxy.ts sends a
// signed-out `/` to `/login`, which aborts the exchange.
export function unauthenticated401Destination(input: {
  pathname: string;
  search: string;
  handoff: boolean;
  status: number;
  logout: boolean;
  onSocialCallback: boolean;
}): '/' | null {
  if (input.onSocialCallback) {
    return null;
  }
  if (input.status !== 401 && !input.logout) {
    return null;
  }
  if (skipComposeAuthRedirect(input.pathname, input.search, input.handoff)) {
    return null;
  }
  return '/';
}

export function loginHop(destination: '/' | null): '/login' | null {
  return destination === '/' ? '/login' : null;
}

export function selfStillPending(input: {
  hold: boolean;
  loading: boolean;
  validating: boolean;
  hasUser: boolean;
  failed: boolean;
  fetchStarted: boolean;
}) {
  if (input.hasUser) {
    return false;
  }
  if (input.hold || input.loading || input.validating) {
    return true;
  }
  return !input.failed && !input.fetchStarted;
}

export function sessionOf(input: {
  userId?: string;
  hasUser: boolean;
  failed: boolean;
  pending: boolean;
}): Session {
  if (input.userId || input.hasUser) {
    return 'in';
  }
  if (input.pending) {
    return 'loading';
  }
  if (input.failed) {
    return 'out';
  }
  return 'out';
}

export function stripPartnerToken(href: string) {
  const url = new URL(href);
  url.searchParams.delete('token');
  return url.pathname + url.search + url.hash;
}

function clipText(value: string | null | undefined, fallback: string) {
  return typeof value === 'string' ? value : fallback;
}

function connectHref(origin: string, caption: string, video: string) {
  const next = new URL('/compose', origin);
  next.searchParams.set('connect', '1');
  if (caption) {
    next.searchParams.set('caption', caption);
  }
  if (video) {
    next.searchParams.set('video', video);
  }
  return next.toString();
}

function pendingReturn(origin: string, pendingId: string, caption: string, video: string) {
  const next = new URL('/compose', origin);
  next.searchParams.set('pending', pendingId);
  if (caption) {
    next.searchParams.set('caption', caption);
  }
  if (video) {
    next.searchParams.set('video', video);
  }
  return next.toString();
}

export type PartnerVisit = {
  startExchange: (token: string, run: () => Promise<PartnerBody>) => Promise<PartnerBody>;
  readExchange: () => Promise<PartnerBody> | null;
  startLink: (pendingId: string, run: () => Promise<PartnerResult>) => Promise<PartnerResult>;
  claimOpen: () => boolean;
  claimNavigate: (href: string) => boolean;
};

export function createPartnerVisit(): PartnerVisit {
  const exchanges = new Map<string, Promise<PartnerBody>>();
  const links = new Map<string, Promise<PartnerResult>>();
  let latestToken = '';
  let opened = false;
  let navigated = '';
  return {
    startExchange(token, run) {
      const existing = exchanges.get(token);
      if (existing) {
        return existing;
      }
      latestToken = token;
      const created = run();
      exchanges.set(token, created);
      return created;
    },
    readExchange() {
      if (!latestToken) {
        return null;
      }
      return exchanges.get(latestToken) || null;
    },
    startLink(pendingId, run) {
      const existing = links.get(pendingId);
      if (existing) {
        return existing;
      }
      const created = run();
      links.set(pendingId, created);
      return created;
    },
    claimOpen() {
      if (opened) {
        return false;
      }
      opened = true;
      return true;
    },
    claimNavigate(href) {
      if (navigated) {
        return false;
      }
      navigated = href;
      return true;
    },
  };
}

export const sharedPartnerVisit = createPartnerVisit();

async function finishLink(
  visit: PartnerVisit,
  origin: string,
  pendingId: string,
  caption: string,
  video: string,
  post: (path: string, body: Record<string, string>) => Promise<PartnerBody>,
  connectedCount: () => Promise<number>
): Promise<PartnerResult> {
  if (!pendingId) {
    return { view: 'refused' };
  }
  return visit.startLink(pendingId, async () => {
    const linked = await post('/partner/gta6clips/link', { pendingId });
    const nextCaption = clipText(linked.caption, caption);
    const nextVideo = clipText(linked.video, video);
    if (linked.status === 'refused') {
      return { view: 'refused' };
    }
    if (linked.status !== 'session') {
      return { view: 'preview', caption: nextCaption, video: nextVideo };
    }
    let count = 1;
    try {
      count = await connectedCount();
    } catch {
      count = 1;
    }
    if (count > 0) {
      return { view: 'compose', caption: nextCaption, video: nextVideo };
    }
    return {
      view: 'navigate',
      href: connectHref(origin, nextCaption, nextVideo),
      caption: nextCaption,
      video: nextVideo,
    };
  });
}

export async function runPartnerStep(input: {
  visit: PartnerVisit;
  href: string;
  session: Session;
  post: (path: string, body: Record<string, string>) => Promise<PartnerBody>;
  connectedCount: () => Promise<number>;
  replaceTokenUrl: (href: string) => void;
}): Promise<PartnerResult> {
  const url = new URL(input.href);
  const token = url.searchParams.get('token') || '';
  const pending = url.searchParams.get('pending') || '';
  const caption = url.searchParams.get('caption') || '';
  const video = url.searchParams.get('video') || '';
  const connect = url.searchParams.get('connect') === '1';

  let body: PartnerBody | null = null;
  if (token) {
    body = await input.visit.startExchange(token, async () => {
      input.replaceTokenUrl(stripPartnerToken(input.href));
      return input.post('/partner/gta6clips/exchange', { token, caption, video });
    });
  } else {
    const inflight = input.visit.readExchange();
    if (inflight) {
      body = await inflight;
    }
  }

  if (body) {
    const nextCaption = clipText(body.caption, caption);
    const nextVideo = clipText(body.video, video);
    if (body.status === 'replay') {
      return { view: 'used' };
    }
    if (body.status === 'collision') {
      const pendingId = body.pendingId || '';
      if (input.session === 'loading') {
        return { view: 'wait', needSession: true };
      }
      if (input.session === 'in') {
        return finishLink(
          input.visit,
          url.origin,
          pendingId,
          nextCaption,
          nextVideo,
          input.post,
          input.connectedCount
        );
      }
      return {
        view: 'login',
        email: body.email || '',
        returnTo: pendingReturn(url.origin, pendingId, nextCaption, nextVideo),
      };
    }
    if (body.status === 'session') {
      return {
        view: 'navigate',
        href: connectHref(url.origin, nextCaption, nextVideo),
        caption: nextCaption,
        video: nextVideo,
      };
    }
    return { view: 'preview', caption: nextCaption, video: nextVideo };
  }

  if (pending) {
    if (input.session === 'loading') {
      return { view: 'wait', needSession: true };
    }
    if (input.session === 'in') {
      return finishLink(
        input.visit,
        url.origin,
        pending,
        caption,
        video,
        input.post,
        input.connectedCount
      );
    }
    return {
      view: 'login',
      email: '',
      returnTo: pendingReturn(url.origin, pending, caption, video),
    };
  }

  if (connect) {
    return { view: 'connect', caption, video };
  }
  if (input.session === 'in') {
    return { view: 'compose', caption, video };
  }
  if (input.session === 'loading') {
    return { view: 'wait' };
  }
  return { view: 'preview', caption, video };
}
