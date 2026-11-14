import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import {
  KEPT_CALLBACKS,
  RESERVED_PATHS,
  bioParamDecision,
  isPublicBioPath,
  isReservedSlug,
  legacyRedirect,
} from '@gitroom/helpers/paths/app.paths';

const ROOT = join(__dirname, '../../../..');
const APP_DIR = join(ROOT, 'apps/frontend/src/app');
const PUBLIC_DIR = join(ROOT, 'apps/frontend/public');
const NEXT_CONFIG = join(ROOT, 'apps/frontend/next.config.js');

const MOVED: Array<[string, string, string]> = [
  ['/auth', '?next=1', '/login?next=1'],
  ['/auth/login', '?returnUrl=https%3A%2F%2Fapp.crea8.one%2Fschedule', '/login?returnUrl=https%3A%2F%2Fapp.crea8.one%2Fschedule'],
  ['/auth/register', '', '/register'],
  ['/auth/activate', '?x=1', '/activate?x=1'],
  ['/auth/activate/abc', '', '/activate/abc'],
  ['/auth/forgot', '', '/forgot'],
  ['/auth/forgot/tok', '?y=2', '/forgot/tok?y=2'],
  ['/auth/login-required', '', '/login-required'],
  ['/launches', '?week=1&year=2026', '/schedule?week=1&year=2026'],
  ['/analytics', '', '/schedule/analytics'],
  ['/media', '?folder=1', '/schedule/media?folder=1'],
  ['/plugs', '', '/schedule/plugs'],
  ['/agents', '', '/schedule/agents'],
  ['/agents/new', '?tab=1', '/schedule/agents/new?tab=1'],
  ['/third-party', '', '/schedule/integrations'],
  ['/p/post_1', '?v=2', '/schedule/p/post_1?v=2'],
  ['/link', '', '/linkinbio'],
  ['/link/appearance', '', '/linkinbio/appearance'],
  ['/link/analytics', '?range=7d', '/linkinbio/analytics?range=7d'],
  ['/link/leads', '', '/linkinbio/leads'],
  ['/link/settings', '', '/linkinbio/settings'],
  ['/billing', '', '/account/billing'],
  ['/billing/lifetime', '?check=1', '/account/billing/lifetime?check=1'],
  ['/join', '?error=used', '/invite?error=used'],
  ['/dashboard', '', '/schedule'],
  ['/Dashboard', '?from=home', '/schedule?from=home'],
  ['/stalker-preview', '', '/stalker/preview'],
  ['/stalker-preview/mentions', '', '/stalker/preview/mentions'],
  ['/harsh', '?utm=1', '/@harsh?utm=1'],
  ['/Harsh', '', '/@harsh'],
  ['/crea8.one', '?utm=1', '/@crea8.one?utm=1'],
  ['/Crea8.One', '', '/@crea8.one'],
];

describe('legacy path redirects', () => {
  it.each(MOVED)('301s %s to the new path and keeps the query', (from, search, location) => {
    expect(legacyRedirect(from, search)).toEqual({ status: 301, location });
  });

  it('leaves stalker, account, admin, and the new paths where they are', () => {
    for (const path of [
      '/stalker',
      '/stalker/mentions',
      '/stalker/settings',
      '/account',
      '/account/billing',
      '/admin/stats',
      '/login',
      '/register',
      '/schedule',
      '/schedule/analytics',
      '/linkinbio/leads',
      '/invite',
      '/@harsh',
      '/@crea8.one',
      '/@pixcamm',
      '/auth/logout',
      '/favicon.ico',
      '/f.js',
      '/robots.txt',
      '/sitemap.xml',
      '/llms.txt',
      '/privacy',
      '/terms',
      '/data-deletion',
      '/refund-policy',
    ]) {
      expect(legacyRedirect(path, '?keep=1')).toBeNull();
    }
  });

  it('does not 301 a provider callback and does not add a Location', () => {
    for (const row of KEPT_CALLBACKS) {
      expect(legacyRedirect(row.path, '?code=abc&state=login')).toBeNull();
      expect(legacyRedirect(`${row.path}/`, '?code=abc')).toBeNull();
    }
    expect(legacyRedirect('/integrations/social/facebook', '?code=1&state=connect')).toBeNull();
    expect(legacyRedirect('/oauth/token', '')).toBeNull();
    expect(legacyRedirect('/oauth/register', '')).toBeNull();
    expect(legacyRedirect('/oauth/userinfo', '')).toBeNull();
    expect(legacyRedirect('/webhooks/post', '')).toBeNull();
  });
});

