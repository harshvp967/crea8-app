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
  TRIAL_DAYS,
  TRIAL_MONTHLY_CREDITS,
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

export function monthlyCreditAllowance(
  tier: string | null | undefined,
  inTrial: boolean
) {
  const plan = tier && tier in PLANS ? PLANS[tier as PlanTier] : PLANS.FREE;
  if (!inTrial) {
    return plan.monthlyCredits;
  }
  return Math.min(plan.monthlyCredits, TRIAL_MONTHLY_CREDITS);
}

export function monthlyCycleKey(cycleKey: string, inTrial: boolean) {
  return inTrial ? `trial:${cycleKey}` : cycleKey;
}

function cycleBase(cycleKey: string | null | undefined) {
  if (!cycleKey) {
    return null;
  }
  return cycleKey.startsWith('trial:') ? cycleKey.slice('trial:'.length) : cycleKey;
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

export const AI_POST_CALL_REASON = 'ai_post_call';
export const AI_POST_REASON = 'ai_post';

export const CREDIT_USAGE_ACTIONS = [
  'ai_post',
  'x_post',
  'x_post_with_link',
  'ai_image',
  'stalker_search',
] as const;

export type CreditUsageAction = (typeof CREDIT_USAGE_ACTIONS)[number];

export type CreditLedgerRow = {
  amount: number;
  type: 'GRANT' | 'SPEND' | 'EXPIRE';
  reason: string;
  idempotencyKey: string;
};

export function aiPostCharge(callNumber: number) {
  if (!Number.isFinite(callNumber) || callNumber <= 0) {
    return 0;
  }
  return callNumber % CREDIT_COSTS.aiPostsPerCredit === 0 ? 1 : 0;
}

export function ledgerRowsForHistory<T extends { reason: string }>(rows: T[]) {
  return rows.filter((row) => row.reason !== AI_POST_CALL_REASON);
}

function ledgerBaseKey(idempotencyKey: string) {
  return idempotencyKey.replace(/:(monthly|pack)$/, '');
}

function netByReason(entries: CreditLedgerRow[], reasons: string[]) {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    if (!reasons.includes(entry.reason)) {
      continue;
    }
    const key = ledgerBaseKey(entry.idempotencyKey);
    totals.set(key, (totals.get(key) || 0) - entry.amount);
  }
  let credits = 0;
  for (const value of totals.values()) {
    credits += value;
  }
  return { credits, groups: totals };
}

function fixedAction(entries: CreditLedgerRow[], reason: string, refund: string, unit: number) {
  const { credits } = netByReason(entries, refund ? [reason, refund] : [reason]);
  return {
    credits,
    count: unit > 0 ? Math.round(credits / unit) : 0,
  };
}

