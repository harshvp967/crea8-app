import { PLANS, PlanTier } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';

export interface PricingInnerInterface {
  current: string;
  display_name: string;
  month_price: number;
  year_price: number;
  inr_month_price: number;
  inr_year_price: number;
  channel?: number;
  posts_per_month: number;
  team_members: boolean;
  team_member_limit: number | null;
  monthly_credits: number;
  stalker_keywords: number;
  stalker_scan_hours: number;
  stalker_manual_checks_per_day: number | null;
  mention_retention_days: number;
  community_features: boolean;
  featured_by_gitroom: boolean;
  ai: boolean;
  import_from_channels: boolean;
  image_generator?: boolean;
  image_generation_count: number;
  generate_videos: number;
  public_api: boolean;
  webhooks: number;
  autoPost: boolean;
}

export interface PricingInterface {
  [key: string]: PricingInnerInterface;
}

function toPricing(tier: PlanTier): PricingInnerInterface {
  const plan = PLANS[tier];
  return {
    current: plan.key,
    display_name: plan.displayName,
    month_price: plan.monthPriceUsd,
    year_price: plan.yearPriceUsd,
    inr_month_price: plan.monthPriceInr,
    inr_year_price: plan.yearPriceInr,
    channel: plan.channels,
    posts_per_month: plan.postsPerMonth,
    team_members: plan.teamMemberLimit === null,
    team_member_limit: plan.teamMemberLimit,
    monthly_credits: plan.monthlyCredits,
    stalker_keywords: plan.stalkerKeywords,
    stalker_scan_hours: plan.stalkerScanHours,
    stalker_manual_checks_per_day: plan.stalkerManualChecksPerDay,
    mention_retention_days: plan.mentionRetentionDays,
    community_features: plan.communityFeatures,
    featured_by_gitroom: plan.featuredByGitroom,
    ai: plan.ai,
    import_from_channels: plan.importFromChannels,
    image_generator: plan.imageGenerator,
    image_generation_count: plan.imageGenerationCount,
    generate_videos: plan.generateVideos,
    public_api: plan.publicApi,
    webhooks: plan.webhooks,
    autoPost: plan.autoPost,
  };
}

export const pricing: PricingInterface = {
  FREE: toPricing('FREE'),
  STANDARD: toPricing('STANDARD'),
  TEAM: toPricing('TEAM'),
  PRO: toPricing('PRO'),
  ULTIMATE: toPricing('ULTIMATE'),
};