describe('public /@username', () => {
  it('renders /@username directly when Next encodes @ as %40, including a dotted username', () => {
    expect(bioParamDecision('%40pixcamm')).toEqual({ action: 'render', slug: 'pixcamm' });
    expect(bioParamDecision('@pixcamm')).toEqual({ action: 'render', slug: 'pixcamm' });
    expect(bioParamDecision('%40crea8.one')).toEqual({ action: 'render', slug: 'crea8.one' });
    expect(bioParamDecision('@crea8.one')).toEqual({ action: 'render', slug: 'crea8.one' });
    expect(isPublicBioPath('/@pixcamm')).toBe(true);
    expect(isPublicBioPath('/@crea8.one')).toBe(true);
  });

  it('does not add a second @ for a double-@ param, including a dotted username', () => {
    expect(bioParamDecision('%40%40pixcamm')).toEqual({ action: 'render', slug: 'pixcamm' });
    expect(bioParamDecision('@@pixcamm')).toEqual({ action: 'render', slug: 'pixcamm' });
    expect(bioParamDecision('%40%40crea8.one')).toEqual({ action: 'render', slug: 'crea8.one' });
    expect(bioParamDecision('@@crea8.one')).toEqual({ action: 'render', slug: 'crea8.one' });
    for (const param of ['%40pixcamm', '%40%40pixcamm', '%40crea8.one', '%40%40crea8.one']) {
      const decision = bioParamDecision(param);
      expect(decision?.action).toBe('render');
      expect(JSON.stringify(decision)).not.toContain('%40');
    }
    expect(isPublicBioPath('/@%40pixcamm')).toBe(true);
    expect(isPublicBioPath('/@%40crea8.one')).toBe(true);
  });

  it('still sends a bare slug to /@slug and leaves legal, stealth, and oauth paths alone', () => {
    expect(bioParamDecision('pixcamm')).toEqual({ action: 'redirect', location: '/@pixcamm' });
    expect(bioParamDecision('crea8.one')).toEqual({ action: 'redirect', location: '/@crea8.one' });
    expect(isPublicBioPath('/privacy')).toBe(false);
    expect(isPublicBioPath('/terms')).toBe(false);
    expect(isPublicBioPath('/data-deletion')).toBe(false);
    expect(isPublicBioPath('/refund-policy')).toBe(false);
    expect(isPublicBioPath('/robots.txt')).toBe(false);
    expect(isPublicBioPath('/sitemap.xml')).toBe(false);
    expect(isPublicBioPath('/favicon.ico')).toBe(false);
    expect(isPublicBioPath('/oauth/authorize')).toBe(false);
    expect(isPublicBioPath('/integrations/social/x')).toBe(false);
    expect(isPublicBioPath('/settings')).toBe(false);
    expect(isPublicBioPath('/auth/oauth/apple/redirect')).toBe(false);
    expect(bioParamDecision('dashboard')).toBeNull();
    expect(bioParamDecision('schedule')).toBeNull();
    expect(bioParamDecision('about')).toBeNull();
    expect(isPublicBioPath('/about')).toBe(true);
    expect(isPublicBioPath('/dashboard')).toBe(false);
  });
});

type RoutePattern = { segments: string[]; file: string };

function configBlock(name: string, until: string) {
  const text = readFileSync(NEXT_CONFIG, 'utf8');
  const start = text.indexOf(`async ${name}()`);
  const end = text.indexOf(until, start + 1);
  return text.slice(start, end);
}

function quotedPairs(block: string) {
  const pairs: Array<{ source: string; destination: string }> = [];
  const re = /\{[^{}]*source:\s*'([^']+)'[^{}]*destination:\s*'([^']+)'[^{}]*\}/g;
  for (const match of block.matchAll(re)) {
    pairs.push({ source: match[1], destination: match[2] });
  }
  return pairs;
}

