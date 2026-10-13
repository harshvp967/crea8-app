'use client';

import { ReactNode } from 'react';
import { BillingButton, BillingHeading } from '@gitroom/frontend/components/billing/billing.shell';
import { BillingOverview, BillingPlanCard } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.view';

export function BillingBanner({
  state,
  title,
  children,
}: {
  state: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <section data-billing-state={state} className="rounded-[8px] border border-newBorder p-[14px]">
      <BillingHeading as="h3">{title}</BillingHeading>
      {children ? <div className="mt-[6px] text-textItemBlur">{children}</div> : null}
    </section>
  );
}

export function PlanPicker({
  plans,
  period,
  trialDays,
  allowTrial,
  busy,
  onPeriod,
  onSelect,
}: {
  plans: BillingPlanCard[];
  period: 'MONTHLY' | 'YEARLY';
  trialDays: number;
  allowTrial: boolean;
  busy: boolean;
  onPeriod: (period: 'MONTHLY' | 'YEARLY') => void;
  onSelect: (plan: BillingPlanCard) => void;
}) {
  return (
    <section data-billing-state="plan_picker" className="flex flex-col gap-[12px]">
      <BillingHeading as="h1">Choose a plan</BillingHeading>
      <p className="m-0 text-textItemBlur">
        Prices are in USD. Tax is added at checkout. {allowTrial ? `New subscriptions include a ${trialDays}-day free trial.` : 'This account is not eligible for another trial.'}
      </p>
      <div className="flex gap-[8px]">
        <BillingButton kind={period === 'MONTHLY' ? 'primary' : 'secondary'} onClick={() => onPeriod('MONTHLY')}>
          Monthly
        </BillingButton>
        <BillingButton kind={period === 'YEARLY' ? 'primary' : 'secondary'} onClick={() => onPeriod('YEARLY')}>
          Yearly
        </BillingButton>
      </div>
      <div className="grid gap-[12px] md:grid-cols-2">
        {plans.map((plan) => (
          <article key={plan.tier} className="rounded-[8px] border border-newBorder p-[14px] flex flex-col gap-[8px]">
            <BillingHeading as="h2">{plan.displayName}</BillingHeading>
            <p className="m-0 text-[20px]">
              ${period === 'YEARLY' ? plan.yearPriceUsd : plan.monthPriceUsd}
              <span className="text-[14px] text-textItemBlur">{period === 'YEARLY' ? ' / year' : ' / month'}</span>
            </p>
            <ul className="m-0 pl-[18px] text-textItemBlur">
              <li>{plan.channels} channels</li>
              <li>{plan.teamMemberLimit == null ? 'Unlimited team members' : `${plan.teamMemberLimit} team member`}</li>
              <li>{plan.monthlyCredits} credits each cycle</li>
              <li>{plan.stalkerKeywords} Stalker keywords</li>
            </ul>
            <BillingButton kind="primary" disabled={busy} onClick={() => onSelect(plan)}>
              {allowTrial ? `Start ${trialDays}-day trial` : `Choose ${plan.displayName}`}
            </BillingButton>
          </article>
        ))}
      </div>
    </section>
  );
}

export function CheckoutStatus({
  state,
  onRetry,
}: {
  state: 'success' | 'failure' | 'pending';
  onRetry?: () => void;
}) {
  if (state === 'success') {
    return (
      <BillingBanner state="checkout_success" title="Checkout complete">
        <p className="m-0">Your plan is active. You can manage it from billing settings.</p>
        {onRetry ? <div className="mt-[8px]"><BillingButton kind="primary" onClick={onRetry}>Continue</BillingButton></div> : null}
      </BillingBanner>
    );
  }
  if (state === 'failure') {
    return (
      <BillingBanner state="checkout_failure" title="Checkout was not completed">
        <p className="m-0">No charge was made. You can pick a plan and try again.</p>
        {onRetry ? <div className="mt-[8px]"><BillingButton onClick={onRetry}>Back to plans</BillingButton></div> : null}
      </BillingBanner>
    );
  }
  return (
    <BillingBanner state="checkout_pending" title="Waiting for checkout">
      We are confirming the payment. This page updates on its own.
    </BillingBanner>
  );
}

