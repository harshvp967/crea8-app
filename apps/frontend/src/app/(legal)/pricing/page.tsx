import { Metadata } from 'next';
import { LegalH2, LegalShell } from '@gitroom/frontend/components/legal/legal-shell';
import {
  PAID_TIERS,
  PLANS,
  SUPPORT_EMAIL,
  TRIAL_DAYS,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';

export const metadata: Metadata = {
  title: 'Pricing | crea8.one',
  description: 'crea8.one plans in USD. Tax is added at checkout.',
};

export default function PricingPage() {
  return (
    <LegalShell title="Pricing">
      <p>
        Plans are billed in USD. Tax is added at checkout by the merchant of
        record. A {TRIAL_DAYS}-day trial is available once per account. There
        is no free plan. Questions: {SUPPORT_EMAIL}.
      </p>
      {PAID_TIERS.map((tier) => {
        const plan = PLANS[tier];
        return (
          <section key={tier}>
            <LegalH2>
              {plan.displayName} · ${plan.monthPriceUsd}/month · ${plan.yearPriceUsd}/year
            </LegalH2>
            <p>
              {plan.channels} channels,{' '}
              {plan.teamMemberLimit == null
                ? 'unlimited team members'
                : `${plan.teamMemberLimit} team member`}
              , {plan.monthlyCredits} credits each billing cycle,{' '}
              {plan.stalkerKeywords} Stalker keywords, scans every{' '}
              {plan.stalkerScanHours} hours.
            </p>
          </section>
        );
      })}
      <p>
        <a href="/">Create an account</a>
      </p>
    </LegalShell>
  );
}
