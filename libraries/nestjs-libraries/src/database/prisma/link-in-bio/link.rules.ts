import { pricing } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';

export const LINK_BLOCK_CAP = 2000;
export const LINK_THEMES = [
  { id: 'midnight', label: 'Midnight' },
  { id: 'paper', label: 'Paper' },
  { id: 'sand', label: 'Sand' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'bloom', label: 'Bloom' },
] as const;
export const LINK_BUTTONS = [
  { id: 'pill', label: 'Pill' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'square', label: 'Square' },
] as const;
export const LINK_FONTS = ['Plus Jakarta Sans'] as const;
export const LINK_SOCIALS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'x', label: 'X' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'website', label: 'Website' },
] as const;
export const LINK_RANGES = ['7d', '30d', '90d', '12m'] as const;

const RESERVED = new Set([
  'admin',
  'agents',
  'analytics',
  'api',
  'app',
  'assets',
  'auth',
  'billing',
  'bio',
  'bio-host',
  'blog',
  'calendar',
  'confirm',
  'copilot',
  'dashboard',
  'data-deletion',
  'docs',
  'domain',
  'editor',
  'err',
  'favicon.ico',
  'help',
  'home',
  'index',
  'integrations',
  'invite',
  'launches',
  'leads',
  'legal',
  'link',
  'links',
  'login',
  'logout',
  'mail',
  'manifest.webmanifest',
  'media',
  'modal',
  'oauth',
  'onboarding',
  'p',
  'plugs',
  'postiz',
  'pricing',
  'privacy',
  'provider',
  'public',
  'robots.txt',
  'settings',
  'share',
  'sitemap.xml',
  'signup',
  'stalker',
  'stalker-preview',
  'static',
  'status',
  'subscribe',
  'support',
  'terms',
  'third-party',
  'uploads',
  'waitlist',
  'www',
]);

export type BlockScheduleState = 'live' | 'scheduled' | 'ended' | 'hidden';
export type LinkPlan = {
  subscriptionTier?: string | null;
  isLifetime?: boolean | null;
  deletedAt?: Date | string | null;
} | null;

const SOURCE_HOSTS: Array<[RegExp, string]> = [
  [/(^|\.)instagram\.com$/i, 'Instagram'],
  [/(^|\.)x\.com$/i, 'X'],
  [/(^|\.)twitter\.com$/i, 'X'],
  [/(^|\.)t\.co$/i, 'X'],
  [/(^|\.)youtube\.com$/i, 'YouTube'],
  [/(^|\.)youtu\.be$/i, 'YouTube'],
  [/(^|\.)linkedin\.com$/i, 'LinkedIn'],
  [/(^|\.)tiktok\.com$/i, 'TikTok'],
  [/(^|\.)facebook\.com$/i, 'Facebook'],
  [/(^|\.)fb\.com$/i, 'Facebook'],
  [/(^|\.)reddit\.com$/i, 'Reddit'],
  [/(^|\.)pinterest\.com$/i, 'Pinterest'],
  [/(^|\.)threads\.net$/i, 'Threads'],
  [/(^|\.)google\.[a-z.]+$/i, 'Google'],
  [/(^|\.)bing\.com$/i, 'Bing'],
];

const PLATFORMS: Record<string, string> = {
  x: 'X',
  twitter: 'X',
  instagram: 'Instagram',
  'instagram-standalone': 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  'linkedin-page': 'LinkedIn',
  tiktok: 'TikTok',
  threads: 'Threads',
  reddit: 'Reddit',
  pinterest: 'Pinterest',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  discord: 'Discord',
  slack: 'Slack',
  wordpress: 'WordPress',
};

export function isReservedSlug(slug: string) {
  return RESERVED.has(slug);
}

