import { pricing } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';

export const LINK_BLOCK_CAP = 2000;

/**
 * Flip this to true once payments are live.
 * While it is false, every Link-in-Bio feature stays unlocked, including
 * Pro themes and layouts and the existing paid markers (deeper analytics,
 * lead sync, badge removal, custom domain add-on).
 */
export const LINK_PLAN_GATING_ENABLED = false;

export const LINK_THEMES = [
  { id: 'midnight', label: 'Midnight', pro: false },
  { id: 'paper', label: 'Paper', pro: false },
  { id: 'sand', label: 'Sand', pro: false },
  { id: 'ocean', label: 'Ocean', pro: false },
  { id: 'bloom', label: 'Bloom', pro: false },
  { id: 'aurora', label: 'Aurora', pro: true },
  { id: 'noir', label: 'Noir', pro: true },
  { id: 'forest', label: 'Forest', pro: true },
  { id: 'sunset', label: 'Sunset', pro: true },
] as const;

/** Matches the theme variables in link.scss. Title follows page text. */
const THEME_PALETTE: Record<string, { background: string; button: string; buttonText: string; pageText: string; title: string }> = {
  midnight: { background: '#071418', button: '#17191c', buttonText: '#f4f4f5', pageText: '#f5f5f5', title: '#f5f5f5' },
  paper: { background: '#f6f3ee', button: '#ffffff', buttonText: '#161616', pageText: '#161616', title: '#161616' },
  sand: { background: '#e7d3b4', button: '#6b4a32', buttonText: '#fff8ef', pageText: '#2b2118', title: '#2b2118' },
  ocean: { background: '#071824', button: '#123041', buttonText: '#e7f6f8', pageText: '#e7f6f8', title: '#e7f6f8' },
  bloom: { background: '#f7e7ee', button: '#e11d74', buttonText: '#ffffff', pageText: '#2a1520', title: '#2a1520' },
  aurora: { background: '#12081f', button: '#24143a', buttonText: '#f6f1ff', pageText: '#f6f1ff', title: '#f6f1ff' },
  noir: { background: '#0e0e0e', button: '#f5f5f5', buttonText: '#111111', pageText: '#f5f5f5', title: '#f5f5f5' },
  forest: { background: '#102117', button: '#1d3b2c', buttonText: '#eef8f1', pageText: '#eef8f1', title: '#eef8f1' },
  sunset: { background: '#2a120c', button: '#4a2418', buttonText: '#fff7ed', pageText: '#fff7ed', title: '#fff7ed' },
};

export function themePalette(theme: string) {
  return THEME_PALETTE[theme] || THEME_PALETTE.midnight;
}
export const LINK_BUTTONS = [
  { id: 'pill', label: 'Pill' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'square', label: 'Square' },
] as const;
export const LINK_FONTS = ['Plus Jakarta Sans', 'Georgia', 'Palatino', 'Trebuchet MS', 'Courier New'] as const;
export const LINK_WALLPAPERS = ['fill', 'gradient', 'blur', 'pattern', 'video', 'motion'] as const;
export const LINK_PATTERNS = ['dots', 'grid', 'diagonal', 'waves'] as const;
export const LINK_BUTTON_FILLS = ['solid', 'glass', 'outline'] as const;
export const LINK_SHADOWS = ['none', 'soft', 'strong', 'hard'] as const;
export const LINK_HEADERS = ['classic', 'hero', 'banner', 'cutout', 'shape'] as const;
export const LINK_TITLE_MODES = ['text', 'logo'] as const;
export const LINK_SOCIAL_POSITIONS = ['top', 'bottom'] as const;
export const LINK_LAYOUTS = ['classic', 'featured'] as const;
export const LINK_ANIMATIONS = ['none', 'wiggle', 'pop', 'electricity', 'glitch', 'shimmer', 'bounce', 'pulse'] as const;
export const LINK_PRIORITY_MODES = ['none', 'highlight', 'expand', 'redirect'] as const;
export const LINK_RULE_ACTIONS = ['hide', 'title', 'url'] as const;
export const LINK_SOCIALS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'x', label: 'X' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'threads', label: 'Threads' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'bluesky', label: 'Bluesky' },
  { id: 'twitch', label: 'Twitch' },
  { id: 'pinterest', label: 'Pinterest' },
  { id: 'reddit', label: 'Reddit' },
  { id: 'website', label: 'Website' },
] as const;
export const LINK_RANGES = ['7d', '28d', '30d', '90d', '365d', '12m'] as const;

