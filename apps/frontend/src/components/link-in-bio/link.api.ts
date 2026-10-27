'use client';

import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import {
  LinkDesign,
  VisitorContext,
  linkIsHidden,
  normalizeDesign,
  presentPublicBlock,
} from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.rules';

export type LinkPostCard = {
  id: string;
  title: string;
  platform: string;
  dateLabel: string;
  image: string;
  url: string;
};

export type LinkBlockType =
  | 'LINK'
  | 'FEATURED_POST'
  | 'EMAIL_CAPTURE'
  | 'HEADING'
  | 'EMBED'
  | 'TEXT'
  | 'FAQ'
  | 'IMAGE_CAROUSEL'
  | 'CONTACT_FORM'
  | 'MAP'
  | 'CALENDLY'
  | 'CONTACT_DETAILS'
  | 'DISCOUNT'
  | 'EVENTS'
  | 'MUSIC'
  | 'LATEST_YOUTUBE';

export type LinkFaq = { question: string; answer: string };
export type LinkImage = { path: string; alt: string };
export type LinkForm = { heading: string; button: string; consent: string; askName: boolean };

export type LinkBlock = {
  id: string;
  type: LinkBlockType;
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
  thumbnail: string;
  iconMode: string;
  spotlight: boolean;
  body: string;
  lock: { type: 'NONE' | 'AGE' | 'EMAIL' | 'PASSWORD' | 'CODE' | 'DOB' | 'SENSITIVE'; hasPassword: boolean };
  faq: LinkFaq[];
  images: LinkImage[];
  form: LinkForm | null;
  details: { email: string; phone: string; address: string; website: string } | null;
  discount: { code: string; note: string; url: string } | null;
  events: Array<{ title: string; when: string; place: string; url: string }>;
  layout: 'classic' | 'featured' | 'card' | 'tile';
  animation: string;
  priorityMode: 'none' | 'highlight' | 'expand' | 'redirect';
  rules: Array<{ country: string; platform: string; language: string; action: 'hide' | 'title' | 'url'; title: string; url: string }>;
  minAge: number;
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
  design: LinkDesign;
  gating: boolean;
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
  badgePaid?: boolean;
  domainPaid?: boolean;
  customDomainAddon: boolean;
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
  accounts: Array<{ id: string; network: string; name: string; url: string; picture: string; shown: boolean }>;
  integrations: {
    mailchimp: { connected: boolean; audience: string; hint: string };
    convertkit: { connected: boolean; form: string; hint: string };
    webhook: { url: string; hasSecret: boolean };
  };
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
  design: LinkDesign;
  backgroundMode: string;
  backgroundColor: string;
  backgroundImage: string;
  redirectUrl: string;
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
  blocks: Array<
    ReturnType<typeof presentPublicBlock> & {
      post: LinkPostCard | null;
    }
  >;
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
  from: string | null;
  to: string | null;
  deep: {
    links: Array<{ id: string; title: string; clicks: number; ctr: number }>;
    devices: Array<{ label: string; views: number; share: number }>;
    browsers: Array<{ label: string; views: number; share: number }>;
    utm: Array<{ label: string; views: number; share: number }>;
  } | null;
};

export type LinkLead = {
  id: string;
  name: string;
  email: string;
  country: string;
  source: string;
  status: 'PENDING' | 'CONFIRMED';
  kind: string;
  message: string;
  createdAt: string;
};

export type LinkLeads = {
  counts: { all: number; confirmed: number; pending: number };
  leads: LinkLead[];
};

