import {
  analyticsToCsv,
  applyVisitorRules,
  blockPriority,
  blockDeleteRequest,
  blockState,
  buildAnalytics,
  captureUtm,
  clientLabel,
  contactDecision,
  customWindow,
  designProKind,
  dobProblem,
  domainProblem,
  emailProblem,
  embedProblem,
  eventLabel,
  eventTime,
  faviconFor,
  fillDays,
  formatRate,
  isPaidPlan,
  hasCustomDomainAddon,
  knownRange,
  leadsToCsv,
  linkFeatureOpen,
  linkIsHidden,
  LINK_PLAN_GATING_ENABLED,
  lockProblem,
  mapHostnameStatus,
  mapProblem,
  normalizeDesign,
  normalizeEvents,
  pageUrl,
  paidFeatureProblem,
  parseCalendly,
  parseEmbed,
  parseMap,
  parseRichText,
  presentPublicBlock,
  rangeWindow,
  sanitizeReferrer,
  shareMenu,
  showBadge,
  slugProblem,
  sourceLabel,
  suggestSlug,
  themePalette,
  upcomingEvents,
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

  it('maps the preset ranges and keeps a year of history', () => {
    expect(rangeWindow('7d').days).toBe(7);
    expect(rangeWindow('28d').days).toBe(28);
    expect(rangeWindow('90d').days).toBe(90);
    expect(rangeWindow('365d').days).toBe(365);
    expect(rangeWindow('12m').days).toBe(365);
    expect(knownRange('nope')).toBe('28d');
  });
});

