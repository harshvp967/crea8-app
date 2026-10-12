import {
  blockState,
  buildAnalytics,
  domainProblem,
  emailProblem,
  fillDays,
  formatRate,
  isPaidPlan,
  hasCustomDomainAddon,
  leadsToCsv,
  mapHostnameStatus,
  pageUrl,
  rangeWindow,
  sanitizeReferrer,
  showBadge,
  slugProblem,
  sourceLabel,
  suggestSlug,
  urlProblem,
  utcToZonedInput,
  zonedLocalToUtc,
} from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.rules';

describe('link-in-bio slug and domain rules', () => {
  it('rejects reserved, short and oddly punctuated usernames', () => {
    expect(slugProblem('auth')).toMatch(/reserved/);
    expect(slugProblem('api')).toMatch(/reserved/);
    expect(slugProblem('admin')).toMatch(/reserved/);
    expect(slugProblem('docs')).toMatch(/reserved/);
    expect(slugProblem('p')).toMatch(/reserved/);
    expect(slugProblem('ab')).toMatch(/3 to 30/);
    expect(slugProblem('settings')).toMatch(/reserved/);
    expect(slugProblem('link')).toMatch(/reserved/);
    expect(slugProblem('bio-host')).toMatch(/reserved/);
    expect(slugProblem('robots.txt')).toMatch(/reserved/);
    expect(slugProblem('pricing')).toMatch(/reserved/);
    expect(slugProblem('privacy')).toMatch(/reserved/);
    expect(slugProblem('terms')).toMatch(/reserved/);
    expect(slugProblem('refund-policy')).toMatch(/reserved/);
    expect(slugProblem('about')).toMatch(/reserved/);
    expect(slugProblem('contact')).toMatch(/reserved/);
    expect(slugProblem('features')).toMatch(/reserved/);
    expect(slugProblem('blog')).toMatch(/reserved/);
    expect(slugProblem('ab')).toMatch(/3 to 30/);
    expect(slugProblem('1abc')).toMatch(/letter/);
    expect(slugProblem('my..page')).toMatch(/dot or underscore/);
    expect(slugProblem('crea8.one')).toBeNull();
  });

  it('suggests a usable slug from the organization name', () => {
    expect(suggestSlug('Crea8 One', 'org')).toBe('crea8one');
    expect(slugProblem(suggestSlug('auth', 'abc-123'))).toBeNull();
  });

  it('rejects crea8.one and incomplete domains', () => {
    expect(domainProblem('links.yourbrand.com')).toBeNull();
    expect(domainProblem('crea8.one')).toMatch(/own/);
    expect(domainProblem('app.crea8.one')).toMatch(/own/);
    expect(domainProblem('localhost')).toMatch(/domain/);
    expect(domainProblem('not a domain')).toMatch(/domain/);
  });

  it('accepts only http(s) links and normal emails', () => {
    expect(urlProblem('https://crea8.one/changelog')).toBeNull();
    expect(urlProblem('javascript:alert(1)')).toMatch(/http/);
    expect(emailProblem('ana@example.com')).toBeNull();
    expect(emailProblem('not-an-email')).toMatch(/email/);
  });
});

describe('link-in-bio plan gate and schedule', () => {
  it('treats a priced or unknown tier as paid and a missing subscription as free', () => {
    expect(isPaidPlan(null)).toBe(false);
    expect(isPaidPlan({ subscriptionTier: 'FREE' })).toBe(false);
    expect(isPaidPlan({ subscriptionTier: 'STANDARD' })).toBe(true);
    expect(isPaidPlan({ subscriptionTier: 'PRO', isLifetime: false })).toBe(true);
    expect(isPaidPlan({ subscriptionTier: 'CREATOR' })).toBe(true);
    expect(isPaidPlan({ subscriptionTier: 'STANDARD', deletedAt: new Date() })).toBe(false);
    expect(isPaidPlan({ subscriptionTier: 'FREE', isLifetime: true })).toBe(true);
  });

  it('keeps the badge unless a paid page hid it', () => {
    expect(showBadge(true, false)).toBe(true);
    expect(showBadge(true, true)).toBe(false);
    expect(showBadge(false, true)).toBe(true);
  });

  it('treats a custom domain as an organization add-on, separate from the plan', () => {
    expect(hasCustomDomainAddon(null)).toBe(false);
    expect(hasCustomDomainAddon({})).toBe(false);
    expect(hasCustomDomainAddon({ customDomainAddon: false })).toBe(false);
    expect(hasCustomDomainAddon({ customDomainAddon: true })).toBe(true);
    expect(isPaidPlan({ subscriptionTier: 'PRO' })).toBe(true);
  });

  it('hides a link before it starts and after it ends, and keeps it in the editor', () => {
    const now = new Date('2026-10-12T12:00:00.000Z');
    expect(
      blockState(
        { enabled: true, scheduleOn: true, startsAt: '2026-10-13T00:00:00.000Z', endsAt: null },
        now
      )
    ).toBe('scheduled');
    expect(
      blockState(
        {
          enabled: true,
          scheduleOn: true,
          startsAt: '2026-10-01T00:00:00.000Z',
          endsAt: '2026-10-10T00:00:00.000Z',
        },
        now
      )
    ).toBe('ended');
    expect(
      blockState(
        {
          enabled: true,
          scheduleOn: true,
          startsAt: '2026-10-01T00:00:00.000Z',
          endsAt: '2026-11-01T00:00:00.000Z',
        },
        now
      )
    ).toBe('live');
    expect(blockState({ enabled: false, scheduleOn: false }, now)).toBe('hidden');
  });

  it('stores schedule times as UTC from the page timezone', () => {
    const utc = zonedLocalToUtc('2026-10-12T09:00', 'Asia/Kolkata');
    expect(utc?.toISOString()).toBe('2026-10-12T03:30:00.000Z');
    expect(utcToZonedInput(utc as Date, 'Asia/Kolkata')).toBe('2026-10-12T09:00');
  });
});

