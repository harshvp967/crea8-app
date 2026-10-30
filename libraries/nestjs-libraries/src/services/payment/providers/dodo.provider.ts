import { HttpException, Injectable } from '@nestjs/common';
import DodoPayments from 'dodopayments';
import { Prisma } from '@prisma/client';
import { BillingSubscribeDto } from '@gitroom/nestjs-libraries/dtos/billing/billing.subscribe.dto';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { UsersService } from '@gitroom/nestjs-libraries/database/prisma/users/users.service';
import { CreditsService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/credits.service';
import {
  PAID_TIERS,
  PLANS,
  PaidTier,
  SUPPORT_EMAIL,
  TRIAL_DAYS,
  packByKey,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';
import { pricing } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';
import {
  cancelAccessUntil,
  displayedPlanAfterEvent,
  dodoCheckoutPrefill,
  dodoEnvironment,
  dodoProductId,
  dodoWebhookSecret,
  frontendUrl,
  ignoreRemoteSubscription,
  invoiceIsVisible,
  isUpgrade,
  monthlyCreditAllowance,
  monthlyCycleKey,
  packGrantFromPayment,
  planChangeBilling,
  preservedTrialEnd,
  subscriptionProductId,
  tierFromProductId,
  verifyDodoSignature,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.rules';
import {
  PaymentPlatform,
  PaymentProvider,
  PaymentProviderAbstract,
} from '@gitroom/nestjs-libraries/services/payment/payment.provider.interface';
import { DODO_PROVIDER } from '@gitroom/nestjs-libraries/services/payment/payment.providers';

type Tx = Prisma.TransactionClient;

@PaymentProvider({ provider: DODO_PROVIDER })
export class DodoProvider extends PaymentProviderAbstract {
  platform: PaymentPlatform = 'web';

  constructor(
    private _prisma: PrismaService,
    private _organizationService: OrganizationService,
    private _usersService: UsersService,
    private _credits: CreditsService
  ) {
    super();
  }

  private client() {
    return new DodoPayments({
      bearerToken: process.env.DODO_PAYMENTS_API_KEY || '',
      environment: dodoEnvironment(),
      webhookKey: dodoWebhookSecret() || null,
    });
  }

  validateWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>
  ) {
    try {
      return verifyDodoSignature(rawBody, headers, dodoWebhookSecret());
    } catch (err) {
      throw new HttpException(
        err instanceof Error ? err.message : 'Invalid webhook signature',
        400
      );
    }
  }

  async processWebhook(event: { id: string; payload: any }) {
    const type = String(event?.payload?.type || '');
    const data = event?.payload?.data || {};
    const existing = await this._prisma.processedWebhookEvent.findUnique({
      where: { id: event.id },
    });
    if (existing) {
      return { ok: true, duplicate: true };
    }
    try {
      await this._prisma.$transaction(async (tx) => {
        await tx.processedWebhookEvent.create({
          data: { id: event.id, provider: DODO_PROVIDER, eventType: type },
        });
        if (type.startsWith('subscription.')) {
          await this.applySubscription(tx, type, data);
          return;
        }
        if (type === 'payment.succeeded') {
          await this.applyPackPayment(tx, data);
        }
      });
    } catch (err) {
      if ((err as { code?: string })?.code === 'P2002') {
        return { ok: true, duplicate: true };
      }
      throw err;
    }
    return { ok: true };
  }

  private async applySubscription(tx: Tx, type: string, data: any) {
    const remote = await this.remoteSubscription(data?.subscription_id);
    const source = remote || data;
    const organizationId = await this.organizationIdFor(tx, source);
    if (!organizationId) {
      return;
    }
    const mapped = tierFromProductId(source.product_id) || {
      tier: (source?.metadata?.billing || null) as PaidTier | null,
      period: (source?.metadata?.period || 'MONTHLY') as 'MONTHLY' | 'YEARLY',
    };
    if (!mapped.tier || !PLANS[mapped.tier]) {
      return;
    }
    const status = String(source.status || 'active');
    const existing = await tx.subscription.findUnique({
      where: { organizationId },
    });
    const hadLive = !!existing && !existing.deletedAt && existing.status !== 'failed' && existing.status !== 'pending';
    if (ignoreRemoteSubscription({ status, hadLiveSubscription: hadLive })) {
      return;
    }
    // A renewal is a successful recurring charge, including the charge that
    // ends the trial. The trial cap applies only before that charge.
    const inTrial = type === 'subscription.renewed' ? false : this.inTrial(source);
    const ended = ['cancelled', 'expired'].includes(status);
    const cancelAt =
      source.cancel_at_next_billing_date && source.next_billing_date
        ? new Date(source.next_billing_date)
        : null;
    const customerId = source?.customer?.customer_id || null;
    const incomingEnd = source.next_billing_date
      ? new Date(source.next_billing_date).toISOString()
      : null;
    const periodEnd = inTrial
      ? preservedTrialEnd({
          previousEnd: existing?.currentPeriodEnd?.toISOString() || null,
          incomingEnd,
          createdAt: source.created_at || existing?.createdAt?.toISOString() || null,
          trialDays: TRIAL_DAYS,
        })
      : incomingEnd;
    const shown = displayedPlanAfterEvent({
      currentTier: existing?.subscriptionTier || 'FREE',
      currentPeriod: existing?.period || null,
      pendingTier: existing?.pendingTier || null,
      pendingPeriod: existing?.pendingPeriod || null,
      eventType: type,
      eventTier: mapped.tier,
      eventPeriod: mapped.period,
    });
    const tier = shown.tier;
    await tx.organization.update({
      where: { id: organizationId },
      data: {
        ...(customerId ? { paymentId: customerId } : {}),
        isTrailing: !ended && inTrial,
        allowTrial: false,
      },
    });
    const nextStatus = ended ? (inTrial ? 'trial_ended' : status) : inTrial ? 'trialing' : status;
    await tx.subscription.upsert({
      where: { organizationId },
      create: {
        organizationId,
        subscriptionTier: tier,
        provider: DODO_PROVIDER,
        identifier: source.subscription_id || null,
        period: shown.period || mapped.period,
        totalChannels: PLANS[tier].channels,
        status: nextStatus,
        cancelAt,
        currentPeriodEnd: periodEnd ? new Date(periodEnd) : null,
        pendingTier: shown.pendingTier,
        pendingPeriod: shown.pendingPeriod,
        deletedAt: ended ? new Date() : null,
      },
      update: {
        subscriptionTier: tier,
        provider: DODO_PROVIDER,
        identifier: source.subscription_id || null,
        period: shown.period || mapped.period,
        totalChannels: PLANS[tier].channels,
        status: nextStatus,
        cancelAt,
        currentPeriodEnd: periodEnd ? new Date(periodEnd) : null,
        pendingTier: shown.pendingTier,
        pendingPeriod: shown.pendingPeriod,
        deletedAt: ended ? new Date() : null,
      },
    });
    if (!ended && (type === 'subscription.active' || type === 'subscription.renewed')) {
      const cycleKey = source.previous_billing_date || source.created_at || source.subscription_id;
      const grantingTrial = inTrial && type !== 'subscription.renewed';
      await this._credits.grantMonthly(
        tx,
        organizationId,
        monthlyCycleKey(String(cycleKey), grantingTrial),
        monthlyCreditAllowance(tier, grantingTrial)
      );
    }
  }

  private async applyPackPayment(tx: Tx, data: any) {
    let source = data;
    if (
      !packGrantFromPayment(source) &&
      !data?.subscription_id &&
      data?.payment_id &&
      process.env.DODO_PAYMENTS_API_KEY
    ) {
      try {
        const remote = await this.client().payments.retrieve(String(data.payment_id));
        if (remote) {
          source = remote;
        }
      } catch {
        return;
      }
    }
    await this._credits.applyReportedPackPayment(
      tx,
      source,
      await this.organizationIdFor(tx, source)
    );
  }

  private async organizationIdFor(tx: Tx, source: any) {
    const fromMetadata = source?.metadata?.organizationId;
    if (fromMetadata) {
      return String(fromMetadata);
    }
    const customerId = source?.customer?.customer_id;
    if (!customerId) {
      return null;
    }
    const org = await tx.organization.findFirst({
      where: { paymentId: String(customerId) },
      select: { id: true },
    });
    return org?.id || null;
  }

  private inTrial(source: any) {
    const days = Number(source?.trial_period_days || 0);
    if (!days || !source?.created_at) {
      return false;
    }
    const ends = new Date(source.created_at).getTime() + days * 24 * 60 * 60 * 1000;
    return Date.now() < ends;
  }

  private async remoteSubscription(subscriptionId?: string) {
    if (!subscriptionId || !process.env.DODO_PAYMENTS_API_KEY) {
      return null;
    }
    try {
      return await this.client().subscriptions.retrieve(subscriptionId);
    } catch {
      return null;
    }
  }

  async subscribe(
    _uniqueId: string,
    organizationId: string,
    userId: string,
    body: BillingSubscribeDto,
    allowTrial: boolean
  ) {
    const current = await this._prisma.subscription.findFirst({
      where: { organizationId, deletedAt: null, provider: DODO_PROVIDER },
    });
    if (current?.identifier) {
      return this.changePlan(organizationId, current.identifier, body);
    }
    return this.checkout(organizationId, userId, body, allowTrial, 'subscription');
  }

  async embedded(
    uniqueId: string,
    organizationId: string,
    userId: string,
    body: BillingSubscribeDto,
    allowTrial: boolean
  ) {
    return this.subscribe(uniqueId, organizationId, userId, body, allowTrial);
  }

  async buyPack(
    organizationId: string,
    userId: string,
    packKey: string,
    country?: string
  ) {
    const pack = packByKey(packKey);
    if (!pack) {
      throw new HttpException('Unknown credit pack', 400);
    }
    return this.checkout(
      organizationId,
      userId,
      {
        billing: 'STANDARD',
        period: 'MONTHLY',
        utm: '',
        dub: '',
        datafast_session_id: '',
        datafast_visitor_id: '',
        country: country || '',
      },
      false,
      'credit_pack',
      pack.key
    );
  }

  private async checkout(
    organizationId: string,
    userId: string,
    body: BillingSubscribeDto,
    allowTrial: boolean,
    kind: 'subscription' | 'credit_pack',
    packKey?: string
  ) {
    const pack = packKey ? packByKey(packKey) : null;
    const productId = pack
      ? dodoProductId(pack.key)
      : subscriptionProductId(body.billing, body.period);
    if (!productId) {
      throw new HttpException(
        'This Dodo product is not configured yet. Add its product id before charging.',
        400
      );
    }
    const org = await this._organizationService.getOrgById(organizationId);
    const user = await this._usersService.getUserById(userId);
    if (!org || !user?.email) {
      throw new HttpException('Account not found', 400);
    }
    const prefill = dodoCheckoutPrefill({
      name: user.name,
      lastName: user.lastName,
      country: body.country,
      phone: null,
    });
    const base = frontendUrl();
    const session = await this.client().checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: {
        email: user.email,
        ...(prefill.name ? { name: prefill.name } : {}),
        ...(prefill.phoneNumber ? { phone_number: prefill.phoneNumber } : {}),
      },
      ...(prefill.country === 'IN'
        ? { billing_address: { country: 'IN' as const }, billing_currency: 'INR' as const }
        : { billing_currency: 'USD' as const }),
      feature_flags: {
        allow_customer_editing_name: true,
        allow_customer_editing_country: true,
        allow_phone_number_collection: true,
        ...(kind === 'credit_pack' ? { single_page: true } : {}),
      },
      subscription_data:
        kind === 'subscription' && allowTrial
          ? { trial_period_days: TRIAL_DAYS }
          : undefined,
      metadata: {
        organizationId,
        userId,
        kind,
        billing: body.billing,
        period: body.period,
        ...(pack ? { pack: pack.key, credits: pack.credits } : {}),
      },
      return_url: `${base}/billing?checkout=pending`,
      cancel_url: `${base}/billing?checkout=failure`,
    });
    return { url: session.checkout_url };
  }

  private async changePlan(
    organizationId: string,
    subscriptionId: string,
    body: BillingSubscribeDto
  ) {
    const productId = subscriptionProductId(body.billing, body.period);
    if (!productId) {
      throw new HttpException('This Dodo product is not configured yet.', 400);
    }
    const current = await this._prisma.subscription.findFirst({
      where: { organizationId, deletedAt: null },
    });
    const upgrade = isUpgrade(
      current?.subscriptionTier || 'FREE',
      body.billing,
      current?.period || 'MONTHLY',
      body.period
    );
    const inTrial = current?.status === 'trialing';
    const trialEndsAt = current?.currentPeriodEnd?.toISOString() || null;
    const decision = planChangeBilling({ inTrial, upgrade, trialEndsAt });
    await this.client().subscriptions.changePlan(subscriptionId, {
      product_id: productId,
      quantity: 1,
      proration_billing_mode: decision.prorationBillingMode,
      effective_at: decision.effectiveAt,
      on_payment_failure: 'prevent_change',
    });
    if (decision.keepTrialEnd) {
      await this.client().subscriptions.update(subscriptionId, {
        next_billing_date: decision.keepTrialEnd,
      });
    }
    if (current && decision.applyTierNow) {
      await this._prisma.subscription.update({
        where: { organizationId },
        data: {
          subscriptionTier: body.billing,
          period: body.period,
          totalChannels: PLANS[body.billing].channels,
          pendingTier: null,
          pendingPeriod: null,
          status: inTrial ? 'trialing' : current.status,
          currentPeriodEnd: decision.keepTrialEnd ? new Date(decision.keepTrialEnd) : current.currentPeriodEnd,
        },
      });
    } else if (current) {
      await this._prisma.subscription.update({
        where: { organizationId },
        data: { pendingTier: body.billing, pendingPeriod: body.period },
      });
    }
    return { changed: true, upgrade, trial: inTrial, chargedNow: decision.chargeNow };
  }

  async prorate(organizationId: string, body: BillingSubscribeDto) {
    const current = await this._prisma.subscription.findFirst({
      where: { organizationId, deletedAt: null, provider: DODO_PROVIDER },
    });
    if (!current?.identifier) {
      const price =
        body.period === 'YEARLY'
          ? pricing[body.billing].year_price
          : pricing[body.billing].month_price;
      return { price };
    }
    const upgrade = isUpgrade(
      current.subscriptionTier || 'FREE',
      body.billing,
      current.period || 'MONTHLY',
      body.period
    );
    if (current.status === 'trialing' || !upgrade) {
      return {
        price: 0,
        currency: 'USD',
        trial: current.status === 'trialing',
        scheduled: !upgrade,
        trialEndsAt: current.currentPeriodEnd?.toISOString() || null,
      };
    }
    const productId = subscriptionProductId(body.billing, body.period);
    if (!productId) {
      return { price: 0 };
    }
    const preview = await this.client().subscriptions.previewChangePlan(
      current.identifier,
      {
        product_id: productId,
        quantity: 1,
        proration_billing_mode: 'prorated_immediately',
      }
    );
    return {
      price: (preview.immediate_charge?.summary?.total_amount || 0) / 100,
      currency: preview.immediate_charge?.summary?.currency || 'USD',
    };
  }

  async setToCancel(organizationId: string) {
    const current = await this._prisma.subscription.findFirst({
      where: { organizationId, deletedAt: null, provider: DODO_PROVIDER },
    });
    if (!current?.identifier) {
      return { cancelAt: null };
    }
    const cancel = !current.cancelAt;
    const org = await this._organizationService.getOrgById(organizationId);
    const remote = cancel ? await this.remoteSubscription(current.identifier) : null;
    const remoteEnd = remote?.next_billing_date ? new Date(remote.next_billing_date) : null;
    const inTrial = current.status === 'trialing' || !!org?.isTrailing;
    const until = cancel
      ? cancelAccessUntil({
          currentPeriodEnd: current.currentPeriodEnd,
          createdAt: current.createdAt,
          inTrial,
          trialDays: TRIAL_DAYS,
        }) || remoteEnd
      : null;
    await this.client().subscriptions.update(current.identifier, {
      cancel_at_next_billing_date: cancel,
    });
    await this._prisma.subscription.update({
      where: { organizationId },
      data: {
        cancelAt: cancel ? until : null,
        currentPeriodEnd: current.currentPeriodEnd || until,
        status: cancel ? 'cancel_scheduled' : inTrial ? 'trialing' : 'active',
      },
    });
    return { cancelAt: cancel ? until : null };
  }

  async cancelAllSubscriptions(organizationId: string) {
    const current = await this._prisma.subscription.findFirst({
      where: { organizationId, provider: DODO_PROVIDER, deletedAt: null },
    });
    if (!current?.identifier || !process.env.DODO_PAYMENTS_API_KEY) {
      return;
    }
    try {
      await this.client().subscriptions.update(current.identifier, {
        status: 'cancelled',
      });
    } catch {
      return;
    }
  }

  async portalLink(organizationId: string) {
    const org = await this._organizationService.getOrgById(organizationId);
    if (!org?.paymentId) {
      throw new HttpException('No billing customer yet', 400);
    }
    const session = await this.client().customers.customerPortal.create(org.paymentId, {
      return_url: `${frontendUrl()}/billing`,
    });
    return { url: session.link };
  }

  async checkSubscription(organizationId: string, subscriptionId: string) {
    const row = await this._prisma.subscription.findFirst({
      where: { organizationId, identifier: subscriptionId, deletedAt: null },
    });
    return !!row;
  }

  async getPackages() {
    return PAID_TIERS.map((tier) => ({
      tier,
      name: PLANS[tier].displayName,
      month_price: PLANS[tier].monthPriceUsd,
      year_price: PLANS[tier].yearPriceUsd,
    }));
  }

  async getCharges(organizationId: string) {
    return this.invoices(organizationId);
  }

  async invoices(organizationId: string) {
    const org = await this._organizationService.getOrgById(organizationId);
    if (!org?.paymentId || !process.env.DODO_PAYMENTS_API_KEY) {
      return [];
    }
    const page = await this.client().payments.list({
      customer_id: org.paymentId,
      page_size: 20,
    });
    const rows = [];
    for await (const payment of page) {
      const amount = (payment.total_amount || 0) / 100;
      const status = payment.status || '';
      if (!invoiceIsVisible({ amount, status })) {
        continue;
      }
      rows.push({
        id: payment.payment_id,
        amount,
        currency: payment.currency,
        status,
        createdAt: String(payment.created_at),
        url: payment.invoice_url || null,
        invoiceId: payment.invoice_id || null,
      });
      if (rows.length >= 20) {
        break;
      }
    }
    rows.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
    return rows;
  }

  supportEmail() {
    return SUPPORT_EMAIL;
  }
}
