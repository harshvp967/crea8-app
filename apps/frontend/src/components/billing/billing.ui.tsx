'use client';

import { ReactNode } from 'react';
import { BillingButton, BillingHeading } from '@gitroom/frontend/components/billing/billing.shell';
import { BillingOverview, BillingPlanCard } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.view';
import { PlanTier } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import type { HugeIconName } from '@gitroom/frontend/components/icons/hugeicons/paths';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useVariables } from '@gitroom/react/helpers/variable.context';

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
  currentTier,
  onPeriod,
  onSelect,
}: {
  plans: BillingPlanCard[];
  period: 'MONTHLY' | 'YEARLY';
  trialDays: number;
  allowTrial: boolean;
  busy: boolean;
  currentTier?: PlanTier | null;
  onPeriod: (period: 'MONTHLY' | 'YEARLY') => void;
  onSelect: (plan: BillingPlanCard) => void;
}) {
  return (
    <section data-billing-state="plan_picker" className="flex flex-col gap-[12px]">
      <BillingHeading as="h1">Choose a plan</BillingHeading>
      <div className="flex gap-[8px]">
        <BillingButton kind={period === 'MONTHLY' ? 'primary' : 'secondary'} onClick={() => onPeriod('MONTHLY')}>
          Monthly
        </BillingButton>
        <BillingButton kind={period === 'YEARLY' ? 'primary' : 'secondary'} onClick={() => onPeriod('YEARLY')}>
          Yearly
        </BillingButton>
      </div>
      <div className="grid gap-[12px] md:grid-cols-2">
        {plans.map((plan) => {
          const isCurrent = currentTier === plan.tier;
          return (
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
              <BillingButton
                kind="primary"
                disabled={busy || isCurrent}
                onClick={() => {
                  if (!isCurrent) onSelect(plan);
                }}
              >
                {isCurrent
                  ? 'Current plan'
                  : busy
                    ? 'Loading…'
                    : allowTrial
                      ? `Start ${trialDays}-day trial`
                      : `Choose ${plan.displayName}`}
              </BillingButton>
            </article>
          );
        })}
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
  const title =
    state === 'success'
      ? 'Checkout complete'
      : state === 'failure'
        ? 'Checkout was not completed'
        : 'Waiting for checkout';
  const copy = state === 'failure' ? 'No charge was made.' : '';
  return (
    <div className={state === 'failure' ? 'flex w-full justify-center' : 'flex min-h-[50vh] w-full items-center justify-center px-[16px] py-[40px]'}>
      <section
        data-billing-state={state === 'success' ? 'checkout_success' : state === 'failure' ? 'checkout_failure' : 'checkout_pending'}
        className="settings-section account-bill-card flex w-full max-w-[440px] flex-col items-center gap-[12px] text-center"
      >
        <h2 className="account-bill-title">{title}</h2>
        {copy ? <p className="m-0">{copy}</p> : null}
        {onRetry ? (
          <button type="button" className="bg-btnPrimary" onClick={onRetry}>
            {state === 'success' ? 'Continue' : 'Try again'}
          </button>
        ) : null}
      </section>
    </div>
  );
}

const accessUntil = (cancelAt: string | null) =>
  cancelAt ? cancelAt.slice(0, 10) : 'the end of this period';

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
          Access continues until {accessUntil(sub.cancelAt)}.
        </BillingBanner>
      ) : null}
      {sub.pendingDisplayName ? (
        <BillingBanner state="downgrade_pending" title="Downgrade pending">
          {sub.displayName} stays in place until the next renewal, then the plan changes to {sub.pendingDisplayName}
          {sub.pendingPeriod ? ` (${sub.pendingPeriod.toLowerCase()})` : ''}.
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
          You are out of credits.
        </p>
      ) : null}
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
  compact = false,
}: {
  packs: BillingOverview['packs'];
  busy: string | null;
  error: string;
  onBuy: (key: BillingOverview['packs'][number]['key']) => void;
  compact?: boolean;
}) {
  const buttons = packs.map((pack) =>
    compact ? (
      <button
        key={pack.key}
        type="button"
        className="account-chip"
        disabled={busy === pack.key}
        onClick={() => onBuy(pack.key)}
      >
        {busy === pack.key ? 'Opening checkout…' : `${pack.credits} credits · $${pack.usd}`}
      </button>
    ) : (
      <BillingButton key={pack.key} kind="primary" disabled={busy === pack.key} onClick={() => onBuy(pack.key)}>
        {busy === pack.key ? 'Opening checkout…' : `${pack.credits} credits · $${pack.usd}`}
      </BillingButton>
    )
  );
  if (compact) {
    return (
      <section data-billing-state="credit_packs" className="settings-section account-bill-card flex flex-col gap-[12px]">
        <h2 className="account-bill-title">Credit packs</h2>
        {error ? <p data-billing-state="credit_pack_error" className="account-bill-empty">{error}</p> : null}
        <div className="account-bill-packs">{buttons}</div>
      </section>
    );
  }
  return (
    <section data-billing-state="credit_packs" className="rounded-[8px] border border-newBorder p-[14px] flex flex-col gap-[8px]">
      <BillingHeading as="h2">Credit packs</BillingHeading>
      {error ? <p data-billing-state="credit_pack_error" className="m-0">{error}</p> : null}
      <div className="flex flex-wrap gap-[8px]">
        {buttons}
      </div>
    </section>
  );
}