export function StatusBanners({ overview }: { overview: BillingOverview }) {
  const sub = overview.subscription;
  return (
    <>
      {sub.status === 'trialing' ? (
        <BillingBanner state="trial_active" title="Trial is active">
          {overview.trialDays}-day trial on {sub.displayName}
          {sub.currentPeriodEnd ? `. Renews ${sub.currentPeriodEnd.slice(0, 10)}` : ''}.
        </BillingBanner>
      ) : null}
      {sub.status === 'trial_ended' ? (
        <BillingBanner state="trial_ended" title="Trial ended">
          Choose a plan to keep posting. A second trial is not available.
        </BillingBanner>
      ) : null}
      {sub.status === 'past_due' ? (
        <BillingBanner state="past_due" title="Payment past due">
          Update the payment method to keep this subscription.
        </BillingBanner>
      ) : null}
      {sub.status === 'on_hold' ? (
        <BillingBanner state="past_due" title="Subscription on hold">
          The last payment did not go through. Open the billing portal to fix it.
        </BillingBanner>
      ) : null}
      {sub.status === 'cancelled' ? (
        <BillingBanner state="cancelled" title="Subscription cancelled">
          Paid features are off until you subscribe again.
        </BillingBanner>
      ) : null}
      {sub.status === 'cancel_scheduled' ? (
        <BillingBanner state="cancelled" title="Cancellation scheduled">
          Access continues until {sub.cancelAt ? sub.cancelAt.slice(0, 10) : 'the end of this period'}.
        </BillingBanner>
      ) : null}
      {sub.pendingDisplayName ? (
        <BillingBanner state="downgrade_pending" title="Downgrade pending">
          {sub.displayName} stays in place until the next renewal, then the plan changes to {sub.pendingDisplayName}
          {sub.pendingPeriod ? ` (${sub.pendingPeriod.toLowerCase()})` : ''}. Channels and members already connected stay as they are.
        </BillingBanner>
      ) : null}
      {overview.grandfathered ? (
        <BillingBanner state="grandfathered" title="Agency is included">
          This workspace stays on Agency. There is nothing to pay.
        </BillingBanner>
      ) : null}
    </>
  );
}

