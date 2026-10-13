import {
  CREDIT_PACKS,
  PAID_TIERS,
  PLANS,
  PaidTier,
  PlanTier,
  SUPPORT_EMAIL,
  TRIAL_DAYS,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';

export type BillingSubscriptionStatus =
  | 'none'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'on_hold'
  | 'cancel_scheduled'
  | 'cancelled'
  | 'trial_ended';

export type BillingCheckoutState = 'idle' | 'pending' | 'success' | 'failure';

export type BillingPlanCard = {
  tier: PaidTier;
  displayName: string;
  monthPriceUsd: number;
  yearPriceUsd: number;
  channels: number;
  teamMemberLimit: number | null;
  monthlyCredits: number;
  stalkerKeywords: number;
  stalkerScanHours: number;
  stalkerManualChecksPerDay: number | null;
  mentionRetentionDays: number;
};

export type BillingCreditEntry = {
  id: string;
  amount: number;
  bucket: 'MONTHLY' | 'PACK';
  type: 'GRANT' | 'SPEND' | 'EXPIRE';
  reason: string;
  createdAt: string;
};

export type BillingInvoice = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  url: string | null;
};

export type BillingOverview = {
  billingEnabled: boolean;
  grandfathered: boolean;
  supportEmail: string;
  trialDays: number;
  allowTrial: boolean;
  screen: 'plan_picker' | 'billing_settings';
  subscription: {
    tier: PlanTier;
    displayName: string;
    period: 'MONTHLY' | 'YEARLY' | null;
    status: BillingSubscriptionStatus;
    cancelAt: string | null;
    currentPeriodEnd: string | null;
    pendingTier: PaidTier | null;
    pendingDisplayName: string | null;
    pendingPeriod: 'MONTHLY' | 'YEARLY' | null;
    isLifetime: boolean;
    provider: string | null;
    identifier: string | null;
  };
  credits: {
    monthlyRemaining: number;
    monthlyAllowance: number;
    packRemaining: number;
    total: number;
    cycleKey: string | null;
  };
  history: BillingCreditEntry[];
  invoices: BillingInvoice[];
  plans: BillingPlanCard[];
  packs: Array<{ key: 'PACK_150' | 'PACK_500'; credits: number; usd: number; name: string }>;
};

export function planCards(): BillingPlanCard[] {
  return PAID_TIERS.map((tier) => {
    const plan = PLANS[tier];
    return {
      tier,
      displayName: plan.displayName,
      monthPriceUsd: plan.monthPriceUsd,
      yearPriceUsd: plan.yearPriceUsd,
      channels: plan.channels,
      teamMemberLimit: plan.teamMemberLimit,
      monthlyCredits: plan.monthlyCredits,
      stalkerKeywords: plan.stalkerKeywords,
      stalkerScanHours: plan.stalkerScanHours,
      stalkerManualChecksPerDay: plan.stalkerManualChecksPerDay,
      mentionRetentionDays: plan.mentionRetentionDays,
    };
  });
}

export function billingStatus(input: {
  active: boolean;
  status?: string | null;
  isTrailing?: boolean;
  cancelAt?: Date | null;
  pendingTier?: string | null;
}): BillingSubscriptionStatus {
  if (!input.active) {
    if (input.status === 'trial_ended') {
      return 'trial_ended';
    }
    if (input.status === 'cancelled' || input.status === 'expired' || input.status === 'failed') {
      return 'cancelled';
    }
    return 'none';
  }
  if (input.pendingTier) {
    return 'active';
  }
  if (input.cancelAt) {
    return 'cancel_scheduled';
  }
  if (input.status === 'past_due') {
    return 'past_due';
  }
  if (input.status === 'on_hold') {
    return 'on_hold';
  }
  if (input.status === 'trialing' || input.isTrailing) {
    return 'trialing';
  }
  return 'active';
}

export const billingSupport = {
  email: SUPPORT_EMAIL,
  trialDays: TRIAL_DAYS,
  packs: CREDIT_PACKS.map((pack) => ({
    key: pack.key,
    credits: pack.credits,
    usd: pack.usd,
    name: pack.name,
  })),
};