const RESERVED = new Set([
  'about',
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
  'careers',
  'changelog',
  'confirm',
  'contact',
  'copilot',
  'dashboard',
  'data-deletion',
  'docs',
  'domain',
  'editor',
  'err',
  'faq',
  'favicon.ico',
  'features',
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
  'press',
  'pricing',
  'privacy',
  'provider',
  'public',
  'refund-policy',
  'register',
  'robots.txt',
  'settings',
  'share',
  'signin',
  'signup',
  'sitemap.xml',
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

export function hasCustomDomainAddon(org?: { customDomainAddon?: boolean | null } | null) {
  return org?.customDomainAddon === true;
}

export function linkFeatureOpen(subscription?: LinkPlan) {
  return !LINK_PLAN_GATING_ENABLED || isPaidPlan(subscription);
}

export function linkDomainOpen(org?: { customDomainAddon?: boolean | null } | null) {
  return !LINK_PLAN_GATING_ENABLED || hasCustomDomainAddon(org);
}

export function themeIsPro(id: string) {
  return LINK_THEMES.find((item) => item.id === id)?.pro === true;
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
  const days =
    range === '7d'
      ? 7
      : range === '28d'
      ? 28
      : range === '90d'
      ? 90
      : range === '365d' || range === '12m'
      ? 365
      : range === '30d'
      ? 30
      : 28;
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
    kind?: string;
    message?: string;
  }>
) {
  const lines = [['email', 'captured_at', 'source block', 'page slug', 'country', 'referrer', 'kind', 'message'].join(',')];
  for (const row of rows) {
    lines.push(
      [row.email, row.capturedAt, row.sourceBlock, row.slug, row.country, row.referrer, row.kind || '', row.message || '']
        .map(csvCell)
        .join(',')
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

export const LINK_BLOCK_TYPES = [
  'LINK',
  'FEATURED_POST',
  'EMAIL_CAPTURE',
  'HEADING',
  'EMBED',
  'TEXT',
  'FAQ',
  'IMAGE_CAROUSEL',
  'CONTACT_FORM',
  'MAP',
  'CALENDLY',
  'CONTACT_DETAILS',
  'DISCOUNT',
  'EVENTS',
] as const;

export const LINK_LOCKS = ['NONE', 'AGE', 'EMAIL', 'PASSWORD', 'CODE', 'DOB', 'SENSITIVE'] as const;
export type LinkLock = (typeof LINK_LOCKS)[number];
export type EmbedProvider =
  | 'youtube'
  | 'spotify'
  | 'soundcloud'
  | 'vimeo'
  | 'instagram'
  | 'tiktok'
  | 'x'
  | 'bluesky'
  | 'threads'
  | 'maps'
  | 'calendly';
export type EmbedFrame = { provider: EmbedProvider; src: string };

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const SPOTIFY_KIND = new Set(['track', 'album', 'playlist', 'episode', 'show', 'artist']);
const SPOTIFY_ID = /^[A-Za-z0-9]{10,40}$/;

export type PaidFeature =
  | 'spotlight'
  | 'lock'
  | 'integrations'
  | 'deepAnalytics'
  | 'theme'
  | 'layout'
  | 'wallpaper'
  | 'button'
  | 'animation'
  | 'priority'
  | 'rules';

const PAID_COPY: Record<PaidFeature, string> = {
  spotlight: 'Spotlight is on a paid plan',
  lock: 'Locked links are on a paid plan',
  integrations: 'Lead integrations are on a paid plan',
  deepAnalytics: 'Deeper analytics are on a paid plan',
  theme: 'That theme is on a paid plan',
  layout: 'That layout is on a paid plan',
  wallpaper: 'That wallpaper is on a paid plan',
  button: 'Glass buttons are on a paid plan',
  animation: 'Link animations are on a paid plan',
  priority: 'That priority option is on a paid plan',
  rules: 'Visitor rules are on a paid plan',
};

export function paidFeatureProblem(paid: boolean, feature: PaidFeature) {
  return paid ? null : PAID_COPY[feature];
}

function httpUrl(raw: string) {
  try {
    const url = new URL((raw || '').trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    if (url.username || url.password) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function bareHost(hostname: string) {
  return hostname.replace(/^www\./, '').toLowerCase();
}

export function parseEmbed(raw: string): EmbedFrame | null {
  const url = httpUrl(raw);
  if (!url) {
    return null;
  }
  const host = bareHost(url.hostname);
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    let id = '';
    if (url.pathname === '/watch' || parts[0] === 'watch') {
      id = url.searchParams.get('v') || '';
    } else if (['embed', 'shorts', 'live', 'v'].includes(parts[0] || '')) {
      id = parts[1] || '';
    }
    if (!YOUTUBE_ID.test(id)) {
      return null;
    }
    return { provider: 'youtube', src: `https://www.youtube-nocookie.com/embed/${id}` };
  }
  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0] || '';
    if (!YOUTUBE_ID.test(id)) {
      return null;
    }
    return { provider: 'youtube', src: `https://www.youtube-nocookie.com/embed/${id}` };
  }
  if (host === 'open.spotify.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    const start = parts[0] === 'embed' ? 1 : 0;
    const kind = parts[start] || '';
    const id = (parts[start + 1] || '').split('?')[0];
    if (!SPOTIFY_KIND.has(kind) || !SPOTIFY_ID.test(id)) {
      return null;
    }
    return { provider: 'spotify', src: `https://open.spotify.com/embed/${kind}/${id}` };
  }
  if (host === 'soundcloud.com' || host === 'm.soundcloud.com' || host === 'on.soundcloud.com') {
    if (url.pathname.length < 2) {
      return null;
    }
    const canonicalHost = host === 'on.soundcloud.com' ? 'on.soundcloud.com' : 'soundcloud.com';
    const canonical = `https://${canonicalHost}${url.pathname}`;
    return {
      provider: 'soundcloud',
      src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(canonical)}&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`,
    };
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = url.pathname.split('/').filter((part) => /^\d{6,12}$/.test(part)).pop() || '';
    if (!id) {
      return null;
    }
    return { provider: 'vimeo', src: `https://player.vimeo.com/video/${id}` };
  }
  if (host === 'instagram.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    const kind = parts[0] || '';
    const code = parts[1] || '';
    if (!['p', 'reel', 'tv'].includes(kind) || !/^[A-Za-z0-9_-]{5,40}$/.test(code)) {
      return null;
    }
    return { provider: 'instagram', src: `https://www.instagram.com/${kind}/${code}/embed` };
  }
  if (host === 'tiktok.com' || host === 'vm.tiktok.com' || host === 'vt.tiktok.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    const id = host === 'tiktok.com' && parts[0] === 'embed' && parts[1] === 'v2' ? parts[2] || '' : parts[1] === 'video' ? parts[2] || '' : '';
    if (/^\d{8,22}$/.test(id)) {
      return { provider: 'tiktok', src: `https://www.tiktok.com/embed/v2/${id}` };
    }
    const short = tiktokShortCode(host, parts);
    if (short) {
      const share =
        host === 'tiktok.com' ? `https://www.tiktok.com/t/${short}` : `https://${host}/${short}`;
      return { provider: 'tiktok', src: `https://www.tiktok.com/embed/v2/?url=${encodeURIComponent(share)}` };
    }
    return null;
  }
  if (host === 'x.com' || host === 'twitter.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts[1] === 'status' ? parts[2] || '' : '';
    if (!/^\d{5,25}$/.test(id)) {
      return null;
    }
    return { provider: 'x', src: `https://platform.twitter.com/embed/Tweet.html?id=${id}` };
  }
  if (host === 'bsky.app') {
    const parts = url.pathname.split('/').filter(Boolean);
    const handle = parts[1] || '';
    const rkey = parts[3] || '';
    if (parts[0] !== 'profile' || parts[2] !== 'post' || !/^[A-Za-z0-9._:-]{1,80}$/.test(handle) || !/^[A-Za-z0-9]{3,30}$/.test(rkey)) {
      return null;
    }
    return { provider: 'bluesky', src: `https://embed.bsky.app/embed/${handle}/app.bsky.feed.post/${rkey}` };
  }
  if (host === 'threads.net' || host === 'threads.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    const user = (parts[0] || '').replace(/^@/, '');
    const code = parts[2] || '';
    if (parts[1] !== 'post' || !/^[A-Za-z0-9._]{1,40}$/.test(user) || !/^[A-Za-z0-9_-]{5,40}$/.test(code)) {
      return null;
    }
    return { provider: 'threads', src: `https://www.threads.net/@${user}/post/${code}/embed` };
  }
  return null;
}

export function parseMap(raw: string): EmbedFrame | null {
  const url = httpUrl(raw);
  if (!url) {
    return null;
  }
  const host = bareHost(url.hostname);
  if (host === 'maps.app.goo.gl' || host === 'goo.gl') {
    return mapShare(url);
  }
  if (host !== 'google.com' && host !== 'maps.google.com') {
    return null;
  }
  if (url.pathname.startsWith('/maps/embed')) {
    const pb = url.searchParams.get('pb') || '';
    const query = url.searchParams.get('q') || '';
    if (!pb && !query) {
      return null;
    }
    if (pb && !/^[\w!._~%-]+$/.test(pb)) {
      return null;
    }
    const src = new URL('https://www.google.com/maps/embed');
    if (pb) {
      src.searchParams.set('pb', pb);
    }
    if (query) {
      src.searchParams.set('q', query.slice(0, 200));
    }
    return { provider: 'maps', src: src.toString() };
  }
  const query = url.searchParams.get('q') || url.searchParams.get('query') || '';
  if (query) {
    return { provider: 'maps', src: `https://maps.google.com/maps?q=${encodeURIComponent(query.slice(0, 200))}&output=embed` };
  }
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] === 'maps' && (parts[1] === 'place' || parts[1] === 'search') && parts[2]) {
    const name = decodeURIComponent(parts[2]).replace(/\+/g, ' ').slice(0, 200);
    if (!name) {
      return null;
    }
    return { provider: 'maps', src: `https://maps.google.com/maps?q=${encodeURIComponent(name)}&output=embed` };
  }
  const at = url.pathname.match(/@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)(?:,(\d{1,2}(?:\.\d+)?)z)?/);
  if (at) {
    return mapPoint(at[1], at[2], at[3]);
  }
  return null;
}

function mapShare(url: URL): EmbedFrame | null {
  const host = bareHost(url.hostname);
  const parts = url.pathname.split('/').filter(Boolean);
  const code = host === 'goo.gl' ? parts[1] || '' : parts[0] || '';
  if (host === 'goo.gl' && parts[0] !== 'maps') {
    return null;
  }
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(code)) {
    return null;
  }
  const share = `${url.origin}${url.pathname}`;
  return { provider: 'maps', src: `https://maps.google.com/maps?q=${encodeURIComponent(share)}&output=embed` };
}

