'use client';

import clsx from 'clsx';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { SegmentedControl } from '@gitroom/frontend/components/ui/segmented-control';
import { stkBadgeAcc, stkCard, stkPrimary } from '@gitroom/frontend/components/stalker/stalker.chrome';
import {
  CHECKOUT_GST_NOTE,
  PAID_TIERS,
  PLANS,
  type BillingPeriod,
  type PaidTier,
  type PlanConfig,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';

const count = (value: number) => value.toLocaleString('en-US');

/**
 * Feature lines for one paid plan. Numbers come from billing.config.
 * Workspaces have no numeric field: POST /user/workspace creates a workspace
 * for any signed-in user with no plan cap, so the line is unlimited.
 * postsPerMonth above 10,000 is the existing "unlimited" display rule.
 * AI images follow imageGenerator, which is off on Creator.
 */
export function planFeatureLines(plan: PlanConfig): string[] {
  const lines = [
    `${count(plan.channels)} channels`,
    plan.teamMemberLimit == null
      ? 'Unlimited team members'
      : `${count(plan.teamMemberLimit)} team ${plan.teamMemberLimit === 1 ? 'member' : 'members'}`,
    'Unlimited workspaces',
    `${count(plan.monthlyCredits)} credits a month`,
    `${count(plan.stalkerKeywords)} Stalker keywords`,
    `Stalker scan every ${plan.stalkerScanHours} ${plan.stalkerScanHours === 1 ? 'hour' : 'hours'}`,
    plan.stalkerManualChecksPerDay == null
      ? 'Unlimited Stalker checks a day'
      : `${count(plan.stalkerManualChecksPerDay)} Stalker ${plan.stalkerManualChecksPerDay === 1 ? 'check' : 'checks'} a day`,
    `${count(plan.mentionRetentionDays)} days of mentions`,
    `${count(plan.webhooks)} webhooks`,
    plan.postsPerMonth > 10000
      ? 'Unlimited posts a month'
      : `${count(plan.postsPerMonth)} posts a month`,
  ];
  if (plan.ai) {
    lines.push('AI post');
  }
  if (plan.imageGenerator && plan.imageGenerationCount > 0) {
    lines.push(`${count(plan.imageGenerationCount)} AI images`);
  }
  if (plan.generateVideos > 0) {
    lines.push(`${count(plan.generateVideos)} AI videos`);
  }
  lines.push('Posting sets', 'Analytics', 'Link in Bio, all themes');
  if (plan.key !== 'FREE') {
    lines.push('Badge removed');
  }
  return lines;
}

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
