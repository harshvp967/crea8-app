'use client';

import { Suspense } from 'react';
import { BillingScreen } from '@gitroom/frontend/components/billing/billing.screen';

export const FirstBillingComponent = () => {
  return (
    <Suspense fallback={<p>Loading billing…</p>}>
      <BillingScreen mode="paywall" />
    </Suspense>
  );
};