export const useLinkAnalytics = (range: string, from = '', to = '') => {
  const fetch = useFetch();
  const key = `/link-in-bio/analytics?range=${encodeURIComponent(range)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  return useSWR<LinkAnalytics>(key, async (path: string) => {
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

export function revalidatePublicLink() {
  if (typeof window === 'undefined') {
    return;
  }
  void window.fetch('/api/link-revalidate', { method: 'POST' }).catch(() => undefined);
}

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

export function linkLocked(page?: { gating?: boolean; paid?: boolean } | null) {
  return !!page?.gating && !page.paid;
}

export function badgeLocked(page?: { badgePaid?: boolean; gating?: boolean; paid?: boolean } | null) {
  if (page?.badgePaid === false) {
    return true;
  }
  if (page?.badgePaid === true) {
    return false;
  }
  return linkLocked(page);
}

export function domainLocked(page?: { domainPaid?: boolean; gating?: boolean; customDomainAddon?: boolean } | null) {
  if (page?.domainPaid === false) {
    return true;
  }
  if (page?.domainPaid === true) {
    return false;
  }
  return !!page?.gating && !page?.customDomainAddon;
}

export function toPublic(page: LinkEditor, visitor?: VisitorContext): PublicLink {
  const open = !page.gating || page.paid;
  const design = page.design || normalizeDesign({});
  const live = page.isPublic
    ? page.blocks.filter((block) => block.state === 'live' && !(block.type === 'LINK' && linkIsHidden(blockPayload(block), visitor)))
    : [];
  const capture = live.some((block) => block.type === 'EMAIL_CAPTURE');
  const seen = new Set<string>();
  const socials = [
    ...page.accounts.filter((item) => item.shown).map((item) => ({ network: item.network, url: item.url })),
    ...page.socials,
  ].filter((item) => {
    const key = `${item.network}|${item.url}`;
    if (!item.url || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  const redirect = open
    ? live.find((block) => block.type === 'LINK' && block.lock.type === 'NONE' && block.priorityMode === 'redirect')
    : undefined;
  return {
    slug: page.slug,
    name: page.name,
    bio: page.bio,
    avatarPath: page.avatarPath,
    theme: page.theme,
    buttonStyle: page.buttonStyle,
    font: page.font,
    design,
    backgroundMode: page.backgroundMode,
    backgroundColor: page.backgroundColor,
    backgroundImage: page.backgroundImage,
    redirectUrl: redirect?.url || '',
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    isPublic: page.isPublic,
    sensitive: page.sensitive,
    showBadge: !page.hideBadge,
    socials,
    capture: capture ? page.capture : null,
    blocks: live.map((block) => ({
      ...presentPublicBlock(
        {
          id: block.id,
          type: block.type,
          title: block.title,
          url: block.url,
          body: block.body,
          priority: block.priority,
          thumbnail: block.thumbnail,
          iconMode: block.iconMode,
          spotlight: block.spotlight,
          lockType: block.lock.type,
          payload: blockPayload(block),
        },
        open,
        visitor,
        page.timezone
      ),
      post: block.post,
    })),
  };
}

function blockPayload(block: LinkBlock) {
  if (block.type === 'FAQ') {
    return { items: block.faq };
  }
  if (block.type === 'IMAGE_CAROUSEL') {
    return { images: block.images };
  }
  if (block.type === 'CONTACT_FORM') {
    return block.form;
  }
  if (block.type === 'CONTACT_DETAILS') {
    return { details: block.details };
  }
  if (block.type === 'DISCOUNT') {
    return { discount: block.discount };
  }
  if (block.type === 'EVENTS') {
    return { events: block.events };
  }
  return {
    layout: block.layout,
    animation: block.animation,
    priorityMode: block.priorityMode,
    rules: block.rules,
    minAge: block.minAge,
  };
}

export function linkCollectUrl(action: string) {
  if (typeof window === 'undefined') {
    return `/api/link/${action}`;
  }
  const host = window.location.hostname;
  if (host !== 'crea8.one' && host !== 'www.crea8.one') {
    return `/api/link/${action}`;
  }
  const origin = (process.env.NEXT_PUBLIC_ASSET_PREFIX || 'https://app.crea8.one').replace(/\/$/, '');
  return `${origin}/api/link/${action}`;
}
