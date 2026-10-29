'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { BillingOverview, BillingPlanCard, checkoutReturnKind } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.view';
import { BillingShell } from '@gitroom/frontend/components/billing/billing.shell';
import {
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
} from '@gitroom/frontend/components/billing/billing.ui';
import { FAQComponent } from '@gitroom/frontend/components/billing/faq.component';
import { PricingSection } from '@gitroom/frontend/components/billing/pricing.section';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';

const activeEnough = new Set(['active', 'trialing', 'past_due', 'on_hold', 'cancel_scheduled']);

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
        const detail = body?.trial
          ? `${plan.displayName} applies to the first charge${when ? ` on ${when}` : ''}. Nothing is charged today, and the trial end stays the same.`
          : body?.scheduled
            ? `${plan.displayName} is scheduled for the next renewal. ${data?.subscription.displayName || 'The current plan'} stays until then.`
            : body?.price
              ? `${plan.displayName} ${period.toLowerCase()} is about $${body.price} ${body.currency || 'USD'} today.`
              : `Switch to ${plan.displayName} (${period.toLowerCase()}).`;
        setBusy(false);
        if (await deleteDialog(detail, 'Continue', 'Confirm plan change', 'Close', 'primary')) {
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

  if (isLoading) {
    return <BillingShell><p data-billing-state="loading">Loading billing…</p></BillingShell>;
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
        <CreditPacks packs={data.packs} busy={packBusy} error={packError} onBuy={buyPack} />
      ) : null}
      <InvoiceList invoices={data.invoices} />
    </div>
  );

  const accountView = surface === 'account' && !shown.startsWith('checkout_');
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
        {shown === 'checkout_pending' ? <CheckoutStatus state="pending" /> : null}
        {shown === 'checkout_success' ? (
          <CheckoutStatus state="success" onRetry={() => router.replace('/account?section=billing')} />
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
              <CreditPacks compact packs={data.packs} busy={packBusy} error={packError} onBuy={buyPack} />
            ) : null}
            <InvoiceList rows invoices={data.invoices} />
            {!accountHasPlan || showPlans ? (
              <div ref={plansRef} className="billing-plans w-full">{accountPicker}</div>
            ) : null}
          </>
        ) : (
          <>
            {shown === 'paywall' ? (
              <Paywall>
                <PricingSection
                  period={period}
                  busy={busy}
                  allowTrial={data.allowTrial && status !== 'trial_ended'}
                  trialDays={data.trialDays}
                  onPeriod={setPeriod}
                  onChoose={(tier) => {
                    const plan = data.plans.find((item) => item.tier === tier);
                    if (plan) {
                      void choose(plan);
                    }
                  }}
                />
                <FAQComponent accordion />
              </Paywall>
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
