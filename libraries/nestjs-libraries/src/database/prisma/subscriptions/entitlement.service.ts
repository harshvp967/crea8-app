import { HttpException, Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import {
  isBillingEnforced,
  isGrandfatheredOrg,
} from '@gitroom/helpers/utils/billing.enabled';
import {
  GTA6CLIPS_PLAN_ID,
  PLANS,
  PlanCardKey,
  PlanTier,
  cardLimitAllows,
  gta6clipsProviderAllowed,
  isGta6clipsPlan,
  noPlanProductOpen,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';
import { pricing } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';
import {
  AccountSubscription,
  BillingAccount,
  loadBillingAccount,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.account';
import { explicitGta6clipsPlan } from '@gitroom/nestjs-libraries/partner/gta6clips.token';
import {
  BillingBlocked,
  accessTier,
  canAddTeamMember,
  autopostUpgradeMessage,
  channelUpgradeMessage,
  keywordUpgradeMessage,
  manualCheckMessage,
  postingUpgradeMessage,
  postsUpgradeMessage,
  postableChannelIds,
  webhookUpgradeMessage,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.rules';

@Injectable()
export class EntitlementService {
  constructor(private _prisma: PrismaService) {}

  async account(organizationId: string) {
    const account = await loadBillingAccount(this._prisma, organizationId);
    if (!isBillingEnforced(organizationId) || this.paidCovers(organizationId, account)) {
      return account;
    }
    // The paywall, sidebar, and channel gate read this subscription. A partner
    // grant belongs here, not on a second check.
    const plan = await this.ensurePartnerPlan(organizationId);
    if (!plan) {
      return account;
    }
    const subscription = partnerSubscription(organizationId);
    return { ...account, subscription, latest: subscription, isLifetime: false };
  }

  async activeSubscription(organizationId: string) {
    return (await this.account(organizationId)).subscription;
  }

  async latestSubscription(organizationId: string) {
    return (await this.account(organizationId)).latest;
  }

  async partnerPlanId(organizationId: string) {
    const plan = await this.ensurePartnerPlan(organizationId);
    if (!plan) {
      return null;
    }
    if (!isBillingEnforced(organizationId)) {
      return plan;
    }
    const account = await loadBillingAccount(this._prisma, organizationId);
    if (this.paidCovers(organizationId, account)) {
      return null;
    }
    return plan;
  }

  private paidCovers(organizationId: string, account: BillingAccount) {
    if (isGrandfatheredOrg(organizationId) || account.grandfathered) {
      return true;
    }
    if (!account.subscription) {
      return false;
    }
    const tier = accessTier(organizationId, account.subscription.subscriptionTier);
    return !isGta6clipsPlan(tier) && tier !== 'FREE';
  }

  private async ensurePartnerPlan(organizationId: string) {
    // Billing tests build a partial client. No partner table means no grant.
    const accounts = this._prisma.partnerAccount;
    if (!accounts?.findUnique) {
      return null;
    }
    const row = await accounts.findUnique({
      where: { organizationId },
      select: { partner: true, plan: true, metadata: true },
    });
    if (!row || row.partner !== 'gta6clips') {
      return null;
    }
    const recorded = explicitGta6clipsPlan(row.metadata);
    // An exchange that recorded "free" (or anything other than "paid") removes the perk.
    if (recorded) {
      return recorded === 'paid' ? GTA6CLIPS_PLAN_ID : null;
    }
    // Rows written before the claim existed keep the perk in PartnerAccount.plan.
    // Null metadata is not a downgrade, and this read does not backfill it.
    return row.plan === GTA6CLIPS_PLAN_ID ? GTA6CLIPS_PLAN_ID : null;
  }

  async tier(organizationId: string): Promise<PlanTier> {
    if (!isBillingEnforced(organizationId)) {
      return 'ULTIMATE';
    }
    const account = await this.account(organizationId);
    if (isGrandfatheredOrg(organizationId) || account.grandfathered) {
      return 'ULTIMATE';
    }
    return accessTier(organizationId, account.subscription?.subscriptionTier);
  }

  async limits(organizationId: string) {
    if (!isBillingEnforced(organizationId)) {
      return null;
    }
    const tier = await this.tier(organizationId);
    return { tier, plan: PLANS[tier], pricing: pricing[tier] };
  }

  async organizationIds(organizationId: string) {
    if (!isBillingEnforced(organizationId)) {
      return [organizationId];
    }
    return (await this.account(organizationId)).organizationIds;
  }

  private async activeChannels(organizationId: string) {
    const organizationIds = await this.organizationIds(organizationId);
    return this._prisma.integration.findMany({
      where: {
        organizationId: { in: organizationIds },
        deletedAt: null,
        disabled: false,
        refreshNeeded: false,
      },
      select: { id: true, internalId: true, createdAt: true, organizationId: true },
    });
  }

  async countChannels(organizationId: string) {
    return (await this.activeChannels(organizationId)).length;
  }

  async countMembers(organizationId: string) {
    const organizationIds = await this.organizationIds(organizationId);
    const rows = await this._prisma.userOrganization.findMany({
      where: { organizationId: { in: organizationIds }, disabled: false },
      select: { userId: true },
    });
    return new Set(rows.map((row) => row.userId)).size;
  }

  async countWebhooks(organizationId: string) {
    const organizationIds = await this.organizationIds(organizationId);
    return this._prisma.webhooks.count({
      where: { organizationId: { in: organizationIds }, deletedAt: null },
    });
  }

  async countKeywords(organizationId: string) {
    const organizationIds = await this.organizationIds(organizationId);
    return this._prisma.stalkerKeyword.count({
      where: { organizationId: { in: organizationIds } },
    });
  }

  async countManualChecks(organizationId: string, since: Date) {
    const organizationIds = await this.organizationIds(organizationId);
    return this._prisma.stalkerScanRun.count({
      where: {
        organizationId: { in: organizationIds },
        trigger: 'manual',
        startedAt: { gte: since },
      },
    });
  }

  async countPostsSince(organizationId: string, from: Date) {
    const organizationIds = await this.organizationIds(organizationId);
    return this._prisma.post.count({
      where: {
        organizationId: { in: organizationIds },
        publishDate: { gte: from },
        OR: [
          { deletedAt: null, state: { in: ['QUEUE'] } },
          { state: 'PUBLISHED' },
        ],
      },
    });
  }

  async countPostsThisPeriod(organizationId: string, fallback: Date) {
    const account = await this.account(organizationId);
    const createdAt = account.subscription?.createdAt || fallback;
    const totalMonthPast = Math.abs(dayjs(createdAt).diff(dayjs(), 'month'));
    const checkFrom = dayjs(createdAt).add(totalMonthPast, 'month');
    return this.countPostsSince(organizationId, checkFrom.toDate());
  }

  async usage(organizationId: string, fallback = new Date()) {
    const limits = await this.limits(organizationId);
    const plan = limits?.plan || PLANS.FREE;
    const [channels, teamMembers, keywords, webhooks, posts, checks] = await Promise.all([
      this.countChannels(organizationId),
      this.countMembers(organizationId),
      this.countKeywords(organizationId),
      this.countWebhooks(organizationId),
      this.countPostsThisPeriod(organizationId, fallback),
      this.countManualChecks(organizationId, utcDayStart()),
    ]);
    return {
      channels: { used: channels, limit: plan.channels },
      teamMembers: { used: teamMembers, limit: plan.teamMemberLimit },
      keywords: { used: keywords, limit: plan.stalkerKeywords },
      webhooks: { used: webhooks, limit: plan.webhooks },
      posts: { used: posts, limit: plan.postsPerMonth },
      stalkerChecks: { used: checks, limit: plan.stalkerManualChecksPerDay },
    };
  }

  private async refuseWithoutPlan(
    organizationId: string,
    product: 'schedule' | 'stalker' | 'paid'
  ) {
    if (noPlanProductOpen(product) || !isBillingEnforced(organizationId)) {
      return;
    }
    const account = await this.account(organizationId);
    if (isGta6clipsPlan(account.subscription?.subscriptionTier)) {
      if (product === 'stalker') {
        throw new HttpException(
          { message: keywordUpgradeMessage('FREE'), upgrade: true },
          402
        );
      }
      return;
    }
    if (
      account.subscription ||
      account.grandfathered ||
      isGrandfatheredOrg(organizationId)
    ) {
      return;
    }
    if (product === 'stalker') {
      throw new HttpException(
        { message: keywordUpgradeMessage('FREE'), upgrade: true },
        402
      );
    }
    if (product === 'schedule') {
      throw new BillingBlocked(postingUpgradeMessage('FREE'));
    }
    throw new HttpException(
      { message: 'Free does not include this. Upgrade your plan.', upgrade: true },
      402
    );
  }

  async assertCanConnect(organizationId: string, internalId?: string, provider?: string) {
    await this.refuseWithoutPlan(organizationId, 'paid');
    const limits = await this.limits(organizationId);
    if (!limits) {
      return;
    }
    if (isGta6clipsPlan(limits.tier) && provider && !gta6clipsProviderAllowed(provider)) {
      throw new HttpException(
        { message: 'This channel is not on this plan.', locked: true },
        402
      );
    }
    const channels = await this.activeChannels(organizationId);
    if (
      internalId &&
      channels.some(
        (channel) =>
          channel.internalId === internalId && channel.organizationId === organizationId
      )
    ) {
      return;
    }
    if (!cardLimitAllows('channels', limits.plan, channels.length)) {
      throw new HttpException(
        { message: channelUpgradeMessage(limits.tier), upgrade: true },
        402
      );
    }
  }

  async postsThisPeriodOpen(organizationId: string, fallback = new Date()) {
    const limits = await this.limits(organizationId);
    if (!limits) {
      return true;
    }
    const used = await this.countPostsThisPeriod(organizationId, fallback);
    return cardLimitAllows('postsPerMonth', limits.plan, used);
  }

  async webhookLimitOpen(organizationId: string) {
    const limits = await this.limits(organizationId);
    if (!limits) {
      return true;
    }
    const used = await this.countWebhooks(organizationId);
    return cardLimitAllows('webhooks', limits.plan, used);
  }

  async assertPostsThisPeriod(organizationId: string, fallback = new Date()) {
    const limits = await this.limits(organizationId);
    if (!limits || (await this.postsThisPeriodOpen(organizationId, fallback))) {
      return;
    }
    throw new HttpException(
      { message: postsUpgradeMessage(limits.tier), upgrade: true },
      402
    );
  }

  async assertCanAddWebhook(organizationId: string) {
    const limits = await this.limits(organizationId);
    if (!limits || (await this.webhookLimitOpen(organizationId))) {
      return;
    }
    throw new HttpException(
      { message: webhookUpgradeMessage(limits.tier), upgrade: true },
      402
    );
  }

  async assertCanAutopost(organizationId: string) {
    const limits = await this.limits(organizationId);
    if (!limits || limits.plan.autoPost) {
      return;
    }
    throw new HttpException(
      { message: autopostUpgradeMessage(limits.tier), upgrade: true },
      402
    );
  }

  async assertCanPost(organizationId: string, integrationId: string) {
    await this.refuseWithoutPlan(organizationId, 'schedule');
    const limits = await this.limits(organizationId);
    if (!limits) {
      return;
    }
    const channels = await this.activeChannels(organizationId);
    const allowed = postableChannelIds(channels, limits.plan.channels);
    if (!allowed.includes(integrationId)) {
      throw new BillingBlocked(postingUpgradeMessage(limits.tier));
    }
  }

  async assertCanAddMember(organizationId: string) {
    const limits = await this.limits(organizationId);
    if (!limits) {
      return true;
    }
    const memberCount = await this.countMembers(organizationId);
    if (!canAddTeamMember(memberCount, limits.plan.teamMemberLimit)) {
      throw new HttpException(
        {
          message: `${limits.plan.displayName} includes ${limits.plan.teamMemberLimit} team member. Upgrade to invite more.`,
          upgrade: true,
        },
        402
      );
    }
    return true;
  }

  async assertCanUseStalker(organizationId: string) {
    await this.refuseWithoutPlan(organizationId, 'stalker');
  }

  async assertCanAddKeyword(organizationId: string) {
    await this.refuseWithoutPlan(organizationId, 'stalker');
    const limits = await this.limits(organizationId);
    if (!limits) {
      return;
    }
    const used = await this.countKeywords(organizationId);
    if (!cardLimitAllows('stalkerKeywords', limits.plan, used)) {
      throw new HttpException(
        { message: keywordUpgradeMessage(limits.tier), upgrade: true },
        402
      );
    }
  }

  async assertCanManualCheck(organizationId: string) {
    const limits = await this.limits(organizationId);
    if (!limits) {
      return;
    }
    const cap = limits.plan.stalkerManualChecksPerDay;
    if (cap == null) {
      return;
    }
    const used = await this.countManualChecks(organizationId, utcDayStart());
    if (!cardLimitAllows('stalkerChecks', limits.plan, used)) {
      throw new HttpException(
        { statusCode: 429, message: manualCheckMessage(cap), upgrade: true },
        429
      );
    }
  }

  async assertFeature(
    organizationId: string,
    key: Extract<PlanCardKey, 'postingSets' | 'analytics' | 'aiPost'>
  ) {
    await this.refuseWithoutPlan(organizationId, 'paid');
    const limits = await this.limits(organizationId);
    if (!limits) {
      return;
    }
    if (!cardLimitAllows(key, limits.plan, 0)) {
      throw new HttpException(
        { message: `${limits.plan.displayName} does not include this. Upgrade your plan.`, upgrade: true },
        402
      );
    }
  }
}

function partnerSubscription(organizationId: string): AccountSubscription {
  return {
    organizationId,
    subscriptionTier: GTA6CLIPS_PLAN_ID,
    status: 'active',
    period: 'MONTHLY',
    cancelAt: null,
    currentPeriodEnd: null,
    pendingTier: null,
    pendingPeriod: null,
    isLifetime: false,
    provider: 'gta6clips',
    identifier: GTA6CLIPS_PLAN_ID,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function utcDayStart() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

export function stalkerLimitMessage(kind: 'keyword' | 'manual', tier: PlanTier, limit: number) {
  return kind === 'keyword' ? keywordUpgradeMessage(tier) : manualCheckMessage(limit);
}

export type { BillingAccount };
