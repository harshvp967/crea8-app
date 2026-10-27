'use client';

import { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { BillingOverview, BillingPlanCard } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.view';
import { BillingShell } from '@gitroom/frontend/components/billing/billing.shell';
import {
  BillingSettings,
  CheckoutStatus,
  CreditPacks,
  CreditsMeter,
  InvoiceList,
  Paywall,
  PlanPicker,
  StatusBanners,
  UpgradeModal,
} from '@gitroom/frontend/components/billing/billing.ui';
import { FAQComponent } from '@gitroom/frontend/components/billing/faq.component';
import { PricingSection } from '@gitroom/frontend/components/billing/pricing.section';

const activeEnough = new Set(['active', 'trialing', 'past_due', 'on_hold', 'cancel_scheduled']);

export function BillingScreen({ mode }: { mode: 'settings' | 'paywall' }) {
  const fetch = useFetch();
  const router = useRouter();
  const params = useSearchParams();
  const checkout = params.get('checkout');
  const load = useCallback(async (path: string) => {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error('Could not load billing');
    }
    return response.json();
  }, []);
  const { data, error, isLoading, mutate } = useSWR<BillingOverview>('/billing/overview', load, {
    refreshInterval: checkout === 'pending' || checkout === 'success' ? 2000 : 0,
  });
  const [period, setPeriod] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [busy, setBusy] = useState(false);
  const [packBusy, setPackBusy] = useState<string | null>(null);
  const [packError, setPackError] = useState('');
  const [note, setNote] = useState('');
  const [showPlans, setShowPlans] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [upgrade, setUpgrade] = useState<{ plan: BillingPlanCard; detail: string } | null>(null);

  useEffect(() => {
    if (data?.subscription.period) {
      setPeriod(data.subscription.period);
    }
  }, [data?.subscription.period]);

  const choose = async (plan: BillingPlanCard) => {
    const hasPlan = data && activeEnough.has(data.subscription.status) && !data.grandfathered;
    if (hasPlan) {
      setBusy(true);
      try {
        const preview = await fetch('/billing/prorate', {
          method: 'POST',
          body: JSON.stringify({ billing: plan.tier, period }),
        });
        const body = await preview.json();
        setUpgrade({
          plan,
          detail: body?.price
            ? `${plan.displayName} ${period.toLowerCase()} is about $${body.price} ${body.currency || 'USD'} today. Downgrades wait until the next renewal.`
            : `Switch to ${plan.displayName} (${period.toLowerCase()}).`,
        });
      } catch {
        setUpgrade({ plan, detail: `Switch to ${plan.displayName}.` });
      } finally {
        setBusy(false);
      }
      return;
    }
    await subscribe(plan);
  };

  const subscribe = async (plan: BillingPlanCard) => {
    setBusy(true);
    setNote('');
    try {
      const response = await fetch('/billing/subscribe', {
        method: 'POST',
        body: JSON.stringify({ billing: plan.tier, period, utm: '', dub: '', datafast_session_id: '', datafast_visitor_id: '' }),
      });
      const body = await response.json();
      if (body.blocked) {
        setNote('Another account with this email already has a subscription.');
        return;
      }
      if (body.url) {
        window.location.href = body.url;
        return;
      }
      if (body.changed) {
        setUpgrade(null);
        setShowPlans(false);
        await mutate();
        setNote(body.upgrade ? 'Plan upgraded.' : 'Downgrade scheduled for the next renewal.');
      }
    } catch {
      setNote('Could not start checkout.');
    } finally {
      setBusy(false);
    }
  };

  const buyPack = async (pack: 'PACK_150' | 'PACK_500') => {
    setPackBusy(pack);
    setPackError('');
    try {
      const response = await fetch('/billing/packs', {
        method: 'POST',
        body: JSON.stringify({ pack }),
      });
      const body = await response.json();
      if (!response.ok || !body.url) {
        setPackError(body.message || 'Could not open pack checkout.');
        return;
      }
      window.location.href = body.url;
    } catch {
      setPackError('Could not open pack checkout.');
    } finally {
      setPackBusy(null);
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
  const screen = (() => {
    if (checkout === 'failure') return 'checkout_failure';
    if ((checkout === 'pending' || checkout === 'success') && !activeEnough.has(status)) {
      return 'checkout_pending';
    }
    if ((checkout === 'pending' || checkout === 'success') && activeEnough.has(status)) {
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

  const settings = (
    <BillingSettings
      overview={data}
      busy={busy}
      onChangePlan={() => setShowPlans(true)}
      onPortal={async () => {
        setBusy(true);
        try {
          const response = await fetch('/billing/portal');
          const body = await response.json();
          if (body.portal) window.location.href = body.portal;
        } finally {
          setBusy(false);
        }
      }}
      onResume={async () => {
        setBusy(true);
        try {
          await fetch('/billing/resume', { method: 'POST' });
          await mutate();
        } finally {
          setBusy(false);
        }
      }}
      onCancel={async (feedback) => {
        setBusy(true);
        try {
          await fetch('/billing/cancel', { method: 'POST', body: JSON.stringify({ feedback }) });
          await mutate();
        } finally {
          setBusy(false);
        }
      }}
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

  return (
    <BillingShell>
      <div data-billing-screen={shown} className="flex flex-col gap-[12px]">
        {note ? <p className="m-0">{note}</p> : null}
        {shown === 'checkout_failure' ? (
          <CheckoutStatus state="failure" onRetry={() => router.replace('/account?section=billing')} />
        ) : null}
        {shown === 'checkout_pending' ? <CheckoutStatus state="pending" /> : null}
        {shown === 'checkout_success' ? (
          <CheckoutStatus state="success" onRetry={() => router.replace('/account?section=billing')} />
        ) : null}
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
        {shown === 'plan_picker' ? picker : null}
        {shown === 'trial_active' || shown === 'past_due' || shown === 'downgrade_pending' || shown === 'billing_settings' ? (
          <>
            <StatusBanners overview={data} />
            {settings}
            <button type="button" onClick={() => setCreditsOpen(true)}>Credits and invoices</button>
          </>
        ) : null}
        {shown === 'credits' ? credits : null}
        {shown !== 'paywall' && shown !== 'credits' && shown !== 'checkout_pending' ? <FAQComponent /> : null}
      </div>
      <UpgradeModal
        open={!!upgrade}
        title="Confirm plan change"
        detail={upgrade?.detail || ''}
        busy={busy}
        onClose={() => setUpgrade(null)}
        onConfirm={() => upgrade && subscribe(upgrade.plan)}
      />
    </BillingShell>
  );
}