function mapPoint(latRaw: string, lngRaw: string, zoomRaw?: string): EmbedFrame | null {
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  const zoom = zoomRaw ? `&z=${Math.min(21, Math.max(1, Math.round(Number(zoomRaw))))}` : '';
  return { provider: 'maps', src: `https://maps.google.com/maps?q=${lat},${lng}${zoom}&output=embed` };
}

function tiktokShortCode(host: string, parts: string[]) {
  const code = host === 'vm.tiktok.com' || host === 'vt.tiktok.com' ? parts[0] || '' : host === 'tiktok.com' && parts[0] === 't' ? parts[1] || '' : '';
  return /^[A-Za-z0-9]{3,32}$/.test(code) ? code : '';
}

export function parseCalendly(raw: string): EmbedFrame | null {
  const url = httpUrl(raw);
  if (!url || bareHost(url.hostname) !== 'calendly.com') {
    return null;
  }
  const parts = url.pathname.split('/').filter(Boolean);
  if (!parts.length || parts.length > 3 || parts.some((part) => !/^[A-Za-z0-9_-]{1,80}$/.test(part))) {
    return null;
  }
  return { provider: 'calendly', src: `https://calendly.com/${parts.join('/')}?hide_gdpr_banner=1` };
}

export function pastedBlockType(raw: string): { type: 'LINK' | 'EMBED' | 'MAP' | 'CALENDLY'; provider: EmbedProvider | null } {
  if (parseMap(raw)) {
    return { type: 'MAP', provider: 'maps' };
  }
  if (parseCalendly(raw)) {
    return { type: 'CALENDLY', provider: 'calendly' };
  }
  const embed = parseEmbed(raw);
  if (embed) {
    return { type: 'EMBED', provider: embed.provider };
  }
  return { type: 'LINK', provider: null };
}