function sources(block: string) {
  return [...block.matchAll(/source:\s*'([^']+)'/g)].map((match) => match[1]);
}

function firstSegment(pathname: string) {
  return pathname.split('/').filter(Boolean)[0] || '';
}

function matchPattern(pattern: string, pathname: string) {
  const left = pattern.split('/').filter(Boolean);
  const right = pathname.split('/').filter(Boolean);
  const params: Record<string, string> = {};
  let index = 0;
  for (const part of left) {
    if (part.startsWith(':')) {
      const name = part.slice(1).replace(/[*+]$/, '');
      if (part.endsWith('*') || part.endsWith('+')) {
        const rest = right.slice(index);
        if (part.endsWith('+') && rest.length === 0) {
          return null;
        }
        params[name] = rest.join('/');
        index = right.length;
      } else if (index >= right.length) {
        return null;
      } else {
        params[name] = right[index];
        index += 1;
      }
    } else if (right[index] !== part) {
      return null;
    } else {
      index += 1;
    }
  }
  return index === right.length ? params : null;
}

function fill(destination: string, params: Record<string, string>) {
  let out = destination;
  for (const [key, value] of Object.entries(params)) {
    out = out.split(`:${key}*`).join(value).split(`:${key}+`).join(value).split(`:${key}`).join(value);
  }
  const path = '/' + out.split('/').filter(Boolean).join('/');
  return path === '/' ? '/' : path;
}

function lookup(pairs: Array<{ source: string; destination: string }>, pathname: string) {
  for (const pair of pairs) {
    const params = matchPattern(pair.source, pathname);
    if (params) {
      return fill(pair.destination, params);
    }
  }
  return '';
}

const REDIRECTS = quotedPairs(configBlock('redirects', 'async rewrites()'));
const REWRITES = quotedPairs(configBlock('rewrites', 'const sentryDsn'));

function browserPath(pathname: string) {
  let path = pathname.split('?')[0];
  let at = false;
  const seen = new Set<string>();
  for (let hop = 0; hop < 8 && !seen.has(path); hop += 1) {
    seen.add(path);
    const legacy = legacyRedirect(path);
    const next = legacy ? '' : lookup(REDIRECTS, path);
    const location = legacy?.location || next;
    if (!location) {
      break;
    }
    const bare = location.split('?')[0];
    if (bare.startsWith('/@') || bare.toLowerCase().startsWith('/%40')) {
      at = true;
    }
    path = bare;
  }
  return { path, at };
}

function internalPath(pathname: string) {
  let path = pathname;
  const seen = new Set<string>();
  for (let hop = 0; hop < 8 && !seen.has(path); hop += 1) {
    seen.add(path);
    const rewritten = lookup(REWRITES, path);
    if (!rewritten || rewritten === path) {
      break;
    }
    path = rewritten;
  }
  return path;
}

function walkRoutes(dir: string, parts: string[], out: RoutePattern[]) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const group = entry.name.startsWith('(') && entry.name.endsWith(')');
      const slot = entry.name.startsWith('@');
      walkRoutes(join(dir, entry.name), group || slot ? parts : [...parts, entry.name], out);
      continue;
    }
    if (parts.length === 0 && entry.name === 'robots.ts') {
      out.push({ segments: ['robots.txt'], file: 'robots.ts' });
    } else if (parts.length === 0 && entry.name === 'sitemap.ts') {
      out.push({ segments: ['sitemap.xml'], file: 'sitemap.ts' });
    } else if (parts.length === 0 && entry.name === 'manifest.ts') {
      out.push({ segments: ['manifest.webmanifest'], file: 'manifest.ts' });
    } else if (/^(page|route)\.(tsx|ts|jsx|js)$/.test(entry.name)) {
      out.push({ segments: parts, file: join(dir, entry.name) });
    }
  }
}

const ROUTES: RoutePattern[] = [];
walkRoutes(APP_DIR, [], ROUTES);