export function slugProblem(raw: string): string | null {
  const slug = raw.trim().toLowerCase();
  if (RESERVED.has(slug)) {
    return 'That username is reserved';
  }
  if (slug.length < 3 || slug.length > 30) {
    return 'Use 3 to 30 characters';
  }
  if (!/^[a-z0-9._]+$/.test(slug)) {
    return 'Use letters, numbers, dots and underscores';
  }
  if (!/^[a-z]/.test(slug)) {
    return 'Start with a letter';
  }
  if (/[._]{2,}|[._]$/.test(slug)) {
    return "Don't end with a dot or underscore, or repeat them";
  }
  return null;
}

export function suggestSlug(name: string, organizationId: string) {
  const compact = (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24);
  if (!slugProblem(compact)) {
    return compact;
  }
  const fallback = ('c' + organizationId.replace(/[^a-z0-9]/gi, '')).toLowerCase().slice(0, 12);
  return slugProblem(fallback) ? 'page' : fallback;
}

export function domainProblem(raw: string): string | null {
  const host = raw.trim().toLowerCase().replace(/\.$/, '');
  if (!host || host.length > 253 || !host.includes('.')) {
    return 'Enter a domain like links.yourbrand.com';
  }
  if (host === 'crea8.one' || host.endsWith('.crea8.one') || host === 'localhost') {
    return 'Use a domain you own';
  }
  if (!/^[a-z0-9.-]+$/.test(host) || host.includes('..') || host.startsWith('.') || host.startsWith('-')) {
    return 'Enter a valid domain';
  }
  return null;
}

export function urlProblem(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return 'Use an http or https link';
    }
    return null;
  } catch {
    return 'Enter a valid URL';
  }
}

export function emailProblem(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    return 'Enter a valid email';
  }
  return null;
}

export function isPaidPlan(subscription?: LinkPlan) {
  if (!subscription || subscription.deletedAt) {
    return false;
  }
  if (subscription.isLifetime) {
    return true;
  }
  const tier = subscription.subscriptionTier || 'FREE';
  if (!tier || tier === 'FREE') {
    return false;
  }
  const plan = pricing[tier];
  if (!plan) {
    return true;
  }
  return plan.month_price > 0;
}

export function showBadge(hideBadge: boolean, paid: boolean) {
  return !(hideBadge && paid);
}

export function blockState(
  block: {
    enabled: boolean;
    scheduleOn: boolean;
    startsAt?: Date | string | null;
    endsAt?: Date | string | null;
  },
  now = new Date()
): BlockScheduleState {
  if (!block.enabled) {
    return 'hidden';
  }
  if (!block.scheduleOn) {
    return 'live';
  }
  const start = block.startsAt ? new Date(block.startsAt) : null;
  const end = block.endsAt ? new Date(block.endsAt) : null;
  if (start && now < start) {
    return 'scheduled';
  }
  if (end && now >= end) {
    return 'ended';
  }
  return 'live';
}

export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

function zoneParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '00';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') === '24' ? '00' : get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

function zoneOffsetMs(date: Date, timeZone: string) {
  const parts = zoneParts(date, timeZone);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - date.getTime();
}

export function zonedLocalToUtc(local: string, timeZone: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec((local || '').trim());
  if (!match || !isValidTimeZone(timeZone)) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    return null;
  }
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const utc = new Date(guess.getTime() - zoneOffsetMs(guess, timeZone));
  return new Date(guess.getTime() - zoneOffsetMs(utc, timeZone));
}

export function utcToZonedInput(date: Date, timeZone: string) {
  const parts = zoneParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function scheduleLabel(kind: 'Starts' | 'Ends', date: Date, timeZone: string) {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => formatted.find((part) => part.type === type)?.value || '';
  return `${kind} ${get('month')} ${get('day')}, ${get('year')} · ${get('hour')}:${get('minute')} ${get('dayPeriod')}`;
}

export function shortDate(date: Date, timeZone: string, now = new Date()) {
  const year = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric' });
  const sameYear = year.format(date) === year.format(now);
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date);
}

