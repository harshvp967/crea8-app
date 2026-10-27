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
  dodoEnvironment,
  dodoProductId,
  dodoWebhookSecret,
  frontendUrl,
  isUpgrade,
  monthlyCreditAllowance,
  monthlyCycleKey,
  packCreditsFromProduct,
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
    // A renewal is a successful recurring charge, including the charge that
    // ends the trial. The trial cap applies only before that charge.
    const inTrial = type === 'subscription.renewed' ? false : this.inTrial(source);
    const ended = ['cancelled', 'expired', 'failed'].includes(status);
    const cancelAt =
      source.cancel_at_next_billing_date && source.next_billing_date
        ? new Date(source.next_billing_date)
        : null;
    const customerId = source?.customer?.customer_id || null;
    await tx.organization.update({
      where: { id: organizationId },
      data: {
        ...(customerId ? { paymentId: customerId } : {}),
        isTrailing: !ended && inTrial,
        allowTrial: false,
      },
    });
    await tx.subscription.upsert({
      where: { organizationId },
      create: {
        organizationId,
        subscriptionTier: mapped.tier,
        provider: DODO_PROVIDER,
        identifier: source.subscription_id || null,
        period: mapped.period,
        totalChannels: PLANS[mapped.tier].channels,
        status: ended ? (inTrial ? 'trial_ended' : status) : inTrial ? 'trialing' : status,
        cancelAt,
        currentPeriodEnd: source.next_billing_date
          ? new Date(source.next_billing_date)
          : null,
        deletedAt: ended ? new Date() : null,
      },
      update: {
        subscriptionTier: mapped.tier,
        provider: DODO_PROVIDER,
        identifier: source.subscription_id || null,
        period: mapped.period,
        totalChannels: PLANS[mapped.tier].channels,
        status: ended ? (inTrial ? 'trial_ended' : status) : inTrial ? 'trialing' : status,
        cancelAt,
        currentPeriodEnd: source.next_billing_date
          ? new Date(source.next_billing_date)
          : null,
        pendingTier: ended || type === 'subscription.plan_changed' ? null : undefined,
        pendingPeriod: ended || type === 'subscription.plan_changed' ? null : undefined,
        deletedAt: ended ? new Date() : null,
      },
    });
    if (!ended && (type === 'subscription.active' || type === 'subscription.renewed')) {
      const cycleKey = source.previous_billing_date || source.created_at || source.subscription_id;
      await this._credits.grantMonthly(
        tx,
        organizationId,
        monthlyCycleKey(String(cycleKey), inTrial),
        monthlyCreditAllowance(mapped.tier, inTrial)
      );
    }
  }

  private async applyPackPayment(tx: Tx, data: any) {
    const metadata = data?.metadata || {};
    const productId = data?.product_cart?.[0]?.product_id || metadata.product_id;
    const credits = Number(metadata.credits || 0) || packCreditsFromProduct(String(productId || ''));
    if (metadata.kind !== 'credit_pack' && !packCreditsFromProduct(String(productId || ''))) {
      return;
    }
    const organizationId = String(metadata.organizationId || '');
    if (!organizationId || credits <= 0) {
      return;
    }
    const paymentId = String(data.payment_id || metadata.payment_id || '');
    if (!paymentId) {
      return;
    }
    await this._credits.grantPack(tx, organizationId, credits, `pack:${paymentId}`);
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
    const country = (body.country || '').toUpperCase();
    const india = country === 'IN';
    const base = frontendUrl();
    const session = await this.client().checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: { email: user.email, name: user.name || org.name },
      ...(india
        ? { billing_address: { country: 'IN' as const }, billing_currency: 'INR' as const }
        : { billing_currency: 'USD' as const }),
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
    await this.client().subscriptions.changePlan(subscriptionId, {
      product_id: productId,
      quantity: 1,
      proration_billing_mode: upgrade ? 'prorated_immediately' : 'do_not_bill',
    });
    if (!upgrade && current) {
      await this._prisma.subscription.update({
        where: { organizationId },
        data: { pendingTier: body.billing, pendingPeriod: body.period },
      });
    }
    return { changed: true, upgrade };
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
    await this.client().subscriptions.update(current.identifier, {
      cancel_at_next_billing_date: cancel,
    });
    const cancelAt = cancel ? current.currentPeriodEnd || new Date() : null;
    await this._prisma.subscription.update({
      where: { organizationId },
      data: { cancelAt, status: cancel ? 'cancel_scheduled' : 'active' },
    });
    return { cancelAt };
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
      rows.push({
        id: payment.payment_id,
        amount: (payment.total_amount || 0) / 100,
        currency: payment.currency,
        status: payment.status || 'succeeded',
        createdAt: payment.created_at,
        url: payment.invoice_url || null,
        invoiceId: payment.invoice_id || null,
      });
      if (rows.length >= 20) {
        break;
      }
    }
    return rows;
  }

  supportEmail() {
    return SUPPORT_EMAIL;
  }
}
