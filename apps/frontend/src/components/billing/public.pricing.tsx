'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Crea8oneWordmark } from '@gitroom/frontend/components/ui/logo-text.component';
import { FAQComponent } from '@gitroom/frontend/components/billing/faq.component';
import { PricingSection } from '@gitroom/frontend/components/billing/pricing.section';
import { TRIAL_DAYS, type BillingPeriod } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';

export function PublicPricing() {
  const router = useRouter();
  const [period, setPeriod] = useState<BillingPeriod>('MONTHLY');
  return (
    <section className="link-screen billing-paywall billing-plans flex min-h-screen w-full flex-col items-center gap-[28px] bg-[var(--c8-bg)] px-[16px] pb-[48px] pt-[36px] text-[color:var(--c8-ink)] c8-tablet:px-[32px] c8-desktop:px-[40px]">
      <Crea8oneWordmark className="h-[36px] w-auto max-w-[180px] object-contain object-left" />
      <h1 className="stk-title m-0 w-full text-center">Pricing</h1>
      <PricingSection
        period={period}
        busy={false}
        allowTrial
        trialDays={TRIAL_DAYS}
        onPeriod={setPeriod}
        onChoose={() => router.push('/register')}
      />
      <FAQComponent accordion trial />
    </section>
  );
}
