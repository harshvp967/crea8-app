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

// First URL segments that are app routes, so they can never be a bio username.
// link.rules.ts keeps the same names for the username check.
export const APP_FIRST_SEGMENTS = [
  'account',
  'activate',
  'admin',
  'agents',
  'analytics',
  'api',
  'auth',
  'billing',
  'bio-host',
  'data-deletion',
  'err',
  'forgot',
  'icons',
  'integrations',
  'invite',
  'join',
  'launches',
  'link',
  'linkinbio',
  'login',
  'login-required',
  'media',
  'modal',
  'oauth',
  'p',
  'payment',
  'plugs',
  'pricing',
  'privacy',
  'provider',
  'refund-policy',
  'register',
  'schedule',
  'settings',
  'share',
  'stalker',
  'stalker-preview',
  'subscribe',
  'terms',
  'third-party',
  'uploads',
  'webhooks',
] as const;

const APP_FIRST = new Set<string>(APP_FIRST_SEGMENTS);

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

export function isAppFirstSegment(segment: string) {
  return APP_FIRST.has(segment.toLowerCase());
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
    return false;
  }
  const slug = decision.action === 'render' ? decision.slug : decision.location.slice(2);
  return Boolean(slug) && !isAppFirstSegment(slug);
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
  if (!slug || isAppFirstSegment(slug) || STATIC_ASSET.test(slug)) {
    return '';
  }
  return `/@${slug.toLowerCase()}`;
}

export function legacyRedirect(pathname: string, search = ''): PathRedirect | null {
  const path = stripTrailingSlash(pathname);
  if (path === '/' || isKeptCallback(path)) {
    return null;
  }
  const exact = EXACT[path];
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
