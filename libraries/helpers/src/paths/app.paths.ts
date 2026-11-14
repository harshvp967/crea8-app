// Old app paths 301 to the paths the waitlist already sends people to.
// A provider callback is never in this map. The browser must land on the
// URL the provider was given, with no Location header from this layer.

export type PathRedirect = { status: 301; location: string };

export type KeptCallback = {
  path: string;
  provider: string;
  kept: 'unchanged';
};

const EXACT: Record<string, string> = {
  '/auth': '/login',
  '/auth/login': '/login',
  '/auth/register': '/register',
  '/auth/activate': '/activate',
  '/auth/forgot': '/forgot',
  '/auth/login-required': '/login-required',
  '/launches': '/schedule',
  '/analytics': '/schedule/analytics',
  '/media': '/schedule/media',
  '/plugs': '/schedule/plugs',
  '/agents': '/schedule/agents',
  '/third-party': '/schedule/integrations',
  '/link': '/linkinbio',
  '/billing': '/account/billing',
  '/join': '/invite',
  '/dashboard': '/schedule',
  '/stalker-preview': '/stalker/preview',
};

const PREFIXES: Array<[string, string]> = [
  ['/auth/activate/', '/activate/'],
  ['/auth/forgot/', '/forgot/'],
  ['/agents/', '/schedule/agents/'],
  ['/billing/', '/account/billing/'],
  ['/link/', '/linkinbio/'],
  ['/p/', '/schedule/p/'],
  ['/stalker-preview/', '/stalker/preview/'],
];

// One list for bio usernames and for the bare /{slug} → /@{slug} redirect.
// link.rules.ts reads it through isReservedSlug. A name added here cannot be
// claimed by that redirect. `app` and `static` have a document. `namespace`
// is a real prefix whose exact URL has no document and must not move.
// `block` is a username with no page.
export type ReservedKind = 'app' | 'namespace' | 'static' | 'block';

export const RESERVED_PATHS: ReadonlyArray<{ name: string; kind: ReservedKind }> = [
  { name: '.well-known', kind: 'namespace' },
  { name: 'about', kind: 'block' },
  { name: 'account', kind: 'app' },
  { name: 'activate', kind: 'app' },
  { name: 'admin', kind: 'namespace' },
  { name: 'agents', kind: 'app' },
  { name: 'analytics', kind: 'app' },
  { name: 'api', kind: 'namespace' },
  { name: 'app', kind: 'block' },
  { name: 'assets', kind: 'block' },
  { name: 'auth', kind: 'app' },
  { name: 'billing', kind: 'app' },
  { name: 'bio', kind: 'block' },
  { name: 'bio-host', kind: 'app' },
  { name: 'blog', kind: 'block' },
  { name: 'calendar', kind: 'block' },
  { name: 'careers', kind: 'block' },
  { name: 'changelog', kind: 'block' },
  { name: 'confirm', kind: 'block' },
  { name: 'contact', kind: 'block' },
  { name: 'copilot', kind: 'block' },
  { name: 'dashboard', kind: 'app' },
  { name: 'data-deletion', kind: 'app' },
  { name: 'docs', kind: 'block' },
  { name: 'domain', kind: 'block' },
  { name: 'editor', kind: 'block' },
  { name: 'err', kind: 'namespace' },
  { name: 'faq', kind: 'block' },
  { name: 'favicon.ico', kind: 'static' },
  { name: 'features', kind: 'block' },
  { name: 'forgot', kind: 'app' },
  { name: 'help', kind: 'block' },
  { name: 'home', kind: 'block' },
  { name: 'icons', kind: 'namespace' },
  { name: 'index', kind: 'block' },
  { name: 'integrations', kind: 'namespace' },
  { name: 'invite', kind: 'app' },
  { name: 'join', kind: 'app' },
  { name: 'launches', kind: 'app' },
  { name: 'leads', kind: 'block' },
  { name: 'legal', kind: 'block' },
  { name: 'link', kind: 'app' },
  { name: 'linkinbio', kind: 'app' },
  { name: 'links', kind: 'block' },
  { name: 'llms.txt', kind: 'static' },
  { name: 'login', kind: 'app' },
  { name: 'login-required', kind: 'app' },
  { name: 'logout', kind: 'block' },
  { name: 'mail', kind: 'block' },
  { name: 'manifest.webmanifest', kind: 'static' },
  { name: 'media', kind: 'app' },
  { name: 'modal', kind: 'namespace' },
  { name: 'oauth', kind: 'namespace' },
  { name: 'onboarding', kind: 'block' },
  { name: 'p', kind: 'namespace' },
  { name: 'payment', kind: 'namespace' },
  { name: 'plugs', kind: 'app' },
  { name: 'postiz', kind: 'block' },
  { name: 'press', kind: 'block' },
  { name: 'pricing', kind: 'app' },
  { name: 'privacy', kind: 'app' },
  { name: 'provider', kind: 'namespace' },
  { name: 'public', kind: 'block' },
  { name: 'refund-policy', kind: 'app' },
  { name: 'register', kind: 'app' },
  { name: 'robots.txt', kind: 'static' },
  { name: 'schedule', kind: 'app' },
  { name: 'settings', kind: 'app' },
  { name: 'share', kind: 'namespace' },
  { name: 'signin', kind: 'block' },
  { name: 'signup', kind: 'block' },
  { name: 'sitemap.xml', kind: 'static' },
  { name: 'stalker', kind: 'app' },
  { name: 'stalker-preview', kind: 'app' },
  { name: 'static', kind: 'block' },
  { name: 'status', kind: 'block' },
  { name: 'subscribe', kind: 'namespace' },
  { name: 'support', kind: 'block' },
  { name: 'terms', kind: 'app' },
  { name: 'third-party', kind: 'app' },
  { name: 'uploads', kind: 'namespace' },
  { name: 'waitlist', kind: 'block' },
  { name: 'webhooks', kind: 'namespace' },
  { name: 'www', kind: 'block' },
];