describe('link-in-bio analytics and leads', () => {
  it('aggregates a window without inventing visitors', () => {
    const now = new Date('2026-10-12T18:00:00.000Z');
    const window = rangeWindow('7d', now);
    expect(window.days).toBe(7);
    const series = fillDays(window.from, window.to, [
      { day: '2026-10-12T00:00:00.000Z', type: 'VIEW', count: 10 },
      { day: '2026-10-12T00:00:00.000Z', type: 'CLICK', count: 4 },
    ]);
    expect(series[series.length - 1]).toEqual({ day: '2026-10-12', views: 10, clicks: 4 });
    expect(series[0].views).toBe(0);
    const report = buildAnalytics({
      views: 100,
      clicks: 34,
      subscribers: 8,
      previousViews: 50,
      previousClicks: 10,
      previousSubscribers: 4,
      series,
      links: [{ id: 'a', title: 'Try crea8.one free', clicks: 20 }],
      countries: [{ code: 'IN', views: 24 }, { code: 'US', views: 22 }],
      sources: [{ source: 'Instagram', views: 34 }, { source: 'Direct', views: 10 }],
    });
    expect(report.ctr).toBe(34);
    expect(report.deltas.views).toBe(100);
    expect(report.topLinks[0].ctr).toBe(20);
    expect(report.countries[0].name).toBe('India');
    expect(report.sources[0].share).toBe(77);
    expect(formatRate(7.14)).toBe('7.1%');
    expect(formatRate(34)).toBe('34%');
  });

  it('labels referrers without keeping the query string', () => {
    expect(sourceLabel({ utmSource: 'instagram' })).toBe('Instagram');
    expect(sourceLabel({ referrer: 'https://l.instagram.com/path?user=secret' })).toBe('Instagram');
    expect(sourceLabel({})).toBe('Direct');
    expect(sanitizeReferrer('https://example.com/a?token=secret')).toBe('https://example.com/a');
    expect(sanitizeReferrer('javascript:alert(1)')).toBe('');
  });

  it('writes the lead CSV columns and escapes commas', () => {
    const csv = leadsToCsv([
      {
        email: 'ana@example.com',
        capturedAt: '2026-10-08T00:00:00.000Z',
        sourceBlock: 'Email capture',
        slug: 'crea8one',
        country: 'Brazil',
        referrer: 'https://instagram.com/a',
      },
      {
        email: 'a,b@example.com',
        capturedAt: '2026-10-08T00:00:00.000Z',
        sourceBlock: 'Say "hi"',
        slug: 'crea8one',
        country: '',
        referrer: '',
      },
    ]);
    expect(csv.split('\n')[0]).toBe('email,captured_at,source block,page slug,country,referrer');
    expect(csv).toContain('"a,b@example.com"');
    expect(csv).toContain('"Say ""hi"""');
  });

  it('maps Cloudflare hostname states and prefers the custom domain when it is live', () => {
    expect(mapHostnameStatus({ status: 'pending', sslStatus: 'initializing' })).toBe('WAITING');
    expect(mapHostnameStatus({ status: 'pending', sslStatus: 'pending_validation' })).toBe('VERIFYING');
    expect(mapHostnameStatus({ status: 'active', sslStatus: 'active' })).toBe('LIVE');
    expect(mapHostnameStatus({ status: 'blocked', sslStatus: 'active' })).toBe('ERROR');
    expect(pageUrl('crea8one', 'links.yourbrand.com', 'LIVE')).toBe('https://links.yourbrand.com');
    expect(pageUrl('crea8one', 'links.yourbrand.com', 'WAITING')).toBe('https://crea8.one/crea8one');
  });
});
