import {
  KEPT_CALLBACKS,
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
      '/auth/logout',
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
