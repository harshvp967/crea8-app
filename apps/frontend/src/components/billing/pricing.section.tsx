'use client';

import clsx from 'clsx';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { SegmentedControl } from '@gitroom/frontend/components/ui/segmented-control';
import { stkBadgeAcc, stkCard, stkPrimary } from '@gitroom/frontend/components/stalker/stalker.chrome';
import {
  CHECKOUT_GST_NOTE,
  PAID_TIERS,
  PLANS,
  planFeatureLines,
  type BillingPeriod,
  type PaidTier,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';

export function PricingSection({
  period,
  busy,
  allowTrial,
  trialDays,
  onPeriod,
  onChoose,
}: {
  period: BillingPeriod;
  busy: boolean;
  allowTrial: boolean;
  trialDays: number;
  onPeriod: (period: BillingPeriod) => void;
  onChoose: (tier: PaidTier) => void;
}) {
  return (
    <div data-billing-state="plan_picker" className="billing-plans flex w-full flex-col items-center gap-[20px]">
      <SegmentedControl
        className="settings-seg"
        variant="pill"
        aria-label="Monthly or yearly"
        value={period}
        onValueChange={(value) => {
          if (value === 'MONTHLY' || value === 'YEARLY') {
            onPeriod(value);
          }
        }}
        options={[
          { value: 'MONTHLY', label: 'Monthly' },
          { value: 'YEARLY', label: 'Yearly' },
        ]}
      />
      <div className="grid w-full grid-cols-1 items-stretch gap-[12px] c8-tablet:grid-cols-2 c8-desktop:grid-cols-4">
        {PAID_TIERS.map((tier) => {
          const plan = PLANS[tier];
          const price = period === 'YEARLY' ? plan.yearPriceUsd : plan.monthPriceUsd;
          const recommended = tier === 'PRO';
          return (
            <article key={tier} data-plan={tier} className={clsx(stkCard, 'flex h-full flex-col gap-[14px]')}>
              <div className="flex min-h-[26px] flex-wrap items-center justify-between gap-[8px]">
                <h2 className="whitespace-normal">{plan.displayName}</h2>
                <span className={clsx(stkBadgeAcc, 'billing-recommend', !recommended && 'invisible')} aria-hidden={!recommended}>
                  Recommended
                </span>
              </div>
              <p className="m-0">
                <span className="lib-metric-value">${price}</span>
                <span className="lib-metric-label">{period === 'YEARLY' ? ' / year' : ' / month'}</span>
              </p>
              <p className="m-0 lib-metric-label">{CHECKOUT_GST_NOTE}</p>
              <button
                type="button"
                className={clsx(stkPrimary, 'w-full')}
                disabled={busy}
                onClick={() => onChoose(tier)}
              >
                {busy ? 'Loading…' : allowTrial ? `Start ${trialDays}-day trial` : `Choose ${plan.displayName}`}
              </button>
              <ul className="m-0 flex list-none flex-col gap-[8px] p-0">
                {planFeatureLines(plan).map((line) => (
                  <li key={line} className="flex items-start gap-[8px] text-[14px]">
                    <HugeIcon name="check" size={16} className="shrink-0" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </div>
  );
}
