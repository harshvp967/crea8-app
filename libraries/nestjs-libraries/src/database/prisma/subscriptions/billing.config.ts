// Single source for crea8.one prices, limits, and credit numbers.
// Public pages show USD. India rupee prices are sent to Dodo at checkout only.

export const SUPPORT_EMAIL = 'support@crea8.one';
export const TRIAL_DAYS = 7;
export const CHECKOUT_GST_NOTE = 'GST is added at checkout.';
export const TRIAL_CHECKOUT_FAQ =
  'You are not charged today. The 7-day trial checks out at $0. GST is added at checkout. Dodo Payments is the merchant of record. You can pay by card or UPI where Dodo offers it, and cancel anytime from billing. Email support@crea8.one if you need help.';
// Monthly credits while a paid subscription is still inside its trial.
// The plan's monthlyCredits apply on the first successful charge.
export const TRIAL_MONTHLY_CREDITS = 50;

export const CREDIT_COSTS = {
  xPost: 1,
  xPostWithUrl: 13,
  aiImage: 3,
  stalkerPostsPerCredit: 3,
  aiPostsPerCredit: 2,
} as const;

// TODO: Harsh has not set the AI video credit cost. Do not charge, price, or
// show a card line until this is a positive number.
export const AI_VIDEO_CREDIT_COST: number | null = null;

export const CREDIT_PACKS = [
  { key: 'PACK_150' as const, credits: 150, usd: 5, name: '150 credits' },
  { key: 'PACK_500' as const, credits: 500, usd: 15, name: '500 credits' },
] as const;

export type CreditPackKey = (typeof CREDIT_PACKS)[number]['key'];
export type PaidTier = 'STANDARD' | 'TEAM' | 'PRO' | 'ULTIMATE';
export type PlanTier = 'FREE' | PaidTier;
export type BillingPeriod = 'MONTHLY' | 'YEARLY';

export type PlanConfig = {
  key: PlanTier;
  displayName: string;
  monthPriceUsd: number;
  yearPriceUsd: number;
  monthPriceInr: number;
  yearPriceInr: number;
  channels: number;
  postsPerMonth: number;
  teamMemberLimit: number | null;
  monthlyCredits: number;
  stalkerKeywords: number;
  stalkerScanHours: number;
  stalkerManualChecksPerDay: number | null;
  mentionRetentionDays: number;
  webhooks: number;
  ai: boolean;
  communityFeatures: boolean;
  featuredByGitroom: boolean;
  importFromChannels: boolean;
  publicApi: boolean;
  autoPost: boolean;
};

const paid = (
  partial: Pick<
    PlanConfig,
    | 'key'
    | 'displayName'
    | 'monthPriceUsd'
    | 'monthPriceInr'
    | 'channels'
    | 'teamMemberLimit'
    | 'monthlyCredits'
    | 'stalkerKeywords'
    | 'stalkerScanHours'
    | 'stalkerManualChecksPerDay'
    | 'mentionRetentionDays'
    | 'webhooks'
  >
): PlanConfig => ({
  ...partial,
  yearPriceUsd: partial.monthPriceUsd * 10,
  yearPriceInr: partial.monthPriceInr * 10,
  postsPerMonth: 1000000,
  ai: true,
  communityFeatures: partial.key !== 'STANDARD',
  featuredByGitroom: partial.key !== 'STANDARD',
  importFromChannels: true,
  publicApi: true,
  autoPost: partial.key !== 'STANDARD',
});

