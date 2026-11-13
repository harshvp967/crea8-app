import { HttpException, Injectable, Logger } from '@nestjs/common';
import DodoPayments from 'dodopayments';
import { Prisma } from '@prisma/client';
import { BillingSubscribeDto } from '@gitroom/nestjs-libraries/dtos/billing/billing.subscribe.dto';
import { isGrandfatheredOrg } from '@gitroom/helpers/utils/billing.enabled';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { UsersService } from '@gitroom/nestjs-libraries/database/prisma/users/users.service';
import {
  loadBillingAccount,
  subscriptionGrantsAccess,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.account';
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
  ACTIVE_SUBSCRIPTION_ERROR,
  adoptIncomingSubscription,
  cancelAccessUntil,
  displayedPlanAfterEvent,
  reconcileLiveSubscriptions,
  remoteSubscriptionIsLive,
  storedStatusForLiveSubscription,
  type ListedSubscription,
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
  isSucceededPackEvent,
  packGrantFromPayment,
  planChangeBilling,
  subscriptionChargeEndsTrial,
  preservedTrialEnd,
  subscriptionSwitch,
  subscriptionProductId,
  tierFromProductId,
  verifyDodoSignature,
  creditPackCheckoutError,
  creditPackCheckoutInput,
  hasPaidSubscriptionCharge,
  type SubscriptionCharge,
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
  private readonly _logger = new Logger(DodoProvider.name);

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
    const type = String(event?.payload?.type || event?.payload?.event_type || '')
      .trim()
      .toLowerCase();
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
        if (isSucceededPackEvent(type)) {
          await this.applyPackPayment(tx, data);
          await this.liftTrialOnSubscriptionCharge(tx, data);
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
    const status = String(source.status || 'active');
    const existing = await tx.subscription.findUnique({
      where: { organizationId },
    });
    const incomingId = String(source.subscription_id || '');
    const customerId = source?.customer?.customer_id
      ? String(source.customer.customer_id)
      : null;
    // A second subscription id must not replace the plan already shown.
    // Cancel that Dodo subscription so the workspace keeps one.
    if (
      !adoptIncomingSubscription({
        storedId: existing?.identifier,
        incomingId,
        storedGrantsAccess: subscriptionGrantsAccess(existing),
      })
    ) {
      await this.cancelListedStrays({
        organizationId,
        customerId,
        keepId: existing?.identifier || null,
        alsoCancel: remoteSubscriptionIsLive(status) ? [incomingId] : [],
      });
      return;
    }
    const mapped = tierFromProductId(source.product_id) || {
      tier: (source?.metadata?.billing || null) as PaidTier | null,
      period: (source?.metadata?.period || 'MONTHLY') as 'MONTHLY' | 'YEARLY',
    };
    if (!mapped.tier || !PLANS[mapped.tier]) {
      return;
    }
    const hadLive = !!existing && !existing.deletedAt && existing.status !== 'failed' && existing.status !== 'pending';
    if (ignoreRemoteSubscription({ status, hadLiveSubscription: hadLive })) {
      return;
    }
    // A renewal is a successful recurring charge, including the charge that
    // ends the trial. A paid cycle already on the ledger means that charge
    // landed, so a later event must not put the 50-credit cap back.
    const balance = await tx.creditBalance.findUnique({
      where: { organizationId },
      select: { cycleKey: true },
    });
    const paidCycle =
      !!balance?.cycleKey &&
      !String(balance.cycleKey).startsWith('trial:') &&
      !String(balance.cycleKey).startsWith('gf:');
    let inTrial =
      type === 'subscription.renewed' || paidCycle ? false : this.inTrial(source);
    if (inTrial && (await this.hasPaidCharge(organizationId))) {
      inTrial = false;
    }
    const ended = ['cancelled', 'expired'].includes(status);
    const cancelAt =
      source.cancel_at_next_billing_date && source.next_billing_date
        ? new Date(source.next_billing_date)
        : null;
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
    if (
      !ended &&
      (type === 'subscription.active' ||
        type === 'subscription.renewed' ||
        type === 'subscription.plan_changed')
    ) {
      const cycleKey = source.previous_billing_date || source.created_at || source.subscription_id;
      const grantingTrial = inTrial && type !== 'subscription.renewed';
      await this._credits.grantMonthly(
        tx,
        organizationId,
        monthlyCycleKey(String(cycleKey), grantingTrial),
        monthlyCreditAllowance(tier, grantingTrial)
      );
    }
    if (!ended && incomingId) {
      await this.cancelListedStrays({
        organizationId,
        customerId,
        keepId: incomingId,
      });
    }
  }

  private async applyPackPayment(tx: Tx, data: any) {
    let source = data;
    const paymentId = String(data?.payment_id || '');
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
        this.skipPack(paymentId, '', 'could not load the Dodo payment');
        return;
      }
    }
    const organizationId = await this.organizationIdFor(tx, source);
    const granted = await this._credits.applyReportedPackPayment(
      tx,
      source,
      organizationId,
      organizationId ? await this.subscriptionCharges(organizationId) : []
    );
    if (!granted) {
      this.skipPack(
        String(source?.payment_id || paymentId),
        organizationId,
        'grant was not applied'
      );
    }
  }

  private skipPack(
    paymentId: string,
    organizationId: string | null | undefined,
    reason: string
  ) {
    this._logger.warn(
      `Pack grant skipped (${reason}). payment=${paymentId || 'unknown'} org=${organizationId || 'unknown'}`
    );
  }

  // The first paid subscription charge replaces the 50-credit trial grant
  // with the plan allowance. A pack payment and a $0 trial checkout do not.
  private async liftTrialOnSubscriptionCharge(
    tx: Tx,
    data: any,
    knownOrganizationId?: string | null
  ) {
    if (!subscriptionChargeEndsTrial(data)) {
      return;
    }
    const organizationId =
      knownOrganizationId || (await this.organizationIdFor(tx, data));
    if (!organizationId) {
      return;
    }
    const existing = await tx.subscription.findUnique({
      where: { organizationId },
    });
    const org = await tx.organization.findUnique({
      where: { id: organizationId },
      select: { isTrailing: true },
    });
    const trailing = existing?.status === 'trialing' || !!org?.isTrailing;
    if (!existing || !trailing) {
      return;
    }
    const tier = existing.subscriptionTier;
    const amount = monthlyCreditAllowance(tier, false);
    if (!tier || !PLANS[tier as PaidTier] || amount <= 0) {
      return;
    }
    const balance = await tx.creditBalance.findUnique({
      where: { organizationId },
      select: { cycleKey: true },
    });
    const stored = balance?.cycleKey || '';
    const cycleKey = stored.startsWith('trial:')
      ? stored.slice('trial:'.length) || String(existing.identifier || organizationId)
      : stored || String(existing.identifier || organizationId);
    await tx.organization.update({
      where: { id: organizationId },
      data: { isTrailing: false, allowTrial: false },
    });
    await tx.subscription.update({
      where: { organizationId },
      data: {
        status: existing.status === 'trialing' ? 'active' : existing.status,
      },
    });
    await this._credits.grantMonthly(tx, organizationId, cycleKey, amount);
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

  private liveSync = new Map<string, { at: number; pending?: Promise<void> }>();

  // Next billing read. Cancels every live Dodo subscription except the one
  // the workspace already shows. When that stored id is not live, the row is
  // rewritten to the single remaining subscription. Failures stay off the
  // billing response and are retried on the next read.
  override async reconcileLiveSubscriptions(organizationId: string) {
    const now = Date.now();
    const slot = this.liveSync.get(organizationId);
    if (slot?.pending) {
      try {
        await slot.pending;
      } catch {
        return;
      }
      return;
    }
    if (slot && now - slot.at < 60_000) {
      return;
    }
    const pending = this.reconcileLiveOnce(organizationId)
      .then(() => {
        this.liveSync.set(organizationId, { at: Date.now() });
      })
      .catch((err) => {
        this.liveSync.delete(organizationId);
        throw err;
      });
    this.liveSync.set(organizationId, { at: now, pending });
    try {
      await pending;
    } catch (err) {
      this._logger.warn(
        `Could not reconcile subscriptions for ${organizationId}: ${
          err instanceof Error ? err.message : err
        }`
      );
    }
  }

  private async reconcileLiveOnce(organizationId: string) {
    const org = await this._organizationService.getOrgById(organizationId);
    if (!org?.paymentId || !process.env.DODO_PAYMENTS_API_KEY) {
      return;
    }
    const listed = await this.listedSubscriptions(String(org.paymentId));
    const existing = await this._prisma.subscription.findUnique({
      where: { organizationId },
    });
    const decision = reconcileLiveSubscriptions({
      storedId: existing?.identifier,
      listed,
    });
    await this.cancelStraySubscriptions(decision.cancelIds);
    if (!decision.keepId || decision.keepId === (existing?.identifier || null)) {
      return;
    }
    const keeper = listed.find((row) => row.subscriptionId === decision.keepId);
    if (!keeper) {
      return;
    }
    await this.adoptKeptSubscription(organizationId, keeper, !!existing);
  }

  private async replaceInsteadOfCheckout(
    organizationId: string,
    body: BillingSubscribeDto
  ) {
    const org = await this._organizationService.getOrgById(organizationId);
    if (!org?.paymentId || !process.env.DODO_PAYMENTS_API_KEY) {
      return null;
    }
    const listed = await this.listedSubscriptions(String(org.paymentId));
    const decision = reconcileLiveSubscriptions({ storedId: null, listed });
    if (!decision.keepId) {
      return null;
    }
    await this.cancelStraySubscriptions(decision.cancelIds);
    const keeper = listed.find((row) => row.subscriptionId === decision.keepId);
    const mapped = keeper?.productId ? tierFromProductId(keeper.productId) : null;
    if (!keeper || !mapped) {
      throw new HttpException(ACTIVE_SUBSCRIPTION_ERROR, 400);
    }
    const switchDecision = subscriptionSwitch({
      grantsAccess: true,
      identifier: decision.keepId,
      canReplace: true,
      currentTier: mapped.tier,
      currentPeriod: mapped.period,
      requestedTier: body.billing,
      requestedPeriod: body.period,
    });
    if (switchDecision.action === 'current') {
      return { changed: false, current: true };
    }
    if (switchDecision.action === 'replace') {
      return this.changePlan(organizationId, switchDecision.identifier, body);
    }
    throw new HttpException(ACTIVE_SUBSCRIPTION_ERROR, 400);
  }

  private async cancelListedStrays(input: {
    organizationId: string;
    customerId?: string | null;
    keepId?: string | null;
    alsoCancel?: string[];
  }) {
    const cancel = new Set(
      (input.alsoCancel || []).filter((id) => id && id !== input.keepId)
    );
    let customerId = input.customerId || null;
    if (!customerId) {
      const org = await this._organizationService.getOrgById(input.organizationId);
      customerId = org?.paymentId ? String(org.paymentId) : null;
    }
    if (customerId && process.env.DODO_PAYMENTS_API_KEY) {
      const listed = await this.listedSubscriptions(customerId);
      const decision = reconcileLiveSubscriptions({
        storedId: input.keepId,
        listed,
      });
      for (const id of decision.cancelIds) {
        cancel.add(id);
      }
    }
    await this.cancelStraySubscriptions([...cancel]);
  }

  private async listedSubscriptions(customerId: string): Promise<ListedSubscription[]> {
    const page = await this.client().subscriptions.list({
      customer_id: customerId,
      page_size: 100,
    });
    const rows: ListedSubscription[] = [];
    for await (const row of page) {
      const subscriptionId = String(row?.subscription_id || '');
      if (!subscriptionId) {
        continue;
      }
      rows.push({
        subscriptionId,
        status: row?.status ? String(row.status) : null,
        createdAt: row?.created_at ? String(row.created_at) : null,
        productId: row?.product_id ? String(row.product_id) : null,
        nextBillingDate: row?.next_billing_date ? String(row.next_billing_date) : null,
        customerId: row?.customer?.customer_id
          ? String(row.customer.customer_id)
          : customerId,
        cancelAtNextBillingDate: !!row?.cancel_at_next_billing_date,
      });
      if (rows.length >= 100) {
        break;
      }
    }
    return rows;
  }

  private async cancelStraySubscriptions(ids: string[]) {
    if (!process.env.DODO_PAYMENTS_API_KEY) {
      return;
    }
    for (const id of ids) {
      if (!id) {
        continue;
      }
      try {
        await this.client().subscriptions.update(id, { status: 'cancelled' });
      } catch (err) {
        if (this.alreadyCancelled(err)) {
          continue;
        }
        throw err;
      }
    }
  }

  private alreadyCancelled(err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status === 404) {
      return true;
    }
    const message = (err instanceof Error ? err.message : String(err || '')).toLowerCase();
    return message.includes('already') && message.includes('cancel');
  }

  private async adoptKeptSubscription(
    organizationId: string,
    keeper: ListedSubscription,
    hasRow: boolean
  ) {
    const mapped = keeper.productId ? tierFromProductId(keeper.productId) : null;
    if (!mapped || !PLANS[mapped.tier]) {
      this._logger.warn(
        `Left the stored plan in place for ${organizationId}. The live subscription ${keeper.subscriptionId} has no mapped product.`
      );
      return;
    }
    const cancelAt =
      keeper.cancelAtNextBillingDate && keeper.nextBillingDate
        ? new Date(keeper.nextBillingDate)
        : null;
    const currentPeriodEnd = keeper.nextBillingDate
      ? new Date(keeper.nextBillingDate)
      : null;
    const row = (): Prisma.SubscriptionUncheckedCreateInput => ({
      organizationId,
      subscriptionTier: mapped.tier,
      period: mapped.period,
      identifier: keeper.subscriptionId,
      provider: DODO_PROVIDER,
      totalChannels: PLANS[mapped.tier].channels,
      status: storedStatusForLiveSubscription(keeper),
      pendingTier: null,
      pendingPeriod: null,
      deletedAt: null,
      cancelAt,
      currentPeriodEnd,
    });
    if (hasRow) {
      const { organizationId: storedOrganizationId, ...changes } = row();
      void storedOrganizationId;
      await this._prisma.subscription.update({
        where: { organizationId },
        data: changes,
      });
      return;
    }
    await this._prisma.subscription.create({ data: row() });
  }

  override async subscribe(
    _uniqueId: string,
    organizationId: string,
    userId: string,
    body: BillingSubscribeDto,
    allowTrial: boolean
  ) {
    const account = await loadBillingAccount(this._prisma, organizationId);
    const current = account.subscription;
    if (current?.identifier && current.provider === DODO_PROVIDER) {
      await this.cancelListedStrays({
        organizationId: account.billingOrganizationId,
        keepId: current.identifier,
      }).catch((err) => {
        this._logger.warn(
          `Could not cancel a duplicate subscription for ${account.billingOrganizationId}: ${
            err instanceof Error ? err.message : err
          }`
        );
      });
    }
    const decision = subscriptionSwitch({
      grantsAccess: !!current,
      identifier: current?.identifier,
      canReplace: !!current?.identifier && current.provider === DODO_PROVIDER,
      currentTier: current?.subscriptionTier,
      currentPeriod:
        current?.period === 'YEARLY' || current?.period === 'MONTHLY'
          ? current.period
          : null,
      requestedTier: body.billing,
      requestedPeriod: body.period,
    });
    if (decision.action === 'current') {
      return { changed: false, current: true };
    }
    if (decision.action === 'replace') {
      return this.changePlan(
        account.billingOrganizationId,
        decision.identifier,
        body
      );
    }
    if (decision.action === 'refuse') {
      throw new HttpException(ACTIVE_SUBSCRIPTION_ERROR, 400);
    }
    const held = await this.replaceInsteadOfCheckout(
      account.billingOrganizationId,
      body
    );
    if (held) {
      return held;
    }
    return this.checkout(
      account.billingOrganizationId,
      userId,
      body,
      allowTrial,
      'subscription'
    );
  }

  override async embedded(
    uniqueId: string,
    organizationId: string,
    userId: string,
    body: BillingSubscribeDto,
    allowTrial: boolean
  ) {
    return this.subscribe(uniqueId, organizationId, userId, body, allowTrial);
  }

  override async buyPack(
    organizationId: string,
    userId: string,
    packKey: string,
    country?: string
  ) {
    const pack = packByKey(packKey);
    if (!pack) {
      throw new HttpException('Unknown credit pack', 400);
    }
    const account = await loadBillingAccount(this._prisma, organizationId);
    if (!account.grandfathered && !isGrandfatheredOrg(organizationId)) {
      const packError = creditPackCheckoutError(
        creditPackCheckoutInput({
          ...account,
          charges: await this.subscriptionCharges(organizationId),
        })
      );
      if (packError) {
        throw new HttpException(packError, 400);
      }
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
    if (kind === 'subscription') {
      const account = await loadBillingAccount(this._prisma, organizationId);
      if (account.subscription) {
        throw new HttpException(ACTIVE_SUBSCRIPTION_ERROR, 400);
      }
    }
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
    const decision = planChangeBilling({
      inTrial,
      upgrade,
      trialEndsAt,
      fromPeriod:
        current?.period === 'YEARLY' || current?.period === 'MONTHLY'
          ? current.period
          : null,
      toPeriod: body.period,
    });
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
    const org = await this._organizationService.getOrgById(organizationId);
    const stillTrial = inTrial || !!org?.isTrailing;
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
      if (!stillTrial) {
        const balance = await this._credits.balance(organizationId);
        const cycleKey =
          balance.cycleKey && !balance.cycleKey.startsWith('trial:')
            ? balance.cycleKey
            : String(
                current.currentPeriodEnd?.toISOString() ||
                  new Date().toISOString().slice(0, 10)
              );
        await this._prisma.$transaction((tx) =>
          this._credits.grantMonthly(
            tx,
            organizationId,
            cycleKey,
            PLANS[body.billing].monthlyCredits
          )
        );
      }
    } else if (current) {
      await this._prisma.subscription.update({
        where: { organizationId },
        data: { pendingTier: body.billing, pendingPeriod: body.period },
      });
    }
    return { changed: true, upgrade, trial: inTrial, chargedNow: decision.chargeNow };
  }

  override async prorate(organizationId: string, body: BillingSubscribeDto) {
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

  override async setToCancel(organizationId: string) {
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

  override async cancelAllSubscriptions(organizationId: string) {
    if (!process.env.DODO_PAYMENTS_API_KEY) {
      return;
    }
    const current = await this._prisma.subscription.findFirst({
      where: { organizationId, provider: DODO_PROVIDER, deletedAt: null },
    });
    const ids = new Set<string>();
    if (current?.identifier) {
      ids.add(current.identifier);
    }
    try {
      const org = await this._organizationService.getOrgById(organizationId);
      if (org?.paymentId) {
        const listed = await this.listedSubscriptions(String(org.paymentId));
        for (const row of listed) {
          if (remoteSubscriptionIsLive(row.status)) {
            ids.add(row.subscriptionId);
          }
        }
      }
    } catch {
      // The stored id is still cancelled below when the list cannot be loaded.
    }
    if (!ids.size) {
      return;
    }
    try {
      await this.cancelStraySubscriptions([...ids]);
    } catch {
      return;
    }
  }

  override async portalLink(organizationId: string) {
    const org = await this._organizationService.getOrgById(organizationId);
    if (!org?.paymentId) {
      throw new HttpException('No billing customer yet', 400);
    }
    const session = await this.client().customers.customerPortal.create(org.paymentId, {
      return_url: `${frontendUrl()}/billing`,
    });
    return { url: session.link };
  }

  override async checkSubscription(organizationId: string, subscriptionId: string) {
    const row = await this._prisma.subscription.findFirst({
      where: { organizationId, identifier: subscriptionId, deletedAt: null },
    });
    return !!row;
  }

  override async getPackages() {
    return PAID_TIERS.map((tier) => ({
      tier,
      name: PLANS[tier].displayName,
      month_price: PLANS[tier].monthPriceUsd,
      year_price: PLANS[tier].yearPriceUsd,
    }));
  }

  override async getCharges(organizationId: string) {
    return this.invoices(organizationId);
  }

  private packSync = new Map<string, { at: number; pending?: Promise<void> }>();

  override async reconcileSucceededPacks(organizationId: string) {
    const now = Date.now();
    const slot = this.packSync.get(organizationId);
    if (slot?.pending) {
      try {
        await slot.pending;
      } catch {
        return;
      }
      return;
    }
    if (slot && now - slot.at < 60_000) {
      return;
    }
    const pending = this.grantListedPacks(organizationId)
      .then(() => {
        this.packSync.set(organizationId, { at: Date.now() });
      })
      .catch((err) => {
        this.packSync.delete(organizationId);
        throw err;
      });
    this.packSync.set(organizationId, { at: now, pending });
    try {
      await pending;
    } catch {
      return;
    }
  }

  private async grantListedPacks(organizationId: string) {
    const payments = await this.customerPayments(organizationId);
    const charges = this.chargesFromPayments(payments);
    for (const payment of payments) {
      const status = String(payment.status || '').trim().toLowerCase();
      if (status !== 'succeeded' && status !== 'paid') {
        const metadata =
          payment.metadata && typeof payment.metadata === 'object' ? payment.metadata : {};
        if (metadata.kind === 'credit_pack' || metadata.pack) {
          this.skipPack(
            String(payment.payment_id || ''),
            organizationId,
            `payment status ${status || 'missing'}`
          );
        }
        continue;
      }
      await this._prisma.$transaction(async (tx) => {
        await this._credits.applyCheckoutReturn(
          tx,
          { payment_id: payment.payment_id, status },
          payment,
          organizationId,
          charges
        );
        await this.liftTrialOnSubscriptionCharge(tx, payment, organizationId);
      });
    }
  }

  private chargesFromPayments(
    payments: readonly {
      total_amount?: number | null;
      status?: string | null;
      metadata?: { kind?: unknown } | null;
    }[]
  ): SubscriptionCharge[] {
    return payments.map((payment) => ({
      amount: Number(payment.total_amount || 0) / 100,
      status: payment.status || null,
      kind: typeof payment.metadata?.kind === 'string' ? payment.metadata.kind : null,
    }));
  }

  private async subscriptionCharges(organizationId: string): Promise<SubscriptionCharge[]> {
    try {
      const rows = await this.invoices(organizationId);
      return rows.map((row) => ({
        amount: row.amount,
        status: row.status,
      }));
    } catch {
      return [];
    }
  }

  private async hasPaidCharge(organizationId: string) {
    return hasPaidSubscriptionCharge(await this.subscriptionCharges(organizationId));
  }

  private async customerPayments(organizationId: string) {
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
      rows.push(payment);
      if (rows.length >= 20) {
        break;
      }
    }
    return rows;
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