describe('link-in-bio v3 design, embeds and visitor rules', () => {
  it('keeps paid features open while the gating flag is off', () => {
    expect(linkFeatureOpen(null)).toBe(!LINK_PLAN_GATING_ENABLED);
    expect(linkFeatureOpen({ subscriptionTier: 'FREE' })).toBe(!LINK_PLAN_GATING_ENABLED);
    expect(linkFeatureOpen({ subscriptionTier: 'PRO' })).toBe(true);
    expect(isPaidPlan({ subscriptionTier: 'FREE' })).toBe(false);
  });

  it('marks pro themes, blur wallpaper and glass buttons', () => {
    const classic = normalizeDesign({ header: 'classic', wallpaper: 'fill', buttonFill: 'solid' });
    expect(designProKind('midnight', classic)).toBeNull();
    expect(designProKind('midnight', normalizeDesign({ header: 'hero' }))).toBe('layout');
    expect(designProKind('midnight', normalizeDesign({ wallpaper: 'blur' }))).toBe('wallpaper');
    expect(designProKind('midnight', normalizeDesign({ buttonFill: 'glass' }))).toBe('button');
    expect(designProKind('aurora', classic)).toBe('theme');
    expect(normalizeDesign({}).titleMode).toBe('text');
  });

  it('turns official post and booking URLs into embeds', () => {
    expect(parseEmbed('https://www.instagram.com/p/Abcde12/')?.src).toBe('https://www.instagram.com/p/Abcde12/embed');
    expect(parseEmbed('https://www.tiktok.com/@crea8/video/1234567890123456789')?.provider).toBe('tiktok');
    expect(parseEmbed('https://x.com/crea8/status/1234567890')?.src).toContain('id=1234567890');
    expect(parseEmbed('https://bsky.app/profile/crea8.bsky.social/post/3kabcdefghij')).toEqual({
      provider: 'bluesky',
      src: 'https://embed.bsky.app/embed/crea8.bsky.social/app.bsky.feed.post/3kabcdefghij',
    });
    expect(parseEmbed('https://crea8.one/p/one-post')).toBeNull();
    expect(blockDeleteRequest('block-1')).toEqual({ path: '/link-in-bio/blocks/block-1', method: 'DELETE' });
    expect(parseEmbed('https://www.threads.net/@crea8/post/Abcde12')?.src).toBe(
      'https://www.threads.net/@crea8/post/Abcde12/embed'
    );
    expect(parseEmbed('https://vm.tiktok.com/short')?.provider).toBe('tiktok');
    expect(parseEmbed('https://www.tiktok.com/t/Zabc1234')?.src).toContain('tiktok.com');
    expect(parseEmbed('https://vt.tiktok.com/Zabc1234')?.provider).toBe('tiktok');
    expect(embedProblem('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'instagram')).toMatch(/Instagram/);
    expect(embedProblem('https://www.instagram.com/p/Abcde12/', 'instagram')).toBeNull();
    expect(embedProblem('https://example.com')).toMatch(/YouTube/);
    expect(parseMap('https://www.google.com/maps/place/Crea8+Studio')?.src).toContain('output=embed');
    expect(parseMap('https://maps.app.goo.gl/abc')?.provider).toBe('maps');
    expect(parseMap('https://www.google.com/maps/@12.9716,77.5946,15z')?.src).toContain('12.9716,77.5946');
    expect(mapProblem('https://maps.app.goo.gl/abc')).toBeNull();
    expect(themePalette('paper').button).toBe('#ffffff');
    expect(themePalette('paper').pageText).toBe('#161616');
    expect(parseCalendly('https://calendly.com/crea8/intro')?.src).toContain('hide_gdpr_banner=1');
    expect(parseCalendly('https://cal.com/crea8')).toBeNull();
  });

  it('keeps upcoming events and hides ones that already happened', () => {
    const events = normalizeEvents({
      events: [
        { title: 'Later', when: '2099-01-02T15:00', place: 'Hall', url: '' },
        { title: 'Earlier', when: '2000-01-02T15:00', place: '', url: '' },
        { title: 'Note', when: 'soon', place: 'Park', url: '' },
      ],
    });
    const visible = upcomingEvents(events, Date.UTC(2026, 9, 21, 12, 0), 'UTC');
    expect(visible.map((item) => item.title)).toEqual(['Later', 'Note']);
    expect(blockPriority('HEADING', { priority: true }, 'none')).toBe(true);
    expect(blockPriority('EMAIL_CAPTURE', { priority: false }, 'highlight')).toBe(false);
    expect(blockPriority('LINK', { priority: true }, 'none')).toBe(false);
    expect(blockPriority('LINK', { priority: false }, 'highlight')).toBe(true);
    expect(eventLabel('2099-01-02T15:00')).toBe('2 Jan 2099, 15:00');
    expect(eventLabel('soon')).toBe('soon');
    const ist = eventTime('2026-10-21T18:00', 'Asia/Kolkata');
    expect(ist).toBe(Date.UTC(2026, 9, 21, 12, 30));
  });

  it('opens the share menu when share is clicked', () => {
    const menu = shareMenu('https://crea8.one/harsh', 'Harsh');
    expect(menu.open).toBe(true);
    expect(menu.items).toEqual(['Copy link', 'X', 'WhatsApp', 'Facebook', 'LinkedIn', 'Email', 'QR code', 'More…']);
    expect(menu.links.x).toContain('twitter.com/intent/tweet');
    expect(menu.links.whatsapp).toContain('wa.me');
    expect(menu.links.facebook).toContain('facebook.com/sharer');
    expect(menu.links.linkedin).toContain('linkedin.com/sharing');
    expect(menu.links.email.startsWith('mailto:')).toBe(true);
  });

  it('applies the first matching visitor rule and checks a date of birth', () => {
    const rules = [
      { country: 'IN', platform: '', language: '', action: 'hide' as const, title: '', url: '' },
      { country: 'US', platform: 'Instagram', language: 'en', action: 'title' as const, title: 'Shop the drop', url: '' },
    ];
    expect(applyVisitorRules(rules, { country: 'IN', platform: 'Direct', language: 'en' }).action).toBe('hide');
    expect(applyVisitorRules(rules, { country: 'US', platform: 'Instagram', language: 'en-US' }).title).toBe('Shop the drop');
    expect(applyVisitorRules(rules, { country: 'US', platform: 'X', language: 'en' }).action).toBe('none');
    expect(linkIsHidden({ rules }, { country: 'IN', platform: '', language: '' })).toBe(true);
    const hidden = presentPublicBlock(
      {
        id: 'b1',
        type: 'LINK',
        title: 'Shop',
        url: 'https://example.com/drop',
        lockType: 'NONE',
        payload: { rules, priorityMode: 'redirect', animation: 'wiggle', layout: 'featured' },
      },
      false,
      { country: 'BR', platform: 'Direct', language: 'pt' }
    );
    expect(hidden.url).toBe('https://example.com/drop');
    expect(hidden.animation).toBe('none');
    expect(hidden.layout).toBe('classic');
    expect(hidden.priorityMode).toBe('none');
    expect(dobProblem('2015-01-01', 18, new Date('2026-10-12T00:00:00.000Z'))).toMatch(/18/);
    expect(dobProblem('1990-01-01', 18, new Date('2026-10-12T00:00:00.000Z'))).toBeNull();
    expect(lockProblem({ lockType: 'CODE', password: 'open' })).toBeNull();
    expect(lockProblem({ lockType: 'SENSITIVE' })).toBeNull();
  });
});