const RESERVED = new Map(RESERVED_PATHS.map((entry) => [entry.name, entry.kind]));

export const APP_FIRST_SEGMENTS = RESERVED_PATHS.filter((entry) => entry.kind !== 'block').map(
  (entry) => entry.name
);

export const KEPT_CALLBACKS: KeptCallback[] = [
  { path: '/settings', provider: 'GitHub, generic OIDC', kept: 'unchanged' },
  { path: '/integrations/social/facebook', provider: 'Meta / Facebook', kept: 'unchanged' },
  { path: '/integrations/social/instagram', provider: 'Instagram', kept: 'unchanged' },
  { path: '/integrations/social/instagram-standalone', provider: 'Instagram', kept: 'unchanged' },
  { path: '/integrations/social/threads', provider: 'Threads', kept: 'unchanged' },
  { path: '/integrations/social/x', provider: 'X', kept: 'unchanged' },
  { path: '/integrations/social/linkedin', provider: 'LinkedIn', kept: 'unchanged' },
  { path: '/integrations/social/linkedin-page', provider: 'LinkedIn Pages', kept: 'unchanged' },
  { path: '/integrations/social/youtube', provider: 'Google login, YouTube', kept: 'unchanged' },
  { path: '/integrations/social/tiktok', provider: 'TikTok', kept: 'unchanged' },
  { path: '/integrations/social/tiktok-business', provider: 'TikTok Business', kept: 'unchanged' },
  { path: '/integrations/social/pinterest', provider: 'Pinterest', kept: 'unchanged' },
  { path: '/integrations/social/reddit', provider: 'Reddit', kept: 'unchanged' },
  { path: '/integrations/social/discord', provider: 'Discord', kept: 'unchanged' },
  { path: '/integrations/social/slack', provider: 'Slack', kept: 'unchanged' },
  { path: '/integrations/social/dribbble', provider: 'Dribbble', kept: 'unchanged' },
  { path: '/integrations/social/gmb', provider: 'Google Business', kept: 'unchanged' },
  { path: '/integrations/social/mastodon', provider: 'Mastodon', kept: 'unchanged' },
  { path: '/integrations/social/mewe', provider: 'MeWe', kept: 'unchanged' },
  { path: '/integrations/social/twitch', provider: 'Twitch', kept: 'unchanged' },
  { path: '/integrations/social/kick', provider: 'Kick', kept: 'unchanged' },
  { path: '/integrations/social/tumblr', provider: 'Tumblr', kept: 'unchanged' },
  { path: '/integrations/social/vk', provider: 'VK', kept: 'unchanged' },
  { path: '/integrations/social/whop', provider: 'Whop', kept: 'unchanged' },
  { path: '/provider/add', provider: 'provider connect bridge', kept: 'unchanged' },
  { path: '/oauth/authorize', provider: 'MCP OAuth', kept: 'unchanged' },
  { path: '/auth/oauth/apple/redirect', provider: 'Apple', kept: 'unchanged' },
  { path: '/payment/dodo', provider: 'Dodo webhook', kept: 'unchanged' },
  { path: '/payment/stripe', provider: 'Stripe webhook', kept: 'unchanged' },
  { path: '/payment/revenuecat', provider: 'RevenueCat webhook', kept: 'unchanged' },
  { path: '/webhooks', provider: 'webhook API', kept: 'unchanged' },
  { path: '/data-deletion', provider: 'Meta data deletion', kept: 'unchanged' },
  { path: '/privacy', provider: 'legal', kept: 'unchanged' },
  { path: '/terms', provider: 'legal', kept: 'unchanged' },
];