export function plainText(value: string, max = 140) {
  return (value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function firstImage(raw: string | null | undefined) {
  if (!raw) {
    return '';
  }
  try {
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    const found = list.find((item) => item && typeof item.path === 'string' && item.path);
    return found?.path || '';
  } catch {
    return raw.startsWith('http') ? raw : '';
  }
}

export function platformLabel(identifier: string) {
  const key = (identifier || '').toLowerCase();
  if (PLATFORMS[key]) {
    return PLATFORMS[key];
  }
  const head = key.split('-')[0];
  if (PLATFORMS[head]) {
    return PLATFORMS[head];
  }
  if (!key) {
    return 'Post';
  }
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function publicAsset(path: string) {
  if (!path) {
    return '';
  }
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const origin = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  if (!origin) {
    return path;
  }
  return origin + (path.startsWith('/') ? path : `/${path}`);
}

export function publicOrigin() {
  return (process.env.LINK_PUBLIC_ORIGIN || 'https://crea8.one').replace(/\/$/, '');
}

export function pageUrl(slug: string, customDomain: string, domainStatus: string) {
  if (customDomain && domainStatus === 'LIVE') {
    return `https://${customDomain}`;
  }
  return `${publicOrigin()}/${slug}`;
}

export function cleanCountry(value: string) {
  const code = (value || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code) || code === 'XX' || code === 'T1') {
    return '';
  }
  return code;
}

export function countryName(code: string) {
  if (!code) {
    return '';
  }
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
}

export function sanitizeReferrer(value: string) {
  if (!value) {
    return '';
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return '';
    }
    const path = url.pathname === '/' ? '' : url.pathname.slice(0, 200);
    return `${url.origin}${path}`.slice(0, 300);
  } catch {
    return '';
  }
}

export function sourceLabel(input: { utmSource?: string; referrer?: string }) {
  const utm = (input.utmSource || '').trim().slice(0, 80);
  if (utm) {
    const known = SOURCE_HOSTS.find(([, label]) => label.toLowerCase() === utm.toLowerCase());
    return known ? known[1] : utm;
  }
  const referrer = sanitizeReferrer(input.referrer || '');
  if (!referrer) {
    return 'Direct';
  }
  let host = '';
  try {
    host = new URL(referrer).hostname.replace(/^www\./, '');
  } catch {
    return 'Direct';
  }
  const found = SOURCE_HOSTS.find(([pattern]) => pattern.test(host));
  return found ? found[1] : host.slice(0, 80);
}

export function utcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function rangeWindow(range: string, now = new Date()) {
  const days = range === '7d' ? 7 : range === '90d' ? 90 : range === '12m' ? 365 : 30;
  const to = now;
  const from = new Date(now.getTime() - days * 86400000);
  const previousFrom = new Date(from.getTime() - days * 86400000);
  return { from, to, previousFrom, days };
}

export function fillDays(
  from: Date,
  to: Date,
  rows: Array<{ day: Date | string; type: 'VIEW' | 'CLICK'; count: number }>
) {
  const map = new Map<string, { views: number; clicks: number }>();
  for (const row of rows) {
    const key = new Date(row.day).toISOString().slice(0, 10);
    const current = map.get(key) || { views: 0, clicks: 0 };
    if (row.type === 'VIEW') {
      current.views += row.count;
    } else {
      current.clicks += row.count;
    }
    map.set(key, current);
  }
  const out: Array<{ day: string; views: number; clicks: number }> = [];
  const cursor = utcDay(from);
  const end = utcDay(to);
  while (cursor.getTime() <= end.getTime()) {
    const key = cursor.toISOString().slice(0, 10);
    out.push({ day: key, ...(map.get(key) || { views: 0, clicks: 0 }) });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

export function percentDelta(current: number, previous: number): number | null {
  if (previous <= 0) {
    return null;
  }
  return Math.round(((current - previous) / previous) * 100);
}

export function buildAnalytics(input: {
  views: number;
  clicks: number;
  subscribers: number;
  previousViews: number;
  previousClicks: number;
  previousSubscribers: number;
  series: Array<{ day: string; views: number; clicks: number }>;
  links: Array<{ id: string; title: string; clicks: number }>;
  countries: Array<{ code: string; views: number }>;
  sources: Array<{ source: string; views: number }>;
}) {
  const ctr = input.views ? (input.clicks / input.views) * 100 : 0;
  const previousCtr = input.previousViews ? (input.previousClicks / input.previousViews) * 100 : 0;
  const countryTotal = input.countries.reduce((sum, row) => sum + row.views, 0);
  const sourceTotal = input.sources.reduce((sum, row) => sum + row.views, 0);
  return {
    views: input.views,
    clicks: input.clicks,
    subscribers: input.subscribers,
    ctr,
    deltas: {
      views: percentDelta(input.views, input.previousViews),
      clicks: percentDelta(input.clicks, input.previousClicks),
      subscribers: percentDelta(input.subscribers, input.previousSubscribers),
      ctr: input.previousViews ? Math.round((ctr - previousCtr) * 10) / 10 : null,
    },
    series: input.series,
    topLinks: [...input.links]
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 5)
      .map((link) => ({
        ...link,
        ctr: input.views ? (link.clicks / input.views) * 100 : 0,
      })),
    countries: [...input.countries]
      .sort((a, b) => b.views - a.views)
      .slice(0, 5)
      .map((row) => ({
        code: row.code,
        name: countryName(row.code),
        views: row.views,
        share: countryTotal ? Math.round((row.views / countryTotal) * 100) : 0,
      })),
    sources: [...input.sources]
      .sort((a, b) => b.views - a.views)
      .slice(0, 6)
      .map((row) => ({
        source: row.source || 'Direct',
        views: row.views,
        share: sourceTotal ? Math.round((row.views / sourceTotal) * 100) : 0,
      })),
  };
}

export function formatRate(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

export function csvCell(value: string) {
  const text = value ?? '';
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function leadsToCsv(
  rows: Array<{
    email: string;
    capturedAt: string;
    sourceBlock: string;
    slug: string;
    country: string;
    referrer: string;
  }>
) {
  const lines = [['email', 'captured_at', 'source block', 'page slug', 'country', 'referrer'].join(',')];
  for (const row of rows) {
    lines.push(
      [row.email, row.capturedAt, row.sourceBlock, row.slug, row.country, row.referrer].map(csvCell).join(',')
    );
  }
  return lines.join('\n') + '\n';
}

export function mapHostnameStatus(input: { status?: string; sslStatus?: string } | null) {
  if (!input) {
    return 'ERROR' as const;
  }
  const status = (input.status || '').toLowerCase();
  const ssl = (input.sslStatus || '').toLowerCase();
  if (['moved', 'deleted', 'blocked'].includes(status) || ssl.includes('error') || ssl === 'failed') {
    return 'ERROR' as const;
  }
  if (status === 'active' && (ssl === 'active' || ssl === '')) {
    return 'LIVE' as const;
  }
  if (
    status === 'active' ||
    ['pending_validation', 'pending_issuance', 'pending_deployment'].includes(ssl)
  ) {
    return 'VERIFYING' as const;
  }
  return 'WAITING' as const;
}

export function domainRecords(input: {
  hostname: string;
  cnameTarget: string;
  txtName: string;
  txtValue: string;
}) {
  const labels = input.hostname.split('.');
  const rows = [
    {
      type: 'CNAME',
      name: labels.length > 2 ? labels[0] : '@',
      value: input.cnameTarget,
      ttl: 'Auto',
    },
  ];
  if (input.txtName && input.txtValue) {
    rows.push({ type: 'TXT', name: input.txtName, value: input.txtValue, ttl: 'Auto' });
  }
  return rows;
}

export function cnameName(hostname: string) {
  const labels = hostname.split('.');
  return labels.length > 2 ? labels[0] : '@';
}