export const PLANS: Record<PlanTier, PlanConfig> = {
  FREE: {
    key: 'FREE',
    displayName: 'Free',
    monthPriceUsd: 0,
    yearPriceUsd: 0,
    monthPriceInr: 0,
    yearPriceInr: 0,
    channels: 0,
    postsPerMonth: 0,
    teamMemberLimit: 1,
    monthlyCredits: 0,
    stalkerKeywords: 0,
    stalkerScanHours: 12,
    stalkerManualChecksPerDay: 0,
    mentionRetentionDays: 30,
    webhooks: 0,
    ai: false,
    communityFeatures: false,
    featuredByGitroom: false,
    importFromChannels: false,
    publicApi: false,
    autoPost: false,
  },
  STANDARD: paid({
    key: 'STANDARD',
    displayName: 'Creator',
    monthPriceUsd: 19,
    monthPriceInr: 999,
    channels: 5,
    teamMemberLimit: 1,
    monthlyCredits: 300,
    stalkerKeywords: 3,
    stalkerScanHours: 12,
    stalkerManualChecksPerDay: 3,
    mentionRetentionDays: 30,
    webhooks: 2,
  }),
  TEAM: paid({
    key: 'TEAM',
    displayName: 'Team',
    monthPriceUsd: 39,
    monthPriceInr: 1999,
    channels: 10,
    teamMemberLimit: null,
    monthlyCredits: 700,
    stalkerKeywords: 10,
    stalkerScanHours: 6,
    stalkerManualChecksPerDay: 10,
    mentionRetentionDays: 90,
    webhooks: 10,
  }),
  PRO: paid({
    key: 'PRO',
    displayName: 'Pro',
    monthPriceUsd: 59,
    monthPriceInr: 2999,
    channels: 30,
    teamMemberLimit: null,
    monthlyCredits: 1100,
    stalkerKeywords: 25,
    stalkerScanHours: 2,
    stalkerManualChecksPerDay: 30,
    mentionRetentionDays: 365,
    webhooks: 30,
  }),
  ULTIMATE: paid({
    key: 'ULTIMATE',
    displayName: 'Agency',
    monthPriceUsd: 99,
    monthPriceInr: 4999,
    channels: 100,
    teamMemberLimit: null,
    monthlyCredits: 1800,
    stalkerKeywords: 75,
    stalkerScanHours: 1,
    stalkerManualChecksPerDay: null,
    mentionRetentionDays: 365,
    webhooks: 10000,
  }),
};

export const PAID_TIERS: PaidTier[] = ['STANDARD', 'TEAM', 'PRO', 'ULTIMATE'];

export const PRODUCT_KEYS = [
  'STANDARD_MONTHLY',
  'STANDARD_YEARLY',
  'TEAM_MONTHLY',
  'TEAM_YEARLY',
  'PRO_MONTHLY',
  'PRO_YEARLY',
  'ULTIMATE_MONTHLY',
  'ULTIMATE_YEARLY',
  'PACK_150',
  'PACK_500',
] as const;

export type ProductKey = (typeof PRODUCT_KEYS)[number];

export function productKey(tier: PaidTier, period: BillingPeriod): ProductKey {
  return `${tier}_${period}` as ProductKey;
}

export function packByKey(key: string) {
  return CREDIT_PACKS.find((pack) => pack.key === key) || null;
}

// One list for the pricing cards and for enforcement. AI images and AI videos
// are not on the cards: images spend CREDIT_COSTS.aiImage, and AI video has
// no cost until AI_VIDEO_CREDIT_COST is set.
export const PLAN_CARD_KEYS = [
  'channels',
  'teamMembers',
  'workspaces',
  'monthlyCredits',
  'stalkerKeywords',
  'stalkerScanHours',
  'stalkerChecks',
  'mentionRetentionDays',
  'webhooks',
  'postsPerMonth',
  'aiPost',
  'postingSets',
  'analytics',
  'linkThemes',
  'badgeRemoved',
] as const;

export type PlanCardKey = (typeof PLAN_CARD_KEYS)[number];

export type PlanCardLine = {
  key: PlanCardKey;
  text: string;
};

const cardCount = (value: number) => value.toLocaleString('en-US');

