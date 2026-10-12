'use client';

import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export type LinkPostCard = {
  id: string;
  title: string;
  platform: string;
  dateLabel: string;
  image: string;
  url: string;
};

export type LinkBlock = {
  id: string;
  type: 'LINK' | 'FEATURED_POST' | 'EMAIL_CAPTURE' | 'HEADING';
  position: number;
  enabled: boolean;
  title: string;
  url: string;
  priority: boolean;
  scheduleOn: boolean;
  startsAt: string | null;
  endsAt: string | null;
  postId: string | null;
  state: 'live' | 'scheduled' | 'ended' | 'hidden';
  clicks: number;
  post: LinkPostCard | null;
};

export type LinkRecord = {
  type: string;
  name: string;
  value: string;
  ttl: string;
};

export type LinkEditor = {
  id: string;
  slug: string;
  name: string;
  bio: string;
  avatarPath: string;
  theme: string;
  buttonStyle: string;
  font: string;
  backgroundMode: string;
  backgroundColor: string;
  backgroundImage: string;
  seoTitle: string;
  seoDescription: string;
  isPublic: boolean;
  sensitive: boolean;
  hideBadge: boolean;
  timezone: string;
  customDomain: string;
  domainStatus: 'NONE' | 'WAITING' | 'VERIFYING' | 'LIVE' | 'ERROR';
  domainError: string;
  domainCheckedAt: string | null;
  domainAvailable: boolean;
  cnameTarget: string;
  domainRecords: LinkRecord[];
  paid: boolean;
  publicOrigin: string;
  publicUrl: string;
  capture: {
    heading: string;
    button: string;
    consent: string;
    askName: boolean;
    doubleOptIn: boolean;
    notify: boolean;
  };
  socials: Array<{ network: string; url: string }>;
  blocks: LinkBlock[];
};

export type PublicLink = {
  slug: string;
  name: string;
  bio: string;
  avatarPath: string;
  theme: string;
  buttonStyle: string;
  font: string;
  backgroundMode: string;
  backgroundColor: string;
  backgroundImage: string;
  seoTitle: string;
  seoDescription: string;
  isPublic: boolean;
  sensitive: boolean;
  showBadge: boolean;
  socials: Array<{ network: string; url: string }>;
  capture: {
    heading: string;
    button: string;
    consent: string;
    askName: boolean;
  } | null;
  blocks: Array<{
    id: string;
    type: LinkBlock['type'];
    title: string;
    url: string;
    priority: boolean;
    post: LinkPostCard | null;
  }>;
};

export class LinkRequestError extends Error {
  status: number;
  upgrade: boolean;

  constructor(message: string, status: number, upgrade = false) {
    super(message);
    this.status = status;
    this.upgrade = upgrade;
  }
}

export const useLinkPage = () => {
  const fetch = useFetch();
  return useSWR<LinkEditor>('/link-in-bio', async (path: string) => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const response = await fetch(`${path}?timezone=${encodeURIComponent(timezone)}`);
    if (!response.ok) {
      throw new Error('Could not load your page');
    }
    return response.json();
  });
};

export const useLinkPosts = () => {
  const fetch = useFetch();
  return useSWR<LinkPostCard[]>('/link-in-bio/posts', async (path: string) => {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error('Could not load posts');
    }
    return response.json();
  });
};

export type LinkAnalytics = {
  range: string;
  views: number;
  clicks: number;
  subscribers: number;
  ctr: number;
  deltas: {
    views: number | null;
    clicks: number | null;
    subscribers: number | null;
    ctr: number | null;
  };
  series: Array<{ day: string; views: number; clicks: number }>;
  topLinks: Array<{ id: string; title: string; clicks: number; ctr: number }>;
  countries: Array<{ code: string; name: string; views: number; share: number }>;
  sources: Array<{ source: string; views: number; share: number }>;
};

export type LinkLead = {
  id: string;
  name: string;
  email: string;
  country: string;
  source: string;
  status: 'PENDING' | 'CONFIRMED';
  createdAt: string;
};

export type LinkLeads = {
  counts: { all: number; confirmed: number; pending: number };
  leads: LinkLead[];
};

export const useLinkAnalytics = (range: string) => {
  const fetch = useFetch();
  return useSWR<LinkAnalytics>(`/link-in-bio/analytics?range=${range}`, async (path: string) => {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error('Could not load analytics');
    }
    return response.json();
  });
};

export const useLinkLeads = (status: string, query: string) => {
  const fetch = useFetch();
  const key = `/link-in-bio/leads?status=${encodeURIComponent(status)}&q=${encodeURIComponent(query)}`;
  return useSWR<LinkLeads>(key, async (path: string) => {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error('Could not load leads');
    }
    return response.json();
  });
};

export async function linkSend(
  fetch: (url: string, options?: RequestInit) => Promise<Response>,
  path: string,
  method: string,
  body?: unknown
) {
  const response = await fetch(path, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(data.message) ? data.message[0] : data.message;
    throw new LinkRequestError(message || 'Something went wrong', response.status, !!data.upgrade);
  }
  return data;
}

export function toPublic(page: LinkEditor): PublicLink {
  const live = page.isPublic ? page.blocks.filter((block) => block.state === 'live') : [];
  const capture = live.some((block) => block.type === 'EMAIL_CAPTURE');
  return {
    slug: page.slug,
    name: page.name,
    bio: page.bio,
    avatarPath: page.avatarPath,
    theme: page.theme,
    buttonStyle: page.buttonStyle,
    font: page.font,
    backgroundMode: page.backgroundMode,
    backgroundColor: page.backgroundColor,
    backgroundImage: page.backgroundImage,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    isPublic: page.isPublic,
    sensitive: page.sensitive,
    showBadge: !page.hideBadge,
    socials: page.socials,
    capture: capture ? page.capture : null,
    blocks: live.map((block) => ({
      id: block.id,
      type: block.type,
      title: block.title,
      url: block.url,
      priority: block.priority,
      post: block.post,
    })),
  };
}
