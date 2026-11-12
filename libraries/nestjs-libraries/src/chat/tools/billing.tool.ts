import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { UsersService } from '@gitroom/nestjs-libraries/database/prisma/users/users.service';
import { BillingReadService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.read.service';
import type { BillingOverview } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.view';
import { PaymentService } from '@gitroom/nestjs-libraries/services/payment/payment.service';
import { EntitlementService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/entitlement.service';
import {
  organizationFromTool,
  ToolOrganization,
  toolFailure,
} from '@gitroom/nestjs-libraries/chat/auth.context';
import type { BillingAccount } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.account';
import { accountActor } from '@gitroom/nestjs-libraries/chat/tools/account.actor';

type BillingInput = {
  billing?: 'STANDARD' | 'PRO' | 'TEAM' | 'ULTIMATE';
  period?: 'MONTHLY' | 'YEARLY';
  pack?: 'PACK_150' | 'PACK_500';
  country?: string;
};

// The billing screen reads these fields from GET /billing/overview. Anything
// else on that payload (invoices, history, provider ids) stays off the tool.
function billingRead(overview: BillingOverview) {
  const subscription = overview.subscription;
  return {
    billingEnabled: overview.billingEnabled,
    plan: {
      tier: subscription.tier,
      displayName: subscription.displayName,
      period: subscription.period,
    },
    status: subscription.status,
    renewal: {
      renewsAt: subscription.renewsAt,
      expiresAt: subscription.expiresAt,
      cancelAt: subscription.cancelAt,
      currentPeriodEnd: subscription.currentPeriodEnd,
    },
    pending: {
      tier: subscription.pendingTier,
      displayName: subscription.pendingDisplayName,
      period: subscription.pendingPeriod,
    },
    credits: {
      monthlyRemaining: overview.credits.monthlyRemaining,
      monthlyAllowance: overview.credits.monthlyAllowance,
      packRemaining: overview.credits.packRemaining,
      total: overview.credits.total,
    },
    usage: overview.usage,
  };
}

function checkoutUrl(result: unknown) {
  if (!result || typeof result !== 'object') {
    return '';
  }
  const url = (result as { url?: unknown }).url;
  return typeof url === 'string' ? url : '';
}

@Injectable()
export class BillingTool implements AgentToolInterface {
  constructor(
    private _billingRead: BillingReadService,
    private _payment: PaymentService,
    private _entitlements: EntitlementService,
    private _organizations: OrganizationService,
    private _users: UsersService
  ) {}
  name = 'billingTool';

  run() {
    return createTool({
      id: 'billingTool',
      description: `Read billing or return a checkout link. action "overview" returns the plan, status (trial, active, cancelled-until, and the other states on the billing screen), renewal, credits (monthly remaining, allowance, pack remaining, total), and usage against limits, the same values as GET /billing/overview. action "portal" returns the customer portal URL from GET /billing/portal. action "checkout" returns a Dodo checkout URL for a plan only when that call returns a url. A workspace that already has a subscription is refused and the plan is not changed. action "pack" returns a credit pack checkout URL only when that call returns a url. A workspace with no subscription, a trial, an expired subscription, or a cancelled subscription is refused, the same rule as the billing screen. This does not cancel, refund, resume, or apply a coupon. Confirm with the user before checkout or pack.`,
      inputSchema: z.object({
        action: z.enum(['overview', 'portal', 'checkout', 'pack']),
        billing: z
          .enum(['STANDARD', 'PRO', 'TEAM', 'ULTIMATE'])
          .optional()
          .describe('Plan for checkout'),
        period: z
          .enum(['MONTHLY', 'YEARLY'])
          .optional()
          .describe('Billing period for checkout'),
        pack: z
          .enum(['PACK_150', 'PACK_500'])
          .optional()
          .describe('Credit pack for pack'),
        country: z
          .string()
          .optional()
          .describe('Billing country, such as IN or US. Used for checkout and pack'),
      }),
      outputSchema: z.object({
        output: z.any(),
      }),
      mcp: {
        annotations: {
          title: 'Billing',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      execute: async (inputData, context) => {
        try {
          const org = organizationFromTool(inputData, context);
          if (inputData.action === 'overview') {
            return this.overview(org.id);
          }
          const account = await this._entitlements.account(org.id);
          if (inputData.action === 'checkout') {
            return this.checkout(org, account, inputData);
          }
          const provider = await this._payment.getProviderForOrganization(
            account.billingOrganizationId,
            'web'
          );
          if (inputData.action === 'portal') {
            const { url } = await provider.portalLink(account.billingOrganizationId);
            if (!url) {
              return { output: { error: 'The billing portal did not return a URL.' } };
            }
            return { output: { portal: url } };
          }
          if (!inputData.pack) {
            return { output: { error: 'pack is required' } };
          }
          const actor = await accountActor(this._users, this._organizations, org);
          const result = await provider.buyPack(
            account.billingOrganizationId,
            actor.user.id,
            inputData.pack,
            inputData.country || ''
          );
          const url = checkoutUrl(result);
          if (!url) {
            return { output: { error: 'Checkout did not return a URL.' } };
          }
          return { output: { url } };
        } catch (err) {
          const failure = toolFailure(err);
          if (failure) return failure;
          throw err;
        }
      },
    });
  }

  private async overview(organizationId: string) {
    const organization = await this._organizations.getOrgById(organizationId);
    if (!organization) {
      return { output: { error: 'Workspace not found' } };
    }
    return {
      output: billingRead(await this._billingRead.overview(organization)),
    };
  }

  private async checkout(
    org: ToolOrganization,
    account: BillingAccount,
    input: BillingInput
  ) {
    if (!input.billing || !input.period) {
      return { output: { error: 'billing and period are required' } };
    }
    const actor = await accountActor(this._users, this._organizations, org);
    // The billing screen returns { blocked: true } before checkout when
    // another account with this email already has a subscription.
    const other = await this._users.getUserWithActiveSubscriptionByEmail(
      actor.user.email,
      actor.user.id
    );
    if (other) {
      return { output: { blocked: true } };
    }
    // subscribe() changes an existing Dodo plan in place and returns
    // { changed }. That path is not used. A checkout URL exists only when
    // the workspace has no subscription.
    if (account.subscription) {
      return {
        output: {
          error:
            'This workspace already has a subscription, so there is no checkout URL. The plan was not changed.',
        },
      };
    }
    const provider = await this._payment.getProviderForOrganization(
      account.billingOrganizationId,
      'web'
    );
    const result = await provider.subscribe(
      '',
      account.billingOrganizationId,
      actor.user.id,
      {
        billing: input.billing,
        period: input.period,
        utm: '',
        dub: '',
        datafast_session_id: '',
        datafast_visitor_id: '',
        country: input.country || '',
      },
      account.allowTrial
    );
    const url = checkoutUrl(result);
    if (!url) {
      return {
        output: {
          error: 'Checkout did not return a URL. The plan was not changed.',
        },
      };
    }
    return { output: { url } };
  }
}
