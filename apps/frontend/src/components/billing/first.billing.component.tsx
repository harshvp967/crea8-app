'use client';

import { Suspense } from 'react';
import { BillingScreen } from '@gitroom/frontend/components/billing/billing.screen';
import { AccountBillingSkeleton } from '@gitroom/frontend/components/ui/skeleton';

export const FirstBillingComponent = () => {
  return (
    <Suspense
      fallback={<AccountBillingSkeleton />}
    >
      <BillingScreen mode="paywall" />
    </Suspense>
  );
};