const EMBED_LABEL: Record<EmbedProvider, string> = {
  youtube: 'YouTube',
  spotify: 'Spotify',
  soundcloud: 'SoundCloud',
  vimeo: 'Vimeo',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  x: 'X',
  bluesky: 'Bluesky',
  threads: 'Threads',
  maps: 'Google Maps',
  calendly: 'Calendly',
};

export function embedProblem(raw: string, only?: EmbedProvider) {
  const label = only ? EMBED_LABEL[only] : '';
  if (!raw.trim()) {
    return only ? `Paste a ${label} post link` : 'Paste a YouTube, Spotify, SoundCloud, Vimeo, Instagram, TikTok, X, Bluesky or Threads link';
  }
  const frame = parseEmbed(raw);
  if (!frame) {
    return only ? `Use a ${label} post link` : 'Use a YouTube, Spotify, SoundCloud, Vimeo, Instagram, TikTok, X, Bluesky or Threads link';
  }
  if (only && frame.provider !== only) {
    return `Use a ${label} post link`;
  }
  return null;
}

export function mapProblem(raw: string) {
  if (!raw.trim()) {
    return 'Paste a Google Maps link';
  }
  if (!parseMap(raw)) {
    return 'Use a Google Maps place, search or embed link';
  }
  return null;
}

export function calendlyProblem(raw: string) {
  if (!raw.trim()) {
    return 'Paste a Calendly link';
  }
  if (!parseCalendly(raw)) {
    return 'Use a calendly.com link';
  }
  return null;
}