export function CreditsMeter({ overview }: { overview: BillingOverview }) {
  const { monthlyRemaining, monthlyAllowance, packRemaining, total } = overview.credits;
  const width = monthlyAllowance > 0 ? Math.min(100, Math.round((monthlyRemaining / monthlyAllowance) * 100)) : 0;
  return (
    <section data-billing-state="credits_meter" className="rounded-[8px] border border-newBorder p-[14px] flex flex-col gap-[8px]">
      <BillingHeading as="h2">Credits</BillingHeading>
      <p className="m-0">
        {total} available ({monthlyRemaining} monthly, {packRemaining} pack)
      </p>
      <div className="h-[8px] rounded-[8px] bg-newBorder overflow-hidden">
        <div className="h-full" style={{ width: `${width}%`, background: '#00D9FF' }} />
      </div>
      {total <= 0 ? (
        <p className="m-0" data-billing-state="credits_empty">
          You are out of credits. Buy a pack or wait for the next cycle. Actions that spend credits are blocked until then.
        </p>
      ) : (
        <p className="m-0 text-textItemBlur">Monthly credits reset each cycle and do not roll over. Pack credits are spent after monthly credits.</p>
      )}
      {overview.history.length ? (
        <ul className="m-0 pl-[18px]">
          {overview.history.slice(0, 8).map((entry) => (
            <li key={entry.id}>
              {entry.amount > 0 ? '+' : ''}
              {entry.amount} {entry.bucket.toLowerCase()} · {entry.reason}
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-textItemBlur">No credit history yet.</p>
      )}
    </section>
  );
}

export function CreditPacks({
  packs,
  busy,
  error,
  onBuy,
}: {
  packs: BillingOverview['packs'];
  busy: string | null;
  error: string;
  onBuy: (key: BillingOverview['packs'][number]['key']) => void;
}) {
  return (
    <section data-billing-state="credit_packs" className="rounded-[8px] border border-newBorder p-[14px] flex flex-col gap-[8px]">
      <BillingHeading as="h2">Credit packs</BillingHeading>
      <p className="m-0 text-textItemBlur">One-time purchases. They roll over and are used after monthly credits.</p>
      {error ? <p data-billing-state="credit_pack_error" className="m-0">{error}</p> : null}
      <div className="flex flex-wrap gap-[8px]">
        {packs.map((pack) => (
          <BillingButton key={pack.key} kind="primary" disabled={busy === pack.key} onClick={() => onBuy(pack.key)}>
            {busy === pack.key ? 'Opening checkout…' : `${pack.credits} credits · $${pack.usd}`}
          </BillingButton>
        ))}
      </div>
    </section>
  );
}

export function InvoiceList({ invoices }: { invoices: BillingOverview['invoices'] }) {
  return (
    <section data-billing-state="invoices" className="rounded-[8px] border border-newBorder p-[14px] flex flex-col gap-[8px]">
      <BillingHeading as="h2">Invoices</BillingHeading>
      {invoices.length === 0 ? (
        <p data-billing-state="invoices_empty" className="m-0 text-textItemBlur">No invoices yet.</p>
      ) : (
        <ul className="m-0 pl-[18px]">
          {invoices.map((invoice) => (
            <li key={invoice.id}>
              {invoice.createdAt.slice(0, 10)} · {invoice.currency} {invoice.amount} · {invoice.status}
              {invoice.url ? (
                <>
                  {' '}
                  <a href={invoice.url} target="_blank" rel="noreferrer">View</a>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function BillingSettings({
  overview,
  busy,
  onPortal,
  onCancel,
  onResume,
  onChangePlan,
}: {
  overview: BillingOverview;
  busy: boolean;
  onPortal: () => void;
  onCancel: (feedback: string) => void;
  onResume: () => void;
  onChangePlan: () => void;
}) {
  const sub = overview.subscription;
  return (
    <section data-billing-state="billing_settings" className="rounded-[8px] border border-newBorder p-[14px] flex flex-col gap-[8px]">
      <BillingHeading as="h1">Billing</BillingHeading>
      <p className="m-0">
        Current plan: {sub.displayName}
        {sub.period ? ` · ${sub.period.toLowerCase()}` : ''} · {sub.status.replace('_', ' ')}
      </p>
      <p className="m-0 text-textItemBlur">Questions: {overview.supportEmail}</p>
      <div className="flex flex-wrap gap-[8px]">
        {!overview.grandfathered && sub.identifier ? (
          <BillingButton kind="primary" disabled={busy} onClick={onPortal}>Manage payment method</BillingButton>
        ) : null}
        {!overview.grandfathered && sub.status !== 'none' && sub.status !== 'cancelled' && sub.status !== 'trial_ended' ? (
          <BillingButton disabled={busy} onClick={onChangePlan}>Change plan</BillingButton>
        ) : null}
        {sub.status === 'cancel_scheduled' ? (
          <BillingButton kind="primary" disabled={busy} onClick={onResume}>Keep subscription</BillingButton>
        ) : null}
      </div>
      {!overview.grandfathered && sub.status !== 'cancelled' && sub.status !== 'cancel_scheduled' && sub.status !== 'none' && sub.status !== 'trial_ended' ? (
        <form
          className="flex flex-col gap-[8px]"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            onCancel(String(data.get('feedback') || ''));
          }}
        >
          <label className="flex flex-col gap-[4px]">
            Cancel at period end
            <textarea name="feedback" className="rounded-[8px] border border-newBorder bg-transparent p-[8px]" rows={3} placeholder="What should we know?" />
          </label>
          <BillingButton kind="danger" type="submit" disabled={busy}>Cancel subscription</BillingButton>
        </form>
      ) : null}
    </section>
  );
}

export function UpgradeModal({
  open,
  title,
  detail,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  detail: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) {
    return null;
  }
  return (
    <div data-billing-state="upgrade_modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-[16px]">
      <div className="w-full max-w-[420px] rounded-[8px] border border-newBorder bg-newBgColorInner p-[16px] flex flex-col gap-[10px]">
        <BillingHeading as="h2">{title}</BillingHeading>
        <p className="m-0">{detail}</p>
        <div className="flex gap-[8px]">
          <BillingButton kind="primary" disabled={busy} onClick={onConfirm}>Continue</BillingButton>
          <BillingButton disabled={busy} onClick={onClose}>Close</BillingButton>
        </div>
      </div>
    </div>
  );
}

export function Paywall({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <section data-billing-state="paywall" className="flex flex-col gap-[16px] max-w-[960px]">
      <BillingHeading as="h1">Subscribe to keep using crea8.one</BillingHeading>
      <p className="m-0 text-textItemBlur">There is no free plan. Pick Creator, Team, Pro, or Agency. You can log out from the account menu if you need to leave.</p>
      {children}
    </section>
  );
}

export function LockedFeature({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div data-billing-state="locked_feature" className="rounded-[8px] border border-newBorder p-[10px]">
      <strong>{title}</strong>
      <p className="m-0 text-textItemBlur">{detail}</p>
      <a href="/billing">View plans</a>
    </div>
  );
}
