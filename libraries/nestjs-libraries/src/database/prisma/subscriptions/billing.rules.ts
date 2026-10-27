import { createHmac, timingSafeEqual } from 'crypto';
import { hasLinks } from '@gitroom/helpers/utils/strip.links';
import {
  isBillingEnforced,
  isGrandfatheredOrg,
} from '@gitroom/helpers/utils/billing.enabled';
import {
  CREDIT_COSTS,
  CREDIT_PACKS,
  PLANS,
  PaidTier,
  PlanTier,
  ProductKey,
  packByKey,
  productKey,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';
import { pricing } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';

const SIGNATURE_TOLERANCE_SEC = 5 * 60;

export class BillingBlocked extends Error {
  upgrade = true;
  constructor(message: string) {
    super(message);
    this.name = 'BillingBlocked';
  }
}

export function accessTier(
  organizationId: string | undefined | null,
  subscriptionTier?: string | null
): PlanTier {
  if (!isBillingEnforced(organizationId)) {
    return 'ULTIMATE';
  }
  if (isGrandfatheredOrg(organizationId)) {
    return 'ULTIMATE';
  }
  if (
    subscriptionTier === 'STANDARD' ||
    subscriptionTier === 'TEAM' ||
    subscriptionTier === 'PRO' ||
    subscriptionTier === 'ULTIMATE'
  ) {
    return subscriptionTier;
  }
  return 'FREE';
}

export function planOf(tier: string | null | undefined) {
  if (tier && pricing[tier]) {
    return pricing[tier];
  }
  return pricing.FREE;
}

export function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string
) {
  const found = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === name
  );
  const value = found?.[1];
  if (Array.isArray(value)) {
    return value[0] || '';
  }
  return value || '';
}

function webhookSecretBytes(secret: string) {
  if (secret.startsWith('whsec_')) {
    return Buffer.from(secret.slice('whsec_'.length), 'base64');
  }
  return Buffer.from(secret);
}

export function verifyDodoSignature(
  rawBody: Buffer,
  headers: Record<string, string | string[] | undefined>,
  secret: string,
  nowMs = Date.now()
) {
  if (!secret) {
    throw new BillingBlocked('Webhook secret is not configured');
  }
  const id = headerValue(headers, 'webhook-id');
  const timestamp = headerValue(headers, 'webhook-timestamp');
  const signature = headerValue(headers, 'webhook-signature');
  if (!id || !timestamp || !signature) {
    throw new BillingBlocked('Missing webhook signature');
  }
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    throw new BillingBlocked('Invalid webhook timestamp');
  }
  if (Math.abs(nowMs / 1000 - ts) > SIGNATURE_TOLERANCE_SEC) {
    throw new BillingBlocked('Webhook timestamp is outside the allowed window');
  }
  const signed = `${id}.${timestamp}.${rawBody.toString('utf8')}`;
  const expected = createHmac('sha256', webhookSecretBytes(secret))
    .update(signed)
    .digest('base64');
  const match = signature.split(' ').some((part) => {
    const [version, value] = part.split(',');
    if (version !== 'v1' || !value) {
      return false;
    }
    const left = Buffer.from(value);
    const right = Buffer.from(expected);
    return left.length === right.length && timingSafeEqual(left, right);
  });
  if (!match) {
    throw new BillingBlocked('Invalid webhook signature');
  }
  return { id, payload: JSON.parse(rawBody.toString('utf8')) };
}

export type CreditBalance = { monthly: number; pack: number };

export type SpendPlan =
  | {
      ok: true;
      monthlySpend: number;
      packSpend: number;
      monthlyAfter: number;
      packAfter: number;
    }
  | { ok: false; reason: 'insufficient_credits' };

export function xPostCost(text?: string | null) {
  return hasLinks(text) ? CREDIT_COSTS.xPostWithUrl : CREDIT_COSTS.xPost;
}

export function stalkerReadCost(postCount: number) {
  if (postCount <= 0) {
    return 0;
  }
  return Math.ceil(postCount / CREDIT_COSTS.stalkerPostsPerCredit);
}