export function faviconFor(linkUrl: string) {
  const url = httpUrl(linkUrl);
  if (!url || !url.hostname || url.hostname === 'localhost') {
    return '';
  }
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url.hostname)}&sz=64`;
}

export function normalizeLock(value: string | null | undefined): LinkLock {
  const lock = (value || 'NONE').toUpperCase();
  return (LINK_LOCKS as readonly string[]).includes(lock) ? (lock as LinkLock) : 'NONE';
}

export function lockProblem(input: { lockType?: string; password?: string; hasHash?: boolean }) {
  const lock = normalizeLock(input.lockType);
  if (lock !== 'PASSWORD' && lock !== 'CODE') {
    return null;
  }
  const password = (input.password || '').trim();
  if (!password && input.hasHash) {
    return null;
  }
  if (password.length < 4 || password.length > 80) {
    return lock === 'CODE' ? 'Use a code between 4 and 80 characters' : 'Use a password between 4 and 80 characters';
  }
  return null;
}

export type RichPart =
  | { type: 'text' | 'bold' | 'italic'; text: string }
  | { type: 'break' }
  | { type: 'link'; text: string; href: string };

export function parseRichText(raw: string): RichPart[] {
  const source = (raw || '').replace(/\r\n/g, '\n').slice(0, 4000);
  const parts: RichPart[] = [];
  const pushText = (text: string) => {
    if (text) {
      parts.push({ type: 'text', text });
    }
  };
  let index = 0;
  while (index < source.length) {
    if (source[index] === '\n') {
      parts.push({ type: 'break' });
      index += 1;
      continue;
    }
    const rest = source.slice(index);
    const link = /^\[([^\]\n]{1,80})\]\((https?:\/\/[^\s)]+)\)/.exec(rest);
    if (link && httpUrl(link[2])) {
      parts.push({ type: 'link', text: link[1], href: httpUrl(link[2])!.toString() });
      index += link[0].length;
      continue;
    }
    const bold = /^\*\*([^*\n]{1,200})\*\*/.exec(rest);
    if (bold) {
      parts.push({ type: 'bold', text: bold[1] });
      index += bold[0].length;
      continue;
    }
    const italic = /^\*([^*\n]{1,200})\*/.exec(rest);
    if (italic) {
      parts.push({ type: 'italic', text: italic[1] });
      index += italic[0].length;
      continue;
    }
    const next = rest.slice(1).search(/[\n*[]/);
    const take = next < 0 ? rest.length : next + 1;
    pushText(rest.slice(0, take));
    index += take;
  }
  return parts;
}

export type FaqItem = { question: string; answer: string };
export type CarouselImage = { path: string; alt: string };
export type ContactForm = { heading: string; button: string; consent: string; askName: boolean };

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function normalizeFaq(payload: unknown): FaqItem[] {
  const items = Array.isArray(payload) ? payload : asRecord(payload).items;
  if (!Array.isArray(items)) {
    return [];
  }
  const out: FaqItem[] = [];
  for (const item of items) {
    const row = asRecord(item);
    const question = String(row.question || '').trim().slice(0, 160);
    const answer = String(row.answer || '').trim().slice(0, 800);
    if (question && answer) {
      out.push({ question, answer });
    }
    if (out.length === 12) {
      break;
    }
  }
  return out;
}

export function imagePathProblem(raw: string) {
  const path = (raw || '').trim();
  if (!path) {
    return 'Add an image';
  }
  if (path.startsWith('/') && !path.startsWith('//')) {
    return null;
  }
  return urlProblem(path);
}

export function normalizeImages(payload: unknown): CarouselImage[] {
  const items = Array.isArray(payload) ? payload : asRecord(payload).images;
  if (!Array.isArray(items)) {
    return [];
  }
  const out: CarouselImage[] = [];
  for (const item of items) {
    const row = asRecord(item);
    const path = String(row.path || '').trim().slice(0, 2000);
    if (imagePathProblem(path)) {
      continue;
    }
    out.push({ path, alt: String(row.alt || '').trim().slice(0, 140) });
    if (out.length === 12) {
      break;
    }
  }
  return out;
}

export function normalizeForm(input: { title?: string; body?: string; payload?: unknown }): ContactForm {
  const payload = asRecord(input.payload);
  return {
    heading: (input.title || String(payload.heading || '') || 'Get in touch').trim().slice(0, 120),
    button: (String(payload.button || 'Send') || 'Send').trim().slice(0, 40) || 'Send',
    consent: (input.body || String(payload.consent || '')).trim().slice(0, 240),
    askName: !!payload.askName,
  };
}

export function contactDecision(input: { website?: string; email?: string; message?: string }) {
  if ((input.website || '').trim()) {
    return 'drop' as const;
  }
  if (emailProblem(input.email || '')) {
    return 'invalid' as const;
  }
  const message = (input.message || '').trim();
  if (!message || message.length > 2000) {
    return 'invalid' as const;
  }
  return 'ok' as const;
}

export type PublicBlockInput = {
  id: string;
  type: string;
  title: string;
  url: string;
  body?: string;
  priority?: boolean;
  thumbnail?: string;
  iconMode?: string;
  spotlight?: boolean;
  lockType?: string;
  payload?: unknown;
};

export function presentPublicBlock(block: PublicBlockInput, paid: boolean, visitor?: VisitorContext, timeZone?: string) {
  const extras = block.type === 'LINK' ? normalizeLinkExtras(block.payload) : emptyLinkExtras();
  const effect = block.type === 'LINK' && visitor ? applyVisitorRules(extras.rules, visitor) : { action: 'none' as const, title: '', url: '' };
  const title = effect.action === 'title' && effect.title ? effect.title : block.title;
  const rawUrl = effect.action === 'url' && effect.url ? effect.url : block.url;
  const lock = block.type === 'LINK' ? normalizeLock(block.lockType) : 'NONE';
  const locked = lock !== 'NONE';
  const embed =
    block.type === 'EMBED'
      ? parseEmbed(block.url)
      : block.type === 'MAP'
      ? parseMap(block.url)
      : block.type === 'CALENDLY'
      ? parseCalendly(block.url)
      : null;
  const mode = block.iconMode === 'upload' || block.iconMode === 'favicon' ? block.iconMode : '';
  const thumbnail =
    block.type === 'LINK' && mode === 'upload'
      ? (block.thumbnail || '').trim()
      : block.type === 'LINK' && mode === 'favicon'
      ? faviconFor(rawUrl)
      : '';
  const open = paid;
  return {
    id: block.id,
    type: block.type,
    title,
    url: block.type === 'LINK' && !locked ? rawUrl : block.type === 'DISCOUNT' ? normalizeDiscount(block).url : '',
    embed,
    priority: !!block.priority,
    priorityMode: open ? extras.priorityMode : extras.priorityMode === 'highlight' ? 'highlight' : 'none',
    layout: block.type === 'LINK' && open && extras.layout === 'featured' ? 'featured' : 'classic',
    animation: block.type === 'LINK' && open ? extras.animation : 'none',
    expand: block.type === 'LINK' && open && extras.priorityMode === 'expand',
    spotlight: block.type === 'LINK' && !!block.spotlight && open,
    thumbnail,
    lock,
    body: block.type === 'TEXT' ? block.body || '' : '',
    faq: block.type === 'FAQ' ? normalizeFaq(block.payload) : [],
    images: block.type === 'IMAGE_CAROUSEL' ? normalizeImages(block.payload) : [],
    form: block.type === 'CONTACT_FORM' ? normalizeForm(block) : null,
    details: block.type === 'CONTACT_DETAILS' ? normalizeDetails(block.payload) : null,
    discount: block.type === 'DISCOUNT' ? normalizeDiscount(block) : null,
    events: block.type === 'EVENTS' ? upcomingEvents(normalizeEvents(block.payload), Date.now(), timeZone) : [],
  };
}

function ipv4Private(host: string) {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) {
    return false;
  }
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => part > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }
  return false;
}

export function webhookProblem(raw: string) {
  const url = httpUrl(raw);
  if (!url || url.protocol !== 'https:') {
    return 'Use an https webhook URL';
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host === '::1' ||
    ipv4Private(host)
  ) {
    return 'Use a public https webhook';
  }
  return null;
}

export function secretHint(value: string) {
  const text = (value || '').trim();
  if (text.length < 4) {
    return '';
  }
  return `••••${text.slice(-4)}`;
}

export function cleanUtm(value: string) {
  return (value || '').trim().replace(/[\r\n]/g, '').slice(0, 80);
}

export function captureUtm(input: {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}) {
  return {
    utmSource: cleanUtm(input.utmSource || ''),
    utmMedium: cleanUtm(input.utmMedium || ''),
    utmCampaign: cleanUtm(input.utmCampaign || ''),
    utmContent: cleanUtm(input.utmContent || ''),
    utmTerm: cleanUtm(input.utmTerm || ''),
  };
}

export function clientLabel(userAgent: string) {
  const ua = (userAgent || '').slice(0, 400);
  if (!ua) {
    return { device: '', browser: '' };
  }
  let device = 'desktop';
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
    device = 'tablet';
  } else if (/Mobi|iPhone|Android|Windows Phone/i.test(ua)) {
    device = 'mobile';
  }
  let browser = 'Other';
  if (/Edg\//.test(ua)) {
    browser = 'Edge';
  } else if (/OPR\/|Opera/.test(ua)) {
    browser = 'Opera';
  } else if (/Firefox\//.test(ua)) {
    browser = 'Firefox';
  } else if (/Chrome\//.test(ua)) {
    browser = 'Chrome';
  } else if (/Safari\//.test(ua)) {
    browser = 'Safari';
  }
  return { device, browser };
}

export function customWindow(from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(to || '')) {
    return null;
  }
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T23:59:59.999Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return null;
  }
  const span = end.getTime() - start.getTime();
  if (span > 366 * 86400000) {
    return null;
  }
  return { from: start, to: end, previousFrom: new Date(start.getTime() - span), days: Math.max(1, Math.ceil(span / 86400000)) };
}

export function shareRows(rows: Array<{ label: string; views: number }>, limit = 8) {
  const total = rows.reduce((sum, row) => sum + row.views, 0);
  return [...rows]
    .filter((row) => row.label && row.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, limit)
    .map((row) => ({
      label: row.label,
      views: row.views,
      share: total ? Math.round((row.views / total) * 100) : 0,
    }));
}

export function analyticsToCsv(input: {
  links: Array<{ title: string; clicks: number; ctr: number }>;
  devices: Array<{ label: string; views: number; share: number }>;
  browsers: Array<{ label: string; views: number; share: number }>;
  utm: Array<{ label: string; views: number; share: number }>;
}) {
  const lines = ['kind,label,views,clicks,ctr,share'];
  for (const link of input.links) {
    lines.push(['link', link.title, '', String(link.clicks), formatRate(link.ctr), ''].map(csvCell).join(','));
  }
  for (const row of input.devices) {
    lines.push(['device', row.label, String(row.views), '', '', `${row.share}%`].map(csvCell).join(','));
  }
  for (const row of input.browsers) {
    lines.push(['browser', row.label, String(row.views), '', '', `${row.share}%`].map(csvCell).join(','));
  }
  for (const row of input.utm) {
    lines.push(['utm', row.label, String(row.views), '', '', `${row.share}%`].map(csvCell).join(','));
  }
  return lines.join('\n') + '\n';
}

export type LinkColors = {
  background: string;
  button: string;
  buttonText: string;
  pageText: string;
  title: string;
};

export type LinkDesign = {
  wallpaper: (typeof LINK_WALLPAPERS)[number];
  pattern: (typeof LINK_PATTERNS)[number];
  gradientFrom: string;
  gradientTo: string;
  buttonFill: (typeof LINK_BUTTON_FILLS)[number];
  radius: number;
  shadow: (typeof LINK_SHADOWS)[number];
  titleFont: (typeof LINK_FONTS)[number];
  colors: LinkColors;
  header: (typeof LINK_HEADERS)[number];
  titleMode: (typeof LINK_TITLE_MODES)[number];
  logoUrl: string;
  mediaUrl: string;
  socialPosition: (typeof LINK_SOCIAL_POSITIONS)[number];
  hiddenSocials: string[];
  wallpaperChosen: boolean;
};

export type VisitorRule = {
  country: string;
  platform: string;
  language: string;
  action: (typeof LINK_RULE_ACTIONS)[number];
  title: string;
  url: string;
};

export type VisitorContext = { country: string; platform: string; language: string };

export type LinkExtras = {
  layout: (typeof LINK_LAYOUTS)[number];
  animation: (typeof LINK_ANIMATIONS)[number];
  priorityMode: (typeof LINK_PRIORITY_MODES)[number];
  rules: VisitorRule[];
  minAge: number;
};

export type ContactDetails = { email: string; phone: string; address: string; website: string };
export type DiscountBlock = { code: string; note: string; url: string };
export type EventItem = { title: string; when: string; place: string; url: string };

const FONT_STACKS: Record<string, string> = {
  'Plus Jakarta Sans': "'Plus Jakarta Sans', 'Helvetica Neue', sans-serif",
  Georgia: "Georgia, 'Iowan Old Style', serif",
  Palatino: "Palatino, 'Palatino Linotype', serif",
  'Trebuchet MS': "'Trebuchet MS', 'Segoe UI', sans-serif",
  'Courier New': "'Courier New', ui-monospace, monospace",
};

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function hexColor(value: unknown) {
  const text = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text.toLowerCase() : '';
}

export function fontStack(name: string) {
  return FONT_STACKS[name] || FONT_STACKS['Plus Jakarta Sans'];
}

export function emptyDesign(): LinkDesign {
  return {
    wallpaper: 'fill',
    pattern: 'dots',
    gradientFrom: '',
    gradientTo: '',
    buttonFill: 'solid',
    radius: -1,
    shadow: 'none',
    titleFont: 'Plus Jakarta Sans',
    colors: { background: '', button: '', buttonText: '', pageText: '', title: '' },
    header: 'classic',
    titleMode: 'text',
    logoUrl: '',
    mediaUrl: '',
    socialPosition: 'top',
    hiddenSocials: [],
    wallpaperChosen: false,
  };
}

export function normalizeDesign(value: unknown): LinkDesign {
  const row = asRecord(value);
  const colors = asRecord(row.colors);
  const logo = String(row.logoUrl || '').trim().slice(0, 2000);
  const media = String(row.mediaUrl || '').trim().slice(0, 2000);
  const hidden = Array.isArray(row.hiddenSocials) ? row.hiddenSocials : [];
  const radius = Number(row.radius);
  return {
    wallpaper: pick(row.wallpaper, LINK_WALLPAPERS, 'fill'),
    pattern: pick(row.pattern, LINK_PATTERNS, 'dots'),
    gradientFrom: hexColor(row.gradientFrom),
    gradientTo: hexColor(row.gradientTo),
    buttonFill: pick(row.buttonFill, LINK_BUTTON_FILLS, 'solid'),
    radius: Number.isInteger(radius) ? Math.max(-1, Math.min(32, radius)) : -1,
    shadow: pick(row.shadow, LINK_SHADOWS, 'none'),
    titleFont: pick(row.titleFont, LINK_FONTS, 'Plus Jakarta Sans'),
    colors: {
      background: hexColor(colors.background),
      button: hexColor(colors.button),
      buttonText: hexColor(colors.buttonText),
      pageText: hexColor(colors.pageText),
      title: hexColor(colors.title),
    },
    header: pick(row.header, LINK_HEADERS, 'classic'),
    titleMode: pick(row.titleMode, LINK_TITLE_MODES, 'text'),
    logoUrl: logo && !imagePathProblem(logo) ? logo : '',
    mediaUrl: media && !imagePathProblem(media) ? media : '',
    socialPosition: pick(row.socialPosition, LINK_SOCIAL_POSITIONS, 'top'),
    hiddenSocials: hidden
      .map((item) => String(item || '').trim())
      .filter((item) => /^[a-zA-Z0-9_-]{1,40}$/.test(item))
      .slice(0, 40),
    wallpaperChosen: row.wallpaperChosen === true || typeof row.wallpaper === 'string',
  };
}

export function designProKind(theme: string, design: LinkDesign): PaidFeature | null {
  if (themeIsPro(theme)) {
    return 'theme';
  }
  if (design.header !== 'classic') {
    return 'layout';
  }
  if (design.wallpaper === 'blur' || design.wallpaper === 'pattern' || design.wallpaper === 'video' || design.wallpaper === 'motion') {
    return 'wallpaper';
  }
  if (design.buttonFill === 'glass') {
    return 'button';
  }
  return null;
}

export function emptyLinkExtras(): LinkExtras {
  return { layout: 'classic', animation: 'none', priorityMode: 'none', rules: [], minAge: 18 };
}

export function normalizeMinAge(value: unknown) {
  const age = Number(value);
  if (!Number.isInteger(age)) {
    return 18;
  }
  return Math.min(120, Math.max(13, age));
}

export function normalizeRules(value: unknown): VisitorRule[] {
  const items = Array.isArray(value) ? value : [];
  const out: VisitorRule[] = [];
  for (const item of items) {
    const row = asRecord(item);
    const country = cleanCountry(String(row.country || ''));
    const platform = String(row.platform || '').trim().slice(0, 40);
    const language = String(row.language || '')
      .trim()
      .toLowerCase()
      .slice(0, 12);
    const action = pick(row.action, LINK_RULE_ACTIONS, 'hide');
    const title = String(row.title || '').trim().slice(0, 160);
    const url = String(row.url || '').trim().slice(0, 2000);
    if (!country && !platform && !language) {
      continue;
    }
    if (action === 'url' && urlProblem(url)) {
      continue;
    }
    if (action === 'title' && !title) {
      continue;
    }
    out.push({ country, platform, language, action, title, url });
    if (out.length === 8) {
      break;
    }
  }
  return out;
}

export function normalizeLinkExtras(payload: unknown): LinkExtras {
  const row = asRecord(payload);
  return {
    layout: pick(row.layout, LINK_LAYOUTS, 'classic'),
    animation: pick(row.animation, LINK_ANIMATIONS, 'none'),
    priorityMode: pick(row.priorityMode, LINK_PRIORITY_MODES, 'none'),
    rules: normalizeRules(row.rules),
    minAge: normalizeMinAge(row.minAge),
  };
}

export function linkProKind(extras: LinkExtras): PaidFeature | null {
  if (extras.animation !== 'none') {
    return 'animation';
  }
  if (extras.layout === 'featured') {
    return 'layout';
  }
  if (extras.priorityMode === 'expand' || extras.priorityMode === 'redirect') {
    return 'priority';
  }
  if (extras.rules.length) {
    return 'rules';
  }
  return null;
}

export function normalizeVisitor(input: {
  country?: string;
  language?: string;
  platform?: string;
  referrer?: string;
}): VisitorContext {
  const platform = (input.platform || '').trim().slice(0, 40);
  return {
    country: cleanCountry(input.country || ''),
    language: (input.language || '').trim().toLowerCase().slice(0, 12),
    platform: platform || (input.referrer ? sourceLabel({ referrer: input.referrer }) : ''),
  };
}

function languageMatches(want: string, have: string) {
  if (!want) {
    return true;
  }
  return have === want || have.startsWith(`${want}-`);
}

export function applyVisitorRules(rules: VisitorRule[], visitor: VisitorContext) {
  for (const rule of rules) {
    if (rule.country && rule.country !== visitor.country) {
      continue;
    }
    if (rule.platform && rule.platform.toLowerCase() !== visitor.platform.toLowerCase()) {
      continue;
    }
    if (!languageMatches(rule.language, visitor.language)) {
      continue;
    }
    return { action: rule.action, title: rule.title, url: rule.url };
  }
  return { action: 'none' as const, title: '', url: '' };
}

export function linkIsHidden(payload: unknown, visitor?: VisitorContext) {
  if (!visitor) {
    return false;
  }
  return applyVisitorRules(normalizeLinkExtras(payload).rules, visitor).action === 'hide';
}

export function normalizeDetails(payload: unknown): ContactDetails {
  const row = asRecord(payload);
  const details = asRecord(row.details || row);
  const email = String(details.email || '').trim().toLowerCase().slice(0, 200);
  const website = String(details.website || '').trim().slice(0, 2000);
  return {
    email: email && !emailProblem(email) ? email : '',
    phone: String(details.phone || '').trim().slice(0, 40),
    address: String(details.address || '').trim().slice(0, 200),
    website: website && !urlProblem(website) ? website : '',
  };
}

export function detailsProblem(details: ContactDetails) {
  if (!details.email && !details.phone && !details.address && !details.website) {
    return 'Add at least one contact detail';
  }
  return null;
}

export function normalizeDiscount(input: { title?: string; url?: string; body?: string; payload?: unknown }): DiscountBlock {
  const row = asRecord(input.payload);
  const discount = asRecord(row.discount || row);
  const url = String(discount.url || input.url || '').trim().slice(0, 2000);
  return {
    code: String(discount.code || input.title || '').trim().slice(0, 40),
    note: String(discount.note || input.body || '').trim().slice(0, 160),
    url: url && !urlProblem(url) ? url : '',
  };
}

const EVENT_WHEN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const EVENT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function eventTime(when: string, timeZone?: string) {
  const match = EVENT_WHEN.exec((when || '').trim());
  if (!match) {
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
  const utc = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(utc);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null;
  }
  if (!timeZone) {
    return utc;
  }
  try {
    const offsetAt = (instant: number) => {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).formatToParts(new Date(instant));
      const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
      return Date.UTC(read('year'), read('month') - 1, read('day'), read('hour'), read('minute'), read('second')) - instant;
    };
    let guess = utc;
    guess = utc - offsetAt(guess);
    return utc - offsetAt(guess);
  } catch {
    return utc;
  }
}

export function blockDeleteRequest(id: string) {
  return { path: `/link-in-bio/blocks/${id}`, method: 'DELETE' as const };
}

export function blockPriority(type: string, body: { priority?: boolean }, priorityMode: string) {
  if (type === 'LINK') {
    return priorityMode !== 'none';
  }
  return body.priority === true;
}

export const SHARE_MENU_ITEMS = ['Copy link', 'X', 'WhatsApp', 'Facebook', 'LinkedIn', 'Email', 'QR code', 'More…'] as const;

export function shareMenu(url: string, title: string) {
  const page = encodeURIComponent(url);
  const text = encodeURIComponent(title || url);
  return {
    open: true,
    items: SHARE_MENU_ITEMS,
    links: {
      x: `https://twitter.com/intent/tweet?url=${page}&text=${text}`,
      whatsapp: `https://wa.me/?text=${text}%20${page}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${page}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${page}`,
      email: `mailto:?subject=${text}&body=${page}`,
    },
  };
}