export function creditUsage(input: {
  allowance: number;
  monthlyRemaining: number;
  packRemaining: number;
  entries: CreditLedgerRow[];
}) {
  const aiCredits = netByReason(input.entries, [AI_POST_REASON, 'ai_post_refund']).credits;
  const plain = fixedAction(input.entries, 'x_post', '', CREDIT_COSTS.xPost);
  const linked = fixedAction(
    input.entries,
    'x_post_with_link',
    '',
    CREDIT_COSTS.xPostWithUrl
  );
  const image = fixedAction(input.entries, 'ai_image', 'ai_image_refund', CREDIT_COSTS.aiImage);
  const stalker = netByReason(input.entries, ['stalker_read']);
  const actions: { key: CreditUsageAction; count: number; credits: number }[] = [
    {
      key: 'ai_post',
      count: input.entries.filter((entry) => entry.reason === AI_POST_CALL_REASON).length,
      credits: aiCredits,
    },
    { key: 'x_post', count: plain.count, credits: plain.credits },
    { key: 'x_post_with_link', count: linked.count, credits: linked.credits },
    { key: 'ai_image', count: image.count, credits: image.credits },
    {
      key: 'stalker_search',
      count: [...stalker.groups.values()].filter((value) => value > 0).length,
      credits: stalker.credits,
    },
  ];
  const used = input.entries.reduce((sum, entry) => {
    if (entry.reason === AI_POST_CALL_REASON) {
      return sum;
    }
    if (entry.type === 'SPEND' || entry.reason.endsWith('_refund')) {
      return sum + -entry.amount;
    }
    return sum;
  }, 0);
  return {
    allowance: input.allowance,
    used,
    // The tracker allowance is the trial cap while trialing and the plan
    // allowance after conversion. Left follows that number, not a stored
    // balance that can still be the full plan (1800 on Agency) during a trial.
    left: Math.max(0, input.allowance - used),
    packCredits: input.packRemaining,
    actions,
  };
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
  // subscription.renewed is the recurring charge. That is the trial
  // converting, or a later paid period, so the plan allowance applies.
  const trialing = !!event.inTrial && event.type !== 'subscription.renewed';
  const baseCycle = event.cycleKey || cycleBase(state.cycleKey);
  const cycleKey = baseCycle ? monthlyCycleKey(baseCycle, trialing) : null;
  const allowance = monthlyCreditAllowance(paidTier, trialing);
  let monthly = state.monthly;
  const granting =
    event.type === 'subscription.active' || event.type === 'subscription.renewed';
  if (
    granting &&
    ((cycleKey && cycleKey !== state.cycleKey) ||
      (event.type === 'subscription.active' && state.cycleKey === null))
  ) {
    monthly = allowance;
  }
  return {
    ...state,
    tier: paidTier,
    period: event.period || state.period,
    status: trialing ? 'trialing' : status,
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

const DAY_MS = 24 * 60 * 60 * 1000;

export function ignoreRemoteSubscription(input: {
  status: string;
  hadLiveSubscription: boolean;
}) {
  const status = input.status.trim().toLowerCase();
  if (status === 'failed') {
    return true;
  }
  if (
    !input.hadLiveSubscription &&
    (status === 'pending' ||
      status === 'cancelled' ||
      status === 'canceled' ||
      status === 'expired')
  ) {
    return true;
  }
  return false;
}

export function invoiceIsVisible(input: { amount: number; status?: string | null }) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return false;
  }
  const status = String(input.status || '').trim().toLowerCase();
  if (
    !status ||
    status === 'failed' ||
    status === 'cancelled' ||
    status === 'canceled' ||
    status === 'processing' ||
    status === 'requires_customer_action' ||
    status === 'requires_merchant_action' ||
    status === 'requires_payment_method' ||
    status === 'requires_confirmation' ||
    status === 'requires_capture'
  ) {
    return false;
  }
  return true;
}

export function planChangeBilling(input: {
  inTrial: boolean;
  upgrade: boolean;
  trialEndsAt: string | null;
}): {
  prorationBillingMode: 'do_not_bill' | 'prorated_immediately';
  effectiveAt: 'immediately' | 'next_billing_date';
  chargeNow: boolean;
  keepTrialEnd: string | null;
  applyTierNow: boolean;
} {
  if (input.inTrial) {
    return {
      prorationBillingMode: 'do_not_bill' as const,
      effectiveAt: input.upgrade ? ('immediately' as const) : ('next_billing_date' as const),
      chargeNow: false,
      keepTrialEnd: input.trialEndsAt,
      applyTierNow: input.upgrade,
    };
  }
  if (input.upgrade) {
    return {
      prorationBillingMode: 'prorated_immediately' as const,
      effectiveAt: 'immediately' as const,
      chargeNow: true,
      keepTrialEnd: null,
      applyTierNow: true,
    };
  }
  return {
    prorationBillingMode: 'do_not_bill' as const,
    effectiveAt: 'next_billing_date' as const,
    chargeNow: false,
    keepTrialEnd: null,
    applyTierNow: false,
  };
}

