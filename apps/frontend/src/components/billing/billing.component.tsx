'use client';

import { Suspense } from 'react';
import { BillingScreen } from '@gitroom/frontend/components/billing/billing.screen';
import { BillingShell } from '@gitroom/frontend/components/billing/billing.shell';
import { AccountBillingPlaceholder } from '@gitroom/frontend/components/billing/billing.ui';

export const BillingComponent = ({
  surface = 'page',
}: {
  surface?: 'page' | 'account';
}) => {
  return (
    <Suspense
      fallback={
        surface === 'account' ? (
          <BillingShell>
            <AccountBillingPlaceholder />
          </BillingShell>
        ) : (
          <p>Loading billing…</p>
        )
      }
    >
      <BillingScreen mode="settings" surface={surface} />
    </Suspense>
  );
};