export function eventLabel(when: string) {
  const match = EVENT_WHEN.exec((when || '').trim());
  if (!match) {
    return when;
  }
  const month = EVENT_MONTHS[Number(match[2]) - 1];
  if (!month) {
    return when;
  }
  return `${Number(match[3])} ${month} ${match[1]}, ${match[4]}:${match[5]}`;
}

export function upcomingEvents(events: EventItem[], now = Date.now(), timeZone?: string) {
  const dated: Array<{ item: EventItem; time: number }> = [];
  const undated: EventItem[] = [];
  for (const item of events) {
    const time = eventTime(item.when, timeZone);
    if (time === null) {
      undated.push(item);
      continue;
    }
    if (time >= now) {
      dated.push({ item, time });
    }
  }
  dated.sort((a, b) => a.time - b.time);
  return [...dated.map((row) => row.item), ...undated];
}

export function normalizeEvents(payload: unknown): EventItem[] {
  const items = Array.isArray(payload) ? payload : asRecord(payload).events;
  if (!Array.isArray(items)) {
    return [];
  }
  const out: EventItem[] = [];
  for (const item of items) {
    const row = asRecord(item);
    const title = String(row.title || '').trim().slice(0, 80);
    if (!title) {
      continue;
    }
    const url = String(row.url || '').trim().slice(0, 2000);
    out.push({
      title,
      when: String(row.when || '').trim().slice(0, 80),
      place: String(row.place || '').trim().slice(0, 80),
      url: url && !urlProblem(url) ? url : '',
    });
    if (out.length === 12) {
      break;
    }
  }
  return out;
}

export function ageYears(raw: string, now = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((raw || '').trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  if (date.getTime() > now.getTime()) {
    return null;
  }
  let age = now.getUTCFullYear() - year;
  const monthDelta = now.getUTCMonth() + 1 - month;
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < day)) {
    age -= 1;
  }
  return age;
}

export function dobProblem(raw: string, minAge: number, now = new Date()) {
  const age = ageYears(raw, now);
  if (age === null) {
    return 'Enter a real date of birth';
  }
  if (age < minAge) {
    return `You need to be ${minAge} or older`;
  }
  return null;
}

export function knownRange(range: string) {
  return (LINK_RANGES as readonly string[]).includes(range) ? range : '28d';
}