export function planSpend(balance: CreditBalance, cost: number): SpendPlan {
  const monthly = Math.max(0, balance.monthly);
  const pack = Math.max(0, balance.pack);
  if (cost <= 0) {
    return {
      ok: true,
      monthlySpend: 0,
      packSpend: 0,
      monthlyAfter: monthly,
      packAfter: pack,
    };
  }
  if (monthly + pack < cost) {
    return { ok: false, reason: 'insufficient_credits' };
  }
  const monthlySpend = Math.min(monthly, cost);
  const packSpend = cost - monthlySpend;
  return {
    ok: true,
    monthlySpend,
    packSpend,
    monthlyAfter: monthly - monthlySpend,
    packAfter: pack - packSpend,
  };
}

export function postsCovered(creditsSpent: number, requested: number) {
  return Math.min(
    requested,
    Math.max(0, creditsSpent) * CREDIT_COSTS.stalkerPostsPerCredit
  );
}

export type ChannelRow = { id: string; createdAt: Date | string | number };

export function postableChannelIds(channels: ChannelRow[], limit: number) {
  return [...channels]
    .sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    )
    .slice(0, Math.max(0, limit))
    .map((channel) => channel.id);
}

export function canConnectChannel(activeCount: number, limit: number) {
  return activeCount < limit;
}

export function canAddTeamMember(memberCount: number, limit: number | null) {
  if (limit === null) {
    return true;
  }
  return memberCount < limit;
}

export function channelUpgradeMessage(tier: PlanTier) {
  const plan = PLANS[tier];
  return `${plan.displayName} includes ${plan.channels} channels. Upgrade your plan to connect more.`;
}

export function postingUpgradeMessage(tier: PlanTier) {
  const plan = PLANS[tier];
  return `This channel is over your ${plan.displayName} limit of ${plan.channels}. Upgrade to post from it. Nothing was removed.`;
}

export function creditUpgradeMessage() {
  return 'You are out of credits. Upgrade your plan or buy a credit pack.';
}

export function keywordUpgradeMessage(tier: PlanTier) {
  const plan = PLANS[tier];
  return `${plan.displayName} includes ${plan.stalkerKeywords} Stalker keywords. Upgrade to track more.`;
}

export function manualCheckMessage(limit: number) {
  return `You have used today's ${limit} checks. Upgrade for more.`;
}

export type BillingSnapshot = {
  tier: PlanTier;
  period: 'MONTHLY' | 'YEARLY' | null;
  status: string;
  cancelAt: string | null;
  pendingTier: PaidTier | null;
  pendingPeriod: 'MONTHLY' | 'YEARLY' | null;
  cycleKey: string | null;
  monthly: number;
  pack: number;
  deleted: boolean;
};

export function emptyBillingSnapshot(): BillingSnapshot {
  return {
    tier: 'FREE',
    period: null,
    status: 'none',
    cancelAt: null,
    pendingTier: null,
    pendingPeriod: null,
    cycleKey: null,
    monthly: 0,
    pack: 0,
    deleted: true,
  };
}

export type NormalizedBillingEvent = {
  id: string;
  type: string;
  tier?: PaidTier | null;
  period?: 'MONTHLY' | 'YEARLY' | null;
  status?: string | null;
  cycleKey?: string | null;
  cancelAt?: string | null;
  pendingTier?: PaidTier | null;
  pendingPeriod?: 'MONTHLY' | 'YEARLY' | null;
  packCredits?: number;
  inTrial?: boolean;
};

const END_STATUSES = new Set(['cancelled', 'expired', 'failed', 'trial_ended']);

export function reduceBillingEvent(
  state: BillingSnapshot,
  event: NormalizedBillingEvent
): BillingSnapshot {
  if (event.type === 'payment.succeeded' && event.packCredits) {
    return { ...state, pack: state.pack + event.packCredits };
  }
  if (event.type === 'payment.failed' || event.type === 'payment.succeeded') {
    return state;
  }
  const status = event.status || 'active';
  if (END_STATUSES.has(status)) {
    return {
      ...state,
      status: event.inTrial ? 'trial_ended' : status,
      deleted: true,
      cancelAt: event.cancelAt || state.cancelAt,
      pendingTier: null,
      pendingPeriod: null,
    };
  }
  const tier = event.tier || state.tier;
  const paidTier = tier === 'FREE' ? 'STANDARD' : tier;
  const cycleKey = event.cycleKey || state.cycleKey;
  const allowance = PLANS[paidTier].monthlyCredits;
  let monthly = state.monthly;
  if (cycleKey && cycleKey !== state.cycleKey && (event.type === 'subscription.active' || event.type === 'subscription.renewed')) {
    monthly = allowance;
  } else if (event.type === 'subscription.active' && state.cycleKey === null) {
    monthly = allowance;
  }
  return {
    ...state,
    tier: paidTier,
    period: event.period || state.period,
    status: event.inTrial ? 'trialing' : status,
    cancelAt: event.cancelAt ?? null,
    pendingTier: event.pendingTier ?? null,
    pendingPeriod: event.pendingPeriod ?? null,
    cycleKey,
    monthly,
    deleted: false,
  };
}

