import {
  analyticsToCsv,
  blockState,
  buildAnalytics,
  captureUtm,
  clientLabel,
  contactDecision,
  customWindow,
  domainProblem,
  emailProblem,
  embedProblem,
  faviconFor,
  fillDays,
  formatRate,
  isPaidPlan,
  leadsToCsv,
  lockProblem,
  mapHostnameStatus,
  pageUrl,
  paidFeatureProblem,
  parseEmbed,
  parseRichText,
  presentPublicBlock,
  rangeWindow,
  sanitizeReferrer,
  showBadge,
  slugProblem,
  sourceLabel,
  suggestSlug,
  urlProblem,
  utcToZonedInput,
  webhookProblem,
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
    expect(csv.split('\n')[0]).toBe('email,captured_at,source block,page slug,country,referrer,kind,message');
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

describe('link-in-bio embeds', () => {
  it('turns allowlisted provider URLs into iframe sources', () => {
    expect(parseEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12')?.src).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
    );
    expect(parseEmbed('https://youtu.be/dQw4w9WgXcQ')?.provider).toBe('youtube');
    expect(parseEmbed('https://youtube.com/shorts/dQw4w9WgXcQ')?.src).toContain('/embed/dQw4w9WgXcQ');
    expect(parseEmbed('https://open.spotify.com/track/1234567890abcDEF123456')?.src).toBe(
      'https://open.spotify.com/embed/track/1234567890abcDEF123456'
    );
    expect(parseEmbed('https://open.spotify.com/embed/playlist/1234567890abcDEF123456')?.provider).toBe('spotify');
    expect(parseEmbed('https://soundcloud.com/artist/track-name')?.src).toContain(
      'https://w.soundcloud.com/player/?url='
    );
    expect(parseEmbed('https://vimeo.com/123456789')?.src).toBe('https://player.vimeo.com/video/123456789');
    expect(parseEmbed('https://player.vimeo.com/video/123456789')?.provider).toBe('vimeo');
  });

  it('rejects hosts and schemes outside the allowlist', () => {
    expect(parseEmbed('javascript:alert(1)')).toBeNull();
    expect(parseEmbed('https://evil.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(parseEmbed('https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(parseEmbed('https://notyoutube.com/embed/dQw4w9WgXcQ')).toBeNull();
    expect(parseEmbed('https://open.spotify.com/user/someone')).toBeNull();
    expect(parseEmbed('')).toBeNull();
    expect(embedProblem('https://example.com')).toMatch(/YouTube/);
  });
});

describe('link-in-bio paid gates and public blocks', () => {
  const link = {
    id: 'b1',
    type: 'LINK',
    title: 'Shop',
    url: 'https://example.com/drop',
    priority: false,
    thumbnail: '/uploads/icon.png',
    iconMode: 'upload',
    spotlight: true,
    lockType: 'PASSWORD',
  };

  it('keeps spotlight, locks, integrations and deep analytics on a paid plan', () => {
    expect(paidFeatureProblem(false, 'spotlight')).toMatch(/paid/);
    expect(paidFeatureProblem(false, 'lock')).toMatch(/paid/);
    expect(paidFeatureProblem(false, 'integrations')).toMatch(/paid/);
    expect(paidFeatureProblem(false, 'deepAnalytics')).toMatch(/paid/);
    expect(paidFeatureProblem(true, 'spotlight')).toBeNull();
    expect(isPaidPlan({ subscriptionTier: 'STANDARD' })).toBe(true);
  });

  it('hides the target URL until a lock is cleared and only animates spotlight when paid', () => {
    const free = presentPublicBlock(link, false);
    expect(free.url).toBe('');
    expect(free.lock).toBe('PASSWORD');
    expect(free.spotlight).toBe(false);
    expect(free.thumbnail).toBe('/uploads/icon.png');
    const open = presentPublicBlock({ ...link, lockType: 'NONE', iconMode: 'favicon' }, true);
    expect(open.url).toBe('https://example.com/drop');
    expect(open.spotlight).toBe(true);
    expect(open.thumbnail).toBe(faviconFor('https://example.com/drop'));
    expect(faviconFor('javascript:alert(1)')).toBe('');
  });

  it('asks for a password only when a password lock has no saved hash', () => {
    expect(lockProblem({ lockType: 'AGE' })).toBeNull();
    expect(lockProblem({ lockType: 'PASSWORD', hasHash: true })).toBeNull();
    expect(lockProblem({ lockType: 'PASSWORD', password: 'no' })).toMatch(/4 and 80/);
    expect(lockProblem({ lockType: 'PASSWORD', password: 'open' })).toBeNull();
  });

  it('parses rich text without keeping raw html', () => {
    const parts = parseRichText('Hello **there**\nSee [crea8](https://crea8.one/a) and <script>');
    expect(parts).toEqual([
      { type: 'text', text: 'Hello ' },
      { type: 'bold', text: 'there' },
      { type: 'break' },
      { type: 'text', text: 'See ' },
      { type: 'link', text: 'crea8', href: 'https://crea8.one/a' },
      { type: 'text', text: ' and <script>' },
    ]);
    expect(parseRichText('[x](javascript:alert(1))')[0].type).toBe('text');
  });

  it('drops honeypot contact posts and keeps real messages', () => {
    expect(contactDecision({ website: 'https://spam.test', email: 'a@b.co', message: 'hi' })).toBe('drop');
    expect(contactDecision({ email: 'nope', message: 'hi' })).toBe('invalid');
    expect(contactDecision({ email: 'a@b.co', message: '  ' })).toBe('invalid');
    expect(contactDecision({ email: 'a@b.co', message: 'Hello' })).toBe('ok');
  });

  it('rejects private webhook targets', () => {
    expect(webhookProblem('http://hooks.example.com/lead')).toMatch(/https/);
    expect(webhookProblem('https://localhost/hook')).toMatch(/public/);
    expect(webhookProblem('https://127.0.0.1/hook')).toMatch(/public/);
    expect(webhookProblem('https://10.1.2.3/hook')).toMatch(/public/);
    expect(webhookProblem('https://hooks.example.com/lead')).toBeNull();
  });
});

describe('link-in-bio deeper analytics rules', () => {
  it('labels device and browser and keeps UTM fields short', () => {
    expect(
      clientLabel(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      )
    ).toEqual({ device: 'mobile', browser: 'Safari' });
    expect(clientLabel('Mozilla/5.0 Chrome/120.0.0.0')).toEqual({ device: 'desktop', browser: 'Chrome' });
    expect(clientLabel('')).toEqual({ device: '', browser: '' });
    expect(captureUtm({ utmSource: 'instagram', utmMedium: 'story', utmCampaign: 'spring' })).toEqual({
      utmSource: 'instagram',
      utmMedium: 'story',
      utmCampaign: 'spring',
      utmContent: '',
      utmTerm: '',
    });
  });

  it('accepts a custom range up to a year and writes the analytics CSV', () => {
    expect(customWindow('2026-10-01', '2026-10-12')?.days).toBe(12);
    expect(customWindow('2026-10-12', '2026-10-01')).toBeNull();
    expect(customWindow('2020-01-01', '2026-01-01')).toBeNull();
    const csv = analyticsToCsv({
      links: [{ title: 'Shop, now', clicks: 4, ctr: 10 }],
      devices: [{ label: 'mobile', views: 8, share: 80 }],
      browsers: [{ label: 'Chrome', views: 5, share: 50 }],
      utm: [{ label: 'instagram / story / spring', views: 3, share: 30 }],
    });
    expect(csv.split('\n')[0]).toBe('kind,label,views,clicks,ctr,share');
    expect(csv).toContain('"Shop, now"');
    expect(csv).toContain('device,mobile,8,,,80%');
    expect(csv).toContain('utm,instagram / story / spring,3,,,30%');
  });
});
