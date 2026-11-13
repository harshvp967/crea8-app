'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { PaidTier, TRIAL_DAYS, type PlanTier } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';
import { BillingOverview, BillingPlanCard, checkoutReturnKind, planCards } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.view';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { BillingShell } from '@gitroom/frontend/components/billing/billing.shell';
import {
  AccountBillingPlaceholder,
  AccountCreditsCard,
  AccountPlanCard,
  BillingSettings,
  CancelStrip,
  CheckoutStatus,
  CreditPacks,
  CreditsMeter,
  InvoiceList,
  Paywall,
  PlanPicker,
  StatusBanners,
  formatBillingDay,
} from '@gitroom/frontend/components/billing/billing.ui';
import { FAQComponent } from '@gitroom/frontend/components/billing/faq.component';
import { PricingSection } from '@gitroom/frontend/components/billing/pricing.section';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';

const activeEnough = new Set(['active', 'trialing', 'past_due', 'on_hold', 'cancel_scheduled']);

function ContinueToLink() {
  return (
    <Link href="/linkinbio" className="lib-metric-label underline">
      Continue to Link in Bio
    </Link>
  );
}

function SignInPaywall({
  period,
  busy,
  allowTrial,
  trialDays,
  currentTier,
  currentPeriod,
  onPeriod,
  onChoose,
}: {
  period: 'MONTHLY' | 'YEARLY';
  busy: boolean;
  allowTrial: boolean;
  trialDays: number;
  currentTier?: PlanTier | null;
  currentPeriod?: 'MONTHLY' | 'YEARLY' | null;
  onPeriod: (period: 'MONTHLY' | 'YEARLY') => void;
  onChoose: (tier: PaidTier) => void;
}) {
  return (
    <Paywall>
      <PricingSection
        period={period}
        busy={busy}
        allowTrial={allowTrial}
        trialDays={trialDays}
        currentTier={currentTier}
        currentPeriod={currentPeriod}
        onPeriod={onPeriod}
        onChoose={onChoose}
      />
      <ContinueToLink />
      <FAQComponent accordion />
    </Paywall>
  );
}

