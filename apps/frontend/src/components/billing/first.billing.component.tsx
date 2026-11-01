'use client';

import { Suspense } from 'react';
import { BillingScreen } from '@gitroom/frontend/components/billing/billing.screen';

export const FirstBillingComponent = () => {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-[240px] w-full flex-1 animate-pulse rounded-[26px] border border-newBorder bg-newBgColorInner"
          role="status"
          aria-live="polite"
        >
          <span className="sr-only">Loading</span>
        </div>
      }
    >
      <BillingScreen mode="paywall" />
    </Suspense>
  );
};