export function planCardLines(plan: PlanConfig): PlanCardLine[] {
  const lines: PlanCardLine[] = [
    { key: 'channels', text: `${cardCount(plan.channels)} channels` },
    {
      key: 'teamMembers',
      text:
        plan.teamMemberLimit == null
          ? 'Unlimited team members'
          : `${cardCount(plan.teamMemberLimit)} team ${plan.teamMemberLimit === 1 ? 'member' : 'members'}`,
    },
    { key: 'workspaces', text: 'Unlimited workspaces' },
    { key: 'monthlyCredits', text: `${cardCount(plan.monthlyCredits)} credits a month` },
    { key: 'stalkerKeywords', text: `${cardCount(plan.stalkerKeywords)} Stalker keywords` },
    {
      key: 'stalkerScanHours',
      text: `Stalker scan every ${plan.stalkerScanHours} ${plan.stalkerScanHours === 1 ? 'hour' : 'hours'}`,
    },
    {
      key: 'stalkerChecks',
      text:
        plan.stalkerManualChecksPerDay == null
          ? 'Unlimited Stalker checks a day'
          : `${cardCount(plan.stalkerManualChecksPerDay)} Stalker ${plan.stalkerManualChecksPerDay === 1 ? 'check' : 'checks'} a day`,
    },
    {
      key: 'mentionRetentionDays',
      text: `${cardCount(plan.mentionRetentionDays)} days of mentions`,
    },
    { key: 'webhooks', text: `${cardCount(plan.webhooks)} webhooks` },
    {
      key: 'postsPerMonth',
      text:
        plan.postsPerMonth > 10000
          ? 'Unlimited posts a month'
          : `${cardCount(plan.postsPerMonth)} posts a month`,
    },
  ];
  if (plan.ai) {
    lines.push({ key: 'aiPost', text: 'AI post' });
  }
  lines.push(
    { key: 'postingSets', text: 'Posting sets' },
    { key: 'analytics', text: 'Analytics' },
    { key: 'linkThemes', text: 'Link in Bio, all themes' }
  );
  if (plan.key !== 'FREE') {
    lines.push({ key: 'badgeRemoved', text: 'Badge removed' });
  }
  return lines;
}

export function planFeatureLines(plan: PlanConfig) {
  return planCardLines(plan).map((line) => line.text);
}

// null means the card states no numeric cap.
export function planCardQuota(plan: PlanConfig, key: PlanCardKey): number | null {
  switch (key) {
    case 'channels':
      return plan.channels;
    case 'teamMembers':
      return plan.teamMemberLimit;
    case 'workspaces':
      return null;
    case 'monthlyCredits':
      return plan.monthlyCredits;
    case 'stalkerKeywords':
      return plan.stalkerKeywords;
    case 'stalkerScanHours':
      return plan.stalkerScanHours;
    case 'stalkerChecks':
      return plan.stalkerManualChecksPerDay;
    case 'mentionRetentionDays':
      return plan.mentionRetentionDays;
    case 'webhooks':
      return plan.webhooks;
    case 'postsPerMonth':
      return plan.postsPerMonth;
    default:
      return null;
  }
}

export function cardLimitAllows(key: PlanCardKey, plan: PlanConfig, usage: number) {
  switch (key) {
    case 'channels':
    case 'stalkerKeywords':
    case 'webhooks':
    case 'postsPerMonth':
      return usage < (planCardQuota(plan, key) ?? 0);
    case 'teamMembers':
    case 'stalkerChecks': {
      const limit = planCardQuota(plan, key);
      return limit == null || usage < limit;
    }
    case 'monthlyCredits':
      return usage <= plan.monthlyCredits;
    case 'workspaces':
      return true;
    case 'stalkerScanHours':
      return plan.stalkerScanHours > 0;
    case 'mentionRetentionDays':
      return plan.mentionRetentionDays > 0;
    case 'aiPost':
      return plan.ai;
    case 'postingSets':
    case 'analytics':
    case 'linkThemes':
    case 'badgeRemoved':
      return plan.key !== 'FREE';
  }
}

// Where each card line is enforced. Feature lines have no second numeric cap.
export const PLAN_CARD_ENFORCEMENT: Record<PlanCardKey, string> = {
  channels: 'EntitlementService.assertCanConnect',
  teamMembers: 'EntitlementService.assertCanAddMember',
  workspaces: 'createWorkspace has no plan cap',
  monthlyCredits: 'CreditsService shared balance',
  stalkerKeywords: 'EntitlementService.assertCanAddKeyword',
  stalkerScanHours: 'StalkerService.listDueProjectScans',
  stalkerChecks: 'EntitlementService.assertCanManualCheck',
  mentionRetentionDays: 'StalkerService.mentions',
  webhooks: 'PermissionsService webhook count',
  postsPerMonth: 'PermissionsService posts per month',
  aiPost: 'plan.ai and CreditsService AI post charge',
  postingSets: 'EntitlementService.assertFeature postingSets',
  analytics: 'EntitlementService.assertFeature analytics',
  linkThemes: 'themes are not plan-locked',
  badgeRemoved: 'badgeRemovalOpen on the owner subscription',
};