export function InvoiceList({
  invoices,
  rows = false,
}: {
  invoices: BillingOverview['invoices'];
  rows?: boolean;
}) {
  if (rows) {
    return (
      <section data-billing-state="invoices" className="settings-section account-bill-card">
        <h2 className="account-bill-title">Invoices</h2>
        {invoices.length === 0 ? (
          <p data-billing-state="invoices_empty" className="account-bill-empty">No invoices yet.</p>
        ) : (
          <ul className="account-bill-lines">
            {sortedInvoices(invoices).map((invoice) => (
              <li key={invoice.id}>
                <span>{invoiceDate(invoice.createdAt)}</span>
                <span>{invoiceDescription(invoice.status)}</span>
                <span className="settings-pill">{invoiceStatus(invoice.status)}</span>
                <strong>{invoiceAmount(invoice.amount, invoice.currency)}</strong>
                {invoice.url ? (
                  <a className="settings-pill" href={invoice.url} target="_blank" rel="noreferrer">
                    PDF
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }
  return (
    <section data-billing-state="invoices" className="rounded-[8px] border border-newBorder p-[14px] flex flex-col gap-[8px]">
      <BillingHeading as="h2">Invoices</BillingHeading>
      {invoices.length === 0 ? (
        <p data-billing-state="invoices_empty" className="m-0 text-textItemBlur">No invoices yet.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-[8px] p-0">
          {sortedInvoices(invoices).map((invoice) => (
            <li key={invoice.id} className="flex flex-wrap items-center gap-[8px]">
              <span>{invoiceDate(invoice.createdAt)}</span>
              <span>{invoiceDescription(invoice.status)}</span>
              <span className="settings-pill">{invoiceStatus(invoice.status)}</span>
              <strong>{invoiceAmount(invoice.amount, invoice.currency)}</strong>
              {invoice.url ? (
                <a className="settings-pill" href={invoice.url} target="_blank" rel="noreferrer">View</a>
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
      <div className="flex flex-wrap gap-[8px]">
        {!overview.grandfathered && sub.identifier ? (
          <BillingButton kind="primary" disabled={busy} onClick={onPortal}>{busy ? 'Loading…' : 'Manage payment method'}</BillingButton>
        ) : null}
        {!overview.grandfathered && sub.status !== 'none' && sub.status !== 'cancelled' && sub.status !== 'trial_ended' ? (
          <BillingButton disabled={busy} onClick={onChangePlan}>{busy ? 'Loading…' : 'Change plan'}</BillingButton>
        ) : null}
        {sub.status === 'cancel_scheduled' ? (
          <BillingButton kind="primary" disabled={busy} onClick={onResume}>
            <KeepSubscriptionLabel busy={busy} />
          </BillingButton>
        ) : null}
      </div>
      {!overview.grandfathered && sub.status !== 'cancelled' && sub.status !== 'cancel_scheduled' && sub.status !== 'none' && sub.status !== 'trial_ended' ? (
        <BillingButton kind="danger" disabled={busy} onClick={() => onCancel('')}>{busy ? 'Loading…' : 'Cancel subscription'}</BillingButton>
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
          <BillingButton kind="primary" disabled={busy} onClick={onConfirm}>{busy ? 'Loading…' : 'Continue'}</BillingButton>
          <BillingButton disabled={busy} onClick={onClose}>Close</BillingButton>
        </div>
      </div>
    </div>
  );
}

const sortedInvoices = (invoices: BillingOverview['invoices']) =>
  [...invoices].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

const invoiceStatus = (status: string) => status.replace(/_/g, ' ');

const invoiceDescription = (status: string) => {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'succeeded' || normalized === 'paid') return 'Paid invoice';
  if (normalized === 'processing') return 'Payment processing';
  return 'Invoice';
};

const invoiceDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const invoiceAmount = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
};

const PLAN_TILES: { icon: HugeIconName; tile: string; label: string; stalker?: boolean }[] = [
  { icon: 'calendar', tile: 'is-schedule', label: 'Schedule' },
  { icon: 'eye', tile: 'is-stalker', label: 'Stalker', stalker: true },
  { icon: 'link', tile: 'is-link', label: 'Link-in-Bio' },
  { icon: 'sparkles', tile: 'is-cyan', label: 'Agent' },
  { icon: 'media', tile: 'is-warn', label: 'Media' },
  { icon: 'users', tile: 'is-team', label: 'Team' },
];

const ACTION_ROWS: Record<string, { label: string; icon: HugeIconName; tile: string }> = {
  ai_post: { label: 'AI post', icon: 'sparkles', tile: 'is-cyan' },
  x_post: { label: 'X post', icon: 'calendar', tile: 'is-schedule' },
  x_post_with_link: { label: 'X post with link', icon: 'link', tile: 'is-link' },
  ai_image: { label: 'AI image', icon: 'ai-image', tile: 'is-cyan' },
  stalker_search: { label: 'Stalker search', icon: 'eye', tile: 'is-stalker' },
};

export function CancelStrip({
  until,
  busy,
  onResume,
}: {
  until: string;
  busy: boolean;
  onResume: () => void;
}) {
  return (
    <section data-billing-state="cancelled" className="settings-section account-bill-card flex flex-wrap items-center justify-between gap-[12px]">
      <p className="account-bill-title m-0 text-[16px]">Access continues until {until}</p>
      <button type="button" className="bg-btnPrimary" disabled={busy} onClick={onResume}>
        <KeepSubscriptionLabel busy={busy} />
      </button>
    </section>
  );
}

export function AccountPlanCard({
  overview,
  busy,
  onPortal,
  onCancel,
  onChangePlan,
}: {
  overview: BillingOverview;
  busy: boolean;
  onPortal: () => void;
  onCancel: (feedback: string) => void;
  onChangePlan: () => void;
}) {
  const { stalkerEnabled } = useVariables();
  const sub = overview.subscription;
  const plan = overview.plans.find((item) => item.tier === sub.tier);
  const yearly = sub.period === 'YEARLY';
  const price = plan ? (yearly ? plan.yearPriceUsd : plan.monthPriceUsd) : null;
  const periodLabel = sub.period === 'YEARLY' ? 'Yearly' : sub.period === 'MONTHLY' ? 'Monthly' : '';
  const canChange =
    !overview.grandfathered &&
    sub.status !== 'none' &&
    sub.status !== 'cancelled' &&
    sub.status !== 'trial_ended';
  const canPay = !overview.grandfathered && !!sub.identifier;
  const canCancel =
    !overview.grandfathered &&
    sub.status !== 'cancelled' &&
    sub.status !== 'cancel_scheduled' &&
    sub.status !== 'none' &&
    sub.status !== 'trial_ended';

  return (
    <section data-billing-state="billing_settings" className="settings-section account-bill-card">
      <div className="account-bill-head">
        <h2 className="account-bill-title">{sub.displayName}</h2>
        {periodLabel ? <span className="settings-pill">{periodLabel}</span> : null}
      </div>
      {price != null ? (
        <p className="account-bill-price">
          ${price}
          <span>{yearly ? '/yr' : '/mo'}</span>
        </p>
      ) : null}
      <div className="account-bill-tiles" aria-hidden>
        {PLAN_TILES.filter((item) => !item.stalker || stalkerEnabled).map((item) => (
          <span key={item.label} className={`c8-side-tile ${item.tile}`} title={item.label}>
            <HugeIcon name={item.icon} size={16} />
          </span>
        ))}
      </div>
      <div className="account-bill-actions">
        {canChange ? (
          <button type="button" className="bg-btnPrimary" disabled={busy} onClick={onChangePlan}>
            {busy ? 'Loading…' : 'Change plan'}
          </button>
        ) : null}
        {canPay ? (
          <button type="button" className="rounded-full" disabled={busy} onClick={onPortal}>
            {busy ? 'Loading…' : 'Manage payment method'}
          </button>
        ) : null}
      </div>
      {canCancel ? (
        <BillingButton kind="danger" disabled={busy} onClick={() => onCancel('')}>{busy ? 'Loading…' : 'Cancel subscription'}</BillingButton>
      ) : null}
    </section>
  );
}

export function AccountCreditsCard({ overview }: { overview: BillingOverview }) {
  const user = useUser();
  const credits = user?.credits;
  const allowance = credits?.allowance ?? overview.credits.monthlyAllowance;
  const used = credits?.used ?? 0;
  const width = allowance > 0 ? Math.min(100, (used / allowance) * 100) : 0;
  const actions = credits?.actions ?? [];
  return (
    <section data-billing-state="credits_meter" className="settings-section account-bill-card">
      <h2 className="account-bill-title">Credits</h2>
      <p className="account-bill-price">
        {used.toLocaleString('en-US')}
        <span>/ {allowance.toLocaleString('en-US')}</span>
      </p>
      <div className="account-bill-meter" aria-hidden>
        <span style={{ width: `${width}%` }} />
      </div>
      <div className="account-bill-actions-list">
        {actions.map((action) => {
          const row = ACTION_ROWS[action.key] || {
            label: action.key,
            icon: 'sparkles' as HugeIconName,
            tile: 'is-cyan',
          };
          return (
            <div className="account-bill-row" key={action.key}>
              <span className={`c8-side-tile ${row.tile}`} aria-hidden>
                <HugeIcon name={row.icon} size={15} />
              </span>
              <span>{row.label}</span>
              <strong>{action.credits.toLocaleString('en-US')}</strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function KeepSubscriptionLabel({ busy }: { busy: boolean }) {
  return (
    <span className="billing-keep-label">
      <span>{busy ? 'Loading…' : 'Keep subscription'}</span>
      <span className="billing-keep-sizer" aria-hidden="true">
        Keep subscription
      </span>
    </span>
  );
}

export function AccountBillingPlaceholder() {
  return (
    <div
      className="account-bill flex flex-col gap-[16px]"
      data-billing-state="loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading billing…</span>
      <div className="account-bill-grid" aria-hidden="true">
        <section className="settings-section account-bill-card account-bill-hold animate-pulse" />
        <section className="settings-section account-bill-card account-bill-hold animate-pulse" />
      </div>
      <section className="settings-section account-bill-card account-bill-hold is-packs animate-pulse" aria-hidden="true" />
      <section className="settings-section account-bill-card account-bill-hold is-invoices animate-pulse" aria-hidden="true" />
    </div>
  );
}

export function Paywall({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <section data-billing-state="paywall" className="link-screen billing-paywall flex w-full flex-col items-center gap-[28px] px-[16px] pb-[24px] pt-[36px] c8-tablet:px-[32px] c8-desktop:px-[40px]">
      <h1 className="stk-title m-0 w-full text-center">Subscribe to keep using crea8.one</h1>
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
      <a href="/account?section=billing">View plans</a>
    </div>
  );
}
