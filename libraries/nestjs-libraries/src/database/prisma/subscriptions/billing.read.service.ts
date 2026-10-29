import { Injectable } from '@nestjs/common';
import { Organization } from '@prisma/client';
import {
  isBillingEnforced,
  isGrandfatheredOrg,
} from '@gitroom/helpers/utils/billing.enabled';
import { PLANS } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';
import { monthlyCreditAllowance } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.rules';
import { CreditsService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/credits.service';
import { EntitlementService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/entitlement.service';
import { DodoProvider } from '@gitroom/nestjs-libraries/services/payment/providers/dodo.provider';
import {
  BillingOverview,
  billingStatus,
  billingSupport,
  paywallAllowsTrial,
  planCards,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.view';

@Injectable()
export class BillingReadService {
  constructor(
    private _entitlements: EntitlementService,
    private _credits: CreditsService,
    private _dodo: DodoProvider
  ) {}

  async overview(org: Organization): Promise<BillingOverview> {
    const enforced = isBillingEnforced(org.id);
    const grandfathered = isGrandfatheredOrg(org.id);
    const active = enforced ? await this._entitlements.activeSubscription(org.id) : null;
    const latest = enforced ? await this._entitlements.latestSubscription(org.id) : null;
    const tier = await this._entitlements.tier(org.id);
    const balance = await this._credits.balance(org.id);
    const history = enforced ? await this._credits.history(org.id) : [];
    let invoices: BillingOverview['invoices'] = [];
    if (enforced && org.paymentId) {
      try {
        invoices = await this._dodo.invoices(org.id);
      } catch {
        invoices = [];
      }
    }
    const shown = active || (!active ? latest : null);
    const status = billingStatus({
      active: !!active,
      status: shown?.status,
      isTrailing: org.isTrailing,
      cancelAt: active?.cancelAt,
      pendingTier: active?.pendingTier,
    });
    const plan = PLANS[tier];
    const shownStatus = grandfathered && !active ? 'active' : status;
    return {
      billingEnabled: enforced,
      grandfathered,
      supportEmail: billingSupport.email,
      trialDays: billingSupport.trialDays,
      allowTrial: paywallAllowsTrial({
        allowTrial: !!org.allowTrial,
        hasActiveSubscription: !!active,
        latestStatus: latest?.status,
      }),
      screen: !enforced || active || grandfathered ? 'billing_settings' : 'plan_picker',
      subscription: {
        tier,
        displayName: plan.displayName,
        period: active?.period || null,
        status: shownStatus,
        cancelAt: active?.cancelAt ? active.cancelAt.toISOString() : null,
        currentPeriodEnd: active?.currentPeriodEnd
          ? active.currentPeriodEnd.toISOString()
          : null,
        pendingTier: active?.pendingTier || null,
        pendingDisplayName: active?.pendingTier
          ? PLANS[active.pendingTier].displayName
          : null,
        pendingPeriod: active?.pendingPeriod || null,
        isLifetime: !!active?.isLifetime || grandfathered,
        provider: active?.provider || null,
        identifier: active?.identifier || null,
      },
      credits: {
        monthlyRemaining: balance.monthlyRemaining,
        monthlyAllowance: monthlyCreditAllowance(
          tier,
          !grandfathered && shownStatus === 'trialing'
        ),
        packRemaining: balance.packRemaining,
        total: balance.total,
        cycleKey: balance.cycleKey,
      },
      history: history.map((entry) => ({
        id: entry.id,
        amount: entry.amount,
        bucket: entry.bucket,
        type: entry.type,
        reason: entry.reason,
        createdAt: entry.createdAt.toISOString(),
      })),
      invoices,
      plans: planCards(),
      packs: billingSupport.packs,
    };
  }
}