export function preservedTrialEnd(input: {
  previousEnd: string | null;
  incomingEnd: string | null;
  createdAt?: string | null;
  trialDays?: number;
}) {
  const trialDays = input.trialDays ?? TRIAL_DAYS;
  const fromCreated =
    input.createdAt && Number.isFinite(Date.parse(input.createdAt))
      ? new Date(Date.parse(input.createdAt) + trialDays * DAY_MS).toISOString()
      : null;
  const anchor = input.previousEnd || fromCreated;
  if (!input.incomingEnd) {
    return anchor;
  }
  if (!anchor || !Number.isFinite(Date.parse(anchor)) || !Number.isFinite(Date.parse(input.incomingEnd))) {
    return anchor || input.incomingEnd;
  }
  if (Date.parse(input.incomingEnd) - Date.parse(anchor) > DAY_MS) {
    return new Date(Date.parse(anchor)).toISOString();
  }
  return input.incomingEnd;
}

export function displayedPlanAfterEvent(input: {
  currentTier: PlanTier;
  currentPeriod: 'MONTHLY' | 'YEARLY' | null;
  pendingTier: PaidTier | null;
  pendingPeriod: 'MONTHLY' | 'YEARLY' | null;
  eventType: string;
  eventTier: PaidTier;
  eventPeriod: 'MONTHLY' | 'YEARLY';
}) {
  if (input.eventType === 'subscription.renewed') {
    return {
      tier: input.eventTier,
      period: input.eventPeriod,
      pendingTier: null,
      pendingPeriod: null,
    };
  }
  if (input.currentTier === 'FREE') {
    return {
      tier: input.eventTier,
      period: input.eventPeriod,
      pendingTier: null,
      pendingPeriod: null,
    };
  }
  const same =
    input.currentTier === input.eventTier &&
    (input.currentPeriod || 'MONTHLY') === input.eventPeriod;
  if (same) {
    return {
      tier: input.currentTier,
      period: input.currentPeriod,
      pendingTier: input.pendingTier,
      pendingPeriod: input.pendingPeriod,
    };
  }
  if (
    !isUpgrade(input.currentTier, input.eventTier, input.currentPeriod, input.eventPeriod)
  ) {
    return {
      tier: input.currentTier,
      period: input.currentPeriod,
      pendingTier: input.eventTier,
      pendingPeriod: input.eventPeriod,
    };
  }
  return {
    tier: input.eventTier,
    period: input.eventPeriod,
    pendingTier: null,
    pendingPeriod: null,
  };
}

export function dodoCheckoutPrefill(input: {
  name?: string | null;
  lastName?: string | null;
  country?: string | null;
  phone?: string | null;
}) {
  const country = (input.country || '').trim().toUpperCase();
  const india = country === 'IN';
  const first = (input.name || '').trim();
  const last = (input.lastName || '').trim();
  const full = [first, last].filter(Boolean).join(' ').trim();
  const hasFullName = !!last || first.includes(' ');
  let phoneNumber: string | undefined;
  const compact = (input.phone || '').replace(/[^\d+]/g, '');
  if (compact) {
    if (india) {
      if (!compact.startsWith('+1')) {
        if (compact.startsWith('+91')) {
          phoneNumber = compact;
        } else if (compact.startsWith('91') && compact.length > 10) {
          phoneNumber = `+${compact}`;
        } else {
          const local = compact.replace(/^\+/, '').replace(/^0+/, '');
          if (local.length >= 10) {
            phoneNumber = `+91${local.slice(-10)}`;
          }
        }
      }
    } else if (compact.startsWith('+') && compact.length > 8) {
      phoneNumber = compact;
    }
  }
  return {
    ...(hasFullName ? { name: full } : {}),
    ...(phoneNumber ? { phoneNumber } : {}),
    ...(india ? { country: 'IN' as const } : {}),
    currency: india ? ('INR' as const) : ('USD' as const),
    lockName: false as const,
    lockPhoneToPlusOne: false as const,
  };
}

export function cancelAccessUntil(input: {
  currentPeriodEnd: Date | null;
  createdAt: Date | null;
  inTrial: boolean;
  trialDays: number;
}) {
  if (input.currentPeriodEnd) {
    return input.currentPeriodEnd;
  }
  if (input.inTrial && input.createdAt) {
    return new Date(input.createdAt.getTime() + input.trialDays * DAY_MS);
  }
  return null;
}

export function frontendUrl() {
  return (process.env.FRONTEND_URL || 'https://app.crea8.one').replace(/\/$/, '');
}
