// Single source for crea8.one prices, limits, and credit numbers.
// Public pages show USD. India rupee prices are sent to Dodo at checkout only.

export const SUPPORT_EMAIL = 'support@crea8.one';
export const TRIAL_DAYS = 7;

export const CREDIT_COSTS = {
  xPost: 1,
  xPostWithUrl: 13,
  aiImage: 3,
  stalkerPostsPerCredit: 3,
  aiPostsPerCredit: 2,
} as const;

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
  imageGenerator: boolean;
  imageGenerationCount: number;
  generateVideos: number;
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
    | 'imageGenerationCount'
    | 'generateVideos'
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
  imageGenerator: partial.key !== 'STANDARD',
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
    imageGenerator: false,
    imageGenerationCount: 0,
    generateVideos: 0,
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
    imageGenerationCount: 20,
    generateVideos: 3,
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
    imageGenerationCount: 100,
    generateVideos: 10,
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
    imageGenerationCount: 300,
    generateVideos: 30,
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
    imageGenerationCount: 500,
    generateVideos: 60,
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
