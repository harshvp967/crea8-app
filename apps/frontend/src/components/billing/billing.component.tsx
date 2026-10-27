'use client';

import { Suspense } from 'react';
import { BillingScreen } from '@gitroom/frontend/components/billing/billing.screen';

export const BillingComponent = ({
  surface = 'page',
}: {
  surface?: 'page' | 'account';
}) => {
  return (
    <Suspense fallback={<p>Loading billing…</p>}>
      <BillingScreen mode="settings" surface={surface} />
    </Suspense>
  );
};
