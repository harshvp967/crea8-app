import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import {
  isBillingEnforced,
  isGrandfatheredOrg,
} from '@gitroom/helpers/utils/billing.enabled';
import { PLANS, PlanTier } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';
import { pricing } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';
import {
  BillingBlocked,
  accessTier,
  canAddTeamMember,
  canConnectChannel,
  channelUpgradeMessage,
  keywordUpgradeMessage,
  manualCheckMessage,
  postingUpgradeMessage,
  postableChannelIds,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.rules';

@Injectable()
export class EntitlementService {
  constructor(private _prisma: PrismaService) {}

  async activeSubscription(organizationId: string) {
    return this._prisma.subscription.findFirst({
      where: { organizationId, deletedAt: null },
    });
  }

  async latestSubscription(organizationId: string) {
    return this._prisma.subscription.findFirst({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async tier(organizationId: string): Promise<PlanTier> {
    if (!isBillingEnforced(organizationId)) {
      return 'ULTIMATE';
    }
    if (isGrandfatheredOrg(organizationId)) {
      return 'ULTIMATE';
    }
    const subscription = await this.activeSubscription(organizationId);
    return accessTier(organizationId, subscription?.subscriptionTier);
  }

  async limits(organizationId: string) {
    if (!isBillingEnforced(organizationId)) {
      return null;
    }
    const tier = await this.tier(organizationId);
    return { tier, plan: PLANS[tier], pricing: pricing[tier] };
  }

  private async activeChannels(organizationId: string) {
    const rows = await this._prisma.integration.findMany({
      where: { organizationId, deletedAt: null, disabled: false, refreshNeeded: false },
      select: { id: true, internalId: true, createdAt: true },
    });
    return rows;
  }

  async assertCanConnect(organizationId: string, internalId?: string) {
    const limits = await this.limits(organizationId);
    if (!limits) {
      return;
    }
    const channels = await this.activeChannels(organizationId);
    if (internalId && channels.some((channel) => channel.internalId === internalId)) {
      return;
    }
    if (!canConnectChannel(channels.length, limits.plan.channels)) {
      throw new HttpException(
        { message: channelUpgradeMessage(limits.tier), upgrade: true },
        402
      );
    }
  }

  async assertCanPost(organizationId: string, integrationId: string) {
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
    const memberCount = await this._prisma.userOrganization.count({
      where: { organizationId, disabled: false },
    });
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
}

export function stalkerLimitMessage(kind: 'keyword' | 'manual', tier: PlanTier, limit: number) {
  return kind === 'keyword' ? keywordUpgradeMessage(tier) : manualCheckMessage(limit);
}