export function BillingScreen({
  mode,
  surface = 'page',
}: {
  mode: 'settings' | 'paywall';
  surface?: 'page' | 'account';
}) {
  const fetch = useFetch();
  const toaster = useToaster();
  const router = useRouter();
  const { mutate: refreshCache } = useSWRConfig();
  const user = useUser();
  const params = useSearchParams();
  const checkout = params.get('checkout');
  const paymentStatus = params.get('status');
  const returned = checkoutReturnKind({ checkout, status: paymentStatus });
  const load = useCallback(async (path: string) => {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error('Could not load billing');
    }
    return response.json();
  }, []);
  const { data, error, isLoading, mutate } = useSWR<BillingOverview>('/billing/overview', load, {
    refreshInterval: returned === 'pending' ? 2000 : 0,
  });
  const [period, setPeriod] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [busy, setBusy] = useState(false);
  const [packBusy, setPackBusy] = useState<string | null>(null);
  const [packError, setPackError] = useState('');
  const [showPlans, setShowPlans] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const plansRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (data?.subscription.period) {
      setPeriod(data.subscription.period);
    }
  }, [data?.subscription.period]);

  useEffect(() => {
    if (returned !== 'pending') {
      return;
    }
    void refreshCache('/user/self');
  }, [
    returned,
    data?.credits.total,
    data?.credits.monthlyRemaining,
    data?.credits.packRemaining,
    refreshCache,
  ]);

  useEffect(() => {
    if (!showPlans) {
      return;
    }
    plansRef.current?.scrollIntoView({ block: 'start' });
  }, [showPlans]);

  const choose = async (plan: BillingPlanCard) => {
    setBusy(true);
    const hasPlan = data && activeEnough.has(data.subscription.status) && !data.grandfathered;
    if (hasPlan) {
      try {
        const preview = await fetch('/billing/prorate', {
          method: 'POST',
          body: JSON.stringify({ billing: plan.tier, period }),
        });
        const body = await preview.json();
        const when = body?.trialEndsAt ? String(body.trialEndsAt).slice(0, 10) : '';
        const scheduled = Boolean(body?.scheduled) && !body?.trial;
        const renewalDay = scheduled
          ? formatBillingDay(
              body?.renewsAt ||
                body?.renewal ||
                body?.nextRenewal ||
                body?.trialEndsAt ||
                data?.subscription?.currentPeriodEnd
            )
          : '';
        const currentName = data?.subscription.displayName || 'The current plan';
        const detail = body?.trial
          ? `${plan.displayName} applies to the first charge${when ? ` on ${when}` : ''}. Nothing is charged today, and the trial end stays the same.`
          : scheduled
            ? renewalDay
              ? `${plan.displayName} will start on the next renewal, ${renewalDay}. ${currentName} stays until then.`
              : `${plan.displayName} will start on the next renewal. ${currentName} stays until then.`
            : body?.price
              ? `${plan.displayName} ${period.toLowerCase()} is about $${body.price} ${body.currency || 'USD'} today.`
              : `Switch to ${plan.displayName} (${period.toLowerCase()}).`;
        setBusy(false);
        if (
          await deleteDialog(
            detail,
            scheduled ? 'Schedule downgrade' : 'Continue',
            scheduled ? 'Schedule downgrade' : 'Confirm plan change',
            'Close',
            'primary'
          )
        ) {
          await subscribe(plan);
        }
      } catch {
        toaster.show('Could not preview this plan.', 'warning');
        setBusy(false);
      }
      return;
    }
    await subscribe(plan);
  };

  const subscribe = async (plan: BillingPlanCard) => {
    setBusy(true);
    let leave = false;
    try {
      const response = await fetch('/billing/subscribe', {
        method: 'POST',
        body: JSON.stringify({ billing: plan.tier, period, utm: '', dub: '', datafast_session_id: '', datafast_visitor_id: '' }),
      });
      const body = await response.json();
      if (body.blocked) {
        toaster.show('Another account with this email already has a subscription.', 'warning');
        return;
      }
      if (!response.ok) {
        toaster.show(
          typeof body.message === 'string' ? body.message : 'Could not start checkout.',
          'warning'
        );
        return;
      }
      if (body.url) {
        leave = true;
        window.location.href = body.url;
        return;
      }
      if (body.changed) {
        setShowPlans(false);
        await mutate();
        toaster.show(
          body.trial
            ? 'Plan updated. The trial end date is unchanged, and the new plan is charged then.'
            : body.upgrade
              ? 'Plan upgraded.'
              : 'Downgrade scheduled for the next renewal. The current plan stays until then.',
          'success'
        );
      }
    } catch {
      toaster.show('Could not start checkout.', 'warning');
    } finally {
      if (!leave) {
        setBusy(false);
      }
    }
  };

  const buyPack = async (pack: 'PACK_150' | 'PACK_500') => {
    setPackBusy(pack);
    setPackError('');
    let leave = false;
    try {
      const response = await fetch('/billing/packs', {
        method: 'POST',
        body: JSON.stringify({ pack }),
      });
      const body = await response.json();
      if (!response.ok || !body.url) {
        const message = body.message || 'Could not open pack checkout.';
        setPackError(message);
        toaster.show(message, 'warning');
        return;
      }
      leave = true;
      window.location.href = body.url;
    } catch {
      setPackError('Could not open pack checkout.');
      toaster.show('Could not open pack checkout.', 'warning');
    } finally {
      if (!leave) {
        setPackBusy(null);
      }
    }
  };

  const chooseTier = (tier: PaidTier, plans: BillingPlanCard[]) => {
    const plan = plans.find((item) => item.tier === tier);
    if (plan) {
      void choose(plan);
    }
  };

  if (mode === 'paywall' && !error && (isLoading || !data)) {
    return (
      <BillingShell>
        <SignInPaywall
          period={period}
          busy={busy}
          allowTrial={!!user?.allowTrial}
          trialDays={TRIAL_DAYS}
          onPeriod={setPeriod}
          onChoose={(tier) => chooseTier(tier, planCards())}
        />
      </BillingShell>
    );
  }
  if (isLoading) {
    return (
      <BillingShell>
        <AccountBillingPlaceholder />
      </BillingShell>
    );
  }
  if (error || !data) {
    return (
      <BillingShell>
        <p data-billing-state="error">Billing could not be loaded.</p>
        <button type="button" onClick={() => mutate()}>Try again</button>
      </BillingShell>
    );
  }
  if (!data.billingEnabled) {
    return (
      <BillingShell>
        <p data-billing-state="billing_off">Billing is not turned on for this workspace.</p>
      </BillingShell>
    );
  }

  const status = data.subscription.status;
  // cancel_scheduled still has access through cancelAt, so the buy label stays.
  const packsClosed =
    status === 'none' ||
    status === 'trialing' ||
    status === 'trial_ended' ||
    status === 'past_due' ||
    status === 'on_hold' ||
    status === 'cancelled';
  const checkoutFailed = returned === 'failure';
  const screen = (() => {
    if (!checkoutFailed && returned === 'pending' && !activeEnough.has(status)) {
      return 'checkout_pending';
    }
    if (!checkoutFailed && returned === 'pending' && activeEnough.has(status)) {
      return 'checkout_success';
    }
    if (mode === 'paywall' && data.subscription.tier === 'FREE') return 'paywall';
    if (status === 'trial_ended') return 'trial_ended';
    if (status === 'cancelled') return 'cancelled';
    if (showPlans || data.screen === 'plan_picker') return 'plan_picker';
    if (status === 'trialing') return 'trial_active';
    if (status === 'past_due' || status === 'on_hold') return 'past_due';
    if (data.subscription.pendingDisplayName) return 'downgrade_pending';
    return 'billing_settings';
  })();
  const shown = creditsOpen && screen !== 'paywall' && !screen.startsWith('checkout_') ? 'credits' : screen;

  const picker = !data.grandfathered ? (
    <PlanPicker
      plans={data.plans}
      period={period}
      trialDays={data.trialDays}
      allowTrial={data.allowTrial && status !== 'trial_ended'}
      busy={busy}
      currentTier={data.subscription.tier}
      currentPeriod={data.subscription.period}
      onPeriod={setPeriod}
      onSelect={choose}
    />
  ) : null;

  const accountPicker = !data.grandfathered ? (
    <PricingSection
      period={period}
      busy={busy}
      allowTrial={data.allowTrial && status !== 'trial_ended'}
      trialDays={data.trialDays}
      currentTier={data.subscription.tier}
      currentPeriod={data.subscription.period}
      onPeriod={setPeriod}
      onChoose={(tier) => {
        const plan = data.plans.find((item) => item.tier === tier);
        if (plan) {
          void choose(plan);
        }
      }}
    />
  ) : null;

  const openPortal = async () => {
    setBusy(true);
    let leave = false;
    try {
      const response = await fetch('/billing/portal');
      const body = await response.json();
      if (body.portal) {
        leave = true;
        window.location.href = body.portal;
      }
    } finally {
      if (!leave) {
        setBusy(false);
      }
    }
  };
  const accessUntil = data.subscription.cancelAt || data.subscription.currentPeriodEnd;
  const cancelUntil = accessUntil ? accessUntil.slice(0, 10) : 'the end of this period';
  const resume = async () => {
    setBusy(true);
    try {
      await fetch('/billing/resume', { method: 'POST' });
      await mutate();
      toaster.show('Subscription kept.', 'success');
    } catch {
      toaster.show('Could not update the subscription.', 'warning');
    } finally {
      setBusy(false);
    }
  };
  const askCancel = async () => {
    const confirmed = await deleteDialog(
      `Access continues until ${cancelUntil}.`,
      'Cancel subscription',
      'Cancel subscription',
      'Keep subscription',
      'danger'
    );
    if (!confirmed) {
      return;
    }
    setBusy(true);
    try {
      await fetch('/billing/cancel', { method: 'POST', body: JSON.stringify({ feedback: '' }) });
      await mutate();
      toaster.show(`Access continues until ${cancelUntil}.`, 'success');
    } catch {
      toaster.show('Could not cancel the subscription.', 'warning');
    } finally {
      setBusy(false);
    }
  };
  const settings = (
    <BillingSettings
      overview={data}
      busy={busy}
      onChangePlan={() => setShowPlans(true)}
      onPortal={openPortal}
      onResume={resume}
      onCancel={askCancel}
    />
  );

  const credits = (
    <div data-billing-screen="credits" className="flex flex-col gap-[12px]">
      <button type="button" onClick={() => setCreditsOpen(false)}>Back to plan</button>
      <CreditsMeter overview={data} />
      {!data.grandfathered ? (
        <CreditPacks packs={data.packs} busy={packBusy} error={packError} onBuy={buyPack} locked={packsClosed} />
      ) : null}
      <InvoiceList invoices={data.invoices} />
    </div>
  );

  const accountView = surface === 'account';
  const accountHasPlan = activeEnough.has(status);

  return (
    <BillingShell>
      <div
        data-billing-screen={shown}
        className={accountView ? 'account-bill flex flex-col gap-[16px]' : 'flex flex-col gap-[12px]'}
      >
        {checkoutFailed ? (
          <CheckoutStatus state="failure" onRetry={() => router.replace('/account?section=billing')} />
        ) : null}
        {shown === 'checkout_pending' ? (
          <CheckoutStatus state="pending" compact={surface === 'account'} />
        ) : null}
        {shown === 'checkout_success' ? (
          <CheckoutStatus
            state="success"
            compact={surface === 'account'}
            onRetry={
              surface === 'account'
                ? undefined
                : () => router.replace('/account?section=billing')
            }
          />
        ) : null}
        {accountView ? (
          <>
            {data.subscription.status === 'cancel_scheduled' ? (
              <CancelStrip until={cancelUntil} busy={busy} onResume={resume} />
            ) : (
              <StatusBanners overview={data} />
            )}
            <div className="account-bill-grid">
              <AccountPlanCard
                overview={data}
                busy={busy}
                onChangePlan={() => setShowPlans(true)}
                onPortal={openPortal}
                onCancel={askCancel}
              />
              <AccountCreditsCard overview={data} />
            </div>
            {!data.grandfathered ? (
              <CreditPacks compact packs={data.packs} busy={packBusy} error={packError} onBuy={buyPack} locked={packsClosed} />
            ) : null}
            <InvoiceList rows invoices={data.invoices} />
            {!accountHasPlan || showPlans ? (
              <div ref={plansRef} className="billing-plans flex w-full flex-col gap-[28px]">
                {accountPicker}
                <div className="account-bill-faq">
                  <FAQComponent accordion />
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <>
            {shown === 'paywall' ? (
              <SignInPaywall
                period={period}
                busy={busy}
                allowTrial={data.allowTrial && status !== 'trial_ended'}
                trialDays={data.trialDays}
                currentTier={data.subscription.tier}
                currentPeriod={data.subscription.period}
                onPeriod={setPeriod}
                onChoose={(tier) => chooseTier(tier, data.plans)}
              />
            ) : null}
            {shown === 'trial_ended' || shown === 'cancelled' ? (
              <>
                <StatusBanners overview={data} />
                {picker}
              </>
            ) : null}
            {shown === 'plan_picker' ? <div ref={plansRef} className="billing-plans w-full">{picker}</div> : null}
            {shown === 'trial_active' || shown === 'past_due' || shown === 'downgrade_pending' || shown === 'billing_settings' ? (
              <>
                <StatusBanners overview={data} />
                {settings}
                <button type="button" onClick={() => setCreditsOpen(true)}>Credits and invoices</button>
              </>
            ) : null}
            {shown === 'credits' ? credits : null}
          </>
        )}
      </div>
    </BillingShell>
  );
}
