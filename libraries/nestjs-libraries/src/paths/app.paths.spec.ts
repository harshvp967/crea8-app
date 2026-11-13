import {
  KEPT_CALLBACKS,
  bioParamDecision,
  isPublicBioPath,
  legacyRedirect,
} from '@gitroom/helpers/paths/app.paths';

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
  });
});