function score(pattern: string[], segments: string[]) {
  let points = 0;
  let index = 0;
  for (const part of pattern) {
    const optional = part.startsWith('[[...') && part.endsWith(']]');
    const catchAll = !optional && part.startsWith('[...') && part.endsWith(']');
    const dynamic = !optional && !catchAll && part.startsWith('[') && part.endsWith(']');
    if (optional) {
      points += 1;
      index = segments.length;
      continue;
    }
    if (catchAll) {
      if (index >= segments.length) {
        return -1;
      }
      points += 1;
      index = segments.length;
      continue;
    }
    if (index >= segments.length) {
      return -1;
    }
    if (dynamic) {
      points += 1;
      index += 1;
      continue;
    }
    if (part !== segments[index]) {
      return -1;
    }
    points += 10;
    index += 1;
  }
  return index === segments.length ? points : -1;
}

function matchRoute(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  let best: RoutePattern | null = null;
  let bestScore = -1;
  for (const route of ROUTES) {
    const points = score(route.segments, segments);
    if (points > bestScore) {
      best = route;
      bestScore = points;
    }
  }
  return bestScore >= 0 ? best : null;
}

function publicFile(pathname: string) {
  const file = join(PUBLIC_DIR, pathname);
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

function bioCatchAll(route: RoutePattern | null) {
  return !!route && route.segments.length === 1 && route.segments[0] === '[slug]' && route.file.includes('(bio)');
}

function resolvePath(pathname: string) {
  const browser = browserPath(pathname);
  const internal = internalPath(browser.path);
  if (publicFile(internal)) {
    return { status: 200, at: browser.at, handler: internal };
  }
  const route = matchRoute(internal);
  if (!route || (bioCatchAll(route) && isReservedSlug(internal.slice(1)))) {
    return { status: 404, at: browser.at, handler: 'not-found' };
  }
  return { status: 200, at: browser.at, handler: route.file };
}

describe('reserved paths', () => {
  const names = RESERVED_PATHS.map((entry) => entry.name);

  it('keeps one shared list', () => {
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual([...names].sort());
  });

  it('reserved paths never redirect to /@slug', () => {
    for (const name of names) {
      const moved = legacyRedirect('/' + name);
      const location = moved?.location.split('?')[0] ?? '';
      expect(location.startsWith('/@') || location.toLowerCase().startsWith('/%40')).toBe(false);
      expect(bioParamDecision(name)?.action).not.toBe('redirect');
      expect(resolvePath('/' + name).at).toBe(false);
    }
  });

  it('every reserved path resolves to a non-404 route', () => {
    for (const entry of RESERVED_PATHS) {
      const resolved = resolvePath('/' + entry.name);
      expect(resolved.at).toBe(false);
      // A blocked username, or a prefix whose exact URL has no document,
      // stays on the not-found page. It is not sent to a bio.
      if (entry.kind === 'block' || entry.kind === 'namespace') {
        expect(resolved).toEqual({ status: 404, at: false, handler: 'not-found' });
        continue;
      }
      expect(resolved.status).not.toBe(404);
    }
  });

  it('resolves /stalker/preview', () => {
    const resolved = resolvePath('/stalker/preview');
    expect(resolved.status).not.toBe(404);
    expect(resolved.at).toBe(false);
    expect(resolved.handler).toContain('stalker-preview');
    expect(browserPath('/stalker/preview').path).toBe('/stalker/preview');
  });

  it('sends /dashboard to the schedule document', () => {
    expect(browserPath('/dashboard').path).toBe('/schedule');
    const resolved = resolvePath('/dashboard');
    expect(resolved.status).not.toBe(404);
    expect(resolved.handler).toContain('launches');
  });

  it('derives the exclusion from the app routes so a new page cannot be shadowed', () => {
    const segments = new Set<string>();
    for (const route of ROUTES) {
      const segment = route.segments[0];
      if (segment && !segment.startsWith('[')) {
        segments.add(segment);
      }
    }
    for (const source of [
      ...sources(configBlock('rewrites', 'const sentryDsn')),
      ...sources(configBlock('redirects', 'async rewrites()')),
    ]) {
      const segment = firstSegment(source);
      if (segment && !segment.startsWith(':')) {
        segments.add(segment);
      }
    }
    for (const segment of segments) {
      const entry = RESERVED_PATHS.find((item) => item.name === segment);
      expect(entry?.kind).not.toBe('block');
      expect(isReservedSlug(segment)).toBe(true);
    }
  });
});