export function stripTrailingSlash(pathname: string) {
  if (!pathname || pathname === '/') {
    return '/';
  }
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

export function isKeptCallback(pathname: string) {
  const path = stripTrailingSlash(pathname).toLowerCase();
  if (
    path === '/settings' ||
    path === '/privacy' ||
    path === '/terms' ||
    path === '/data-deletion' ||
    path === '/refund-policy' ||
    path === '/oauth/authorize' ||
    path === '/webhooks'
  ) {
    return true;
  }
  return (
    path.startsWith('/integrations/social/') ||
    path.startsWith('/integrations/social') ||
    path.startsWith('/provider/') ||
    path.startsWith('/oauth/') ||
    path.startsWith('/auth/oauth/') ||
    path.startsWith('/payment/') ||
    path.startsWith('/webhooks/')
  );
}

export function isReservedSlug(slug: string) {
  return RESERVED.has(slug.trim().toLowerCase());
}

export function isAppFirstSegment(segment: string) {
  const kind = RESERVED.get(segment.trim().toLowerCase());
  return !!kind && kind !== 'block';
}

export function isPublicAuthPath(pathname: string) {
  const path = stripTrailingSlash(pathname);
  return (
    path === '/login' ||
    path === '/register' ||
    path === '/login-required' ||
    path === '/activate' ||
    path.startsWith('/activate/') ||
    path === '/forgot' ||
    path.startsWith('/forgot/')
  );
}

// Files the proxy skips. A dotted username such as crea8.one is not one of these.
// The same list is inlined in apps/frontend/src/proxy.ts (the matcher must be a literal).
const STATIC_ASSET =
  /\.(?:ico|png|jpe?g|gif|svg|webp|avif|js|mjs|css|map|txt|xml|json|webmanifest|woff2?|mp4|webm)$/i;

function decodePiece(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// Next percent-encodes @ in a dynamic param (@ is a parallel-route marker).
// /@pixcamm arrives as %40pixcamm. '/@' + that value is the 307 to /@%40pixcamm.
function peelAt(value: string) {
  let slug = value;
  let marks = 0;
  while (slug.startsWith('@') || slug.toLowerCase().startsWith('%40')) {
    marks += 1;
    slug = slug.startsWith('@') ? slug.slice(1) : slug.slice(3);
  }
  return { slug, marks };
}

export type BioParamDecision =
  | { action: 'render'; slug: string }
  | { action: 'redirect'; location: string };

export function bioParamDecision(param: string): BioParamDecision | null {
  const { slug, marks } = peelAt(decodePiece(param));
  const name = slug.toLowerCase();
  if (!name || /[/@\s]/.test(name) || name.includes('%')) {
    return null;
  }
  // Reserved names are app routes or blocked usernames, never a bio.
  if (isReservedSlug(name)) {
    return null;
  }
  // One @, or a second @ already in the param, renders. It does not redirect
  // to a URL that adds another @.
  if (marks > 0) {
    return { action: 'render', slug: name };
  }
  return { action: 'redirect', location: `/@${name}` };
}

export function isPublicBioPath(pathname: string) {
  const path = stripTrailingSlash(pathname);
  if (path === '/bio-host' || path.startsWith('/subscribe/confirm/')) {
    return true;
  }
  if (!path.startsWith('/') || path === '/' || path.slice(1).includes('/')) {
    return false;
  }
  const segment = decodePiece(path.slice(1));
  const atForm = segment.startsWith('@') || segment.toLowerCase().startsWith('%40');
  if (!atForm && STATIC_ASSET.test(segment)) {
    return false;
  }
  const decision = bioParamDecision(segment);
  if (!decision) {
    const name = peelAt(segment).slug.toLowerCase();
    // A blocked username has no document. Leave it public so a signed-out
    // visitor gets the not-found page, not a login redirect.
    return isReservedSlug(name) && !isAppFirstSegment(name);
  }
  const slug = decision.action === 'render' ? decision.slug : decision.location.slice(2);
  return Boolean(slug) && !isReservedSlug(slug);
}

function withSearch(pathname: string, search: string) {
  if (!search || search === '?') {
    return pathname;
  }
  return pathname + (search.startsWith('?') ? search : `?${search}`);
}

function bioRedirect(path: string) {
  if (
    path.startsWith('/@') ||
    path.toLowerCase().startsWith('/%40') ||
    path.slice(1).includes('/')
  ) {
    return '';
  }
  const slug = path.slice(1);
  if (!slug || isReservedSlug(slug) || STATIC_ASSET.test(slug)) {
    return '';
  }
  return `/@${slug.toLowerCase()}`;
}

export function legacyRedirect(pathname: string, search = ''): PathRedirect | null {
  const path = stripTrailingSlash(pathname);
  if (path === '/' || isKeptCallback(path)) {
    return null;
  }
  const exact = EXACT[path.toLowerCase()];
  if (exact) {
    return { status: 301, location: withSearch(exact, search) };
  }
  for (const [from, to] of PREFIXES) {
    if (path.startsWith(from)) {
      return { status: 301, location: withSearch(to + path.slice(from.length), search) };
    }
  }
  const bio = bioRedirect(path);
  if (bio && bio !== path) {
    return { status: 301, location: withSearch(bio, search) };
  }
  return null;
}