export interface WebhookClaimStore {
  claim(id: string): boolean;
}

export function applyWebhookOnce(
  store: WebhookClaimStore,
  state: BillingSnapshot,
  event: NormalizedBillingEvent
) {
  if (!event.id || !store.claim(event.id)) {
    return { duplicate: true, state };
  }
  return { duplicate: false, state: reduceBillingEvent(state, event) };
}

export class MemoryWebhookStore implements WebhookClaimStore {
  private seen = new Set<string>();
  claim(id: string) {
    if (this.seen.has(id)) {
      return false;
    }
    this.seen.add(id);
    return true;
  }
}

export function dodoEnvironment(): 'test_mode' | 'live_mode' {
  const value = (process.env.DODO_PAYMENTS_ENVIRONMENT || 'test_mode')
    .trim()
    .toLowerCase();
  if (value === 'live' || value === 'live_mode') {
    return 'live_mode';
  }
  return 'test_mode';
}

export function dodoWebhookSecret() {
  return (
    process.env.DODO_WEBHOOK_SECRET ||
    process.env.DODO_PAYMENTS_WEBHOOK_KEY ||
    ''
  );
}

export function dodoProductId(key: string) {
  const raw = process.env.DODO_PRODUCTS || '';
  if (raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      if (parsed?.[key]) {
        return parsed[key];
      }
    } catch {
      return null;
    }
  }
  return process.env[`DODO_PRODUCT_${key}`] || null;
}

export function subscriptionProductId(tier: PaidTier, period: 'MONTHLY' | 'YEARLY') {
  return dodoProductId(productKey(tier, period));
}

export function packProductId(key: string) {
  const pack = packByKey(key);
  if (!pack) {
    return null;
  }
  return dodoProductId(pack.key);
}

export function tierFromProductId(productId: string): {
  tier: PaidTier;
  period: 'MONTHLY' | 'YEARLY';
} | null {
  const keys = [
    'STANDARD_MONTHLY',
    'STANDARD_YEARLY',
    'TEAM_MONTHLY',
    'TEAM_YEARLY',
    'PRO_MONTHLY',
    'PRO_YEARLY',
    'ULTIMATE_MONTHLY',
    'ULTIMATE_YEARLY',
  ] as ProductKey[];
  for (const key of keys) {
    if (dodoProductId(key) && dodoProductId(key) === productId) {
      const [tier, period] = key.split('_') as [PaidTier, 'MONTHLY' | 'YEARLY'];
      return { tier, period };
    }
  }
  return null;
}

export function packCreditsFromProduct(productId: string) {
  for (const pack of CREDIT_PACKS) {
    if (dodoProductId(pack.key) === productId) {
      return pack.credits;
    }
  }
  return 0;
}

export function isUpgrade(
  fromTier: PlanTier,
  toTier: PaidTier,
  fromPeriod: 'MONTHLY' | 'YEARLY' | null,
  toPeriod: 'MONTHLY' | 'YEARLY'
) {
  const price = (tier: PlanTier, period: 'MONTHLY' | 'YEARLY' | null) => {
    const plan = PLANS[tier];
    return period === 'YEARLY' ? plan.yearPriceUsd : plan.monthPriceUsd;
  };
  return price(toTier, toPeriod) > price(fromTier, fromPeriod || 'MONTHLY');
}

export function frontendUrl() {
  return (process.env.FRONTEND_URL || 'https://app.crea8.one').replace(/\/$/, '');
}
