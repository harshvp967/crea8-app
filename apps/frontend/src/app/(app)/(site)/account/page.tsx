import { Suspense } from 'react';
import { AccountSettings } from '@gitroom/frontend/components/settings/account.settings';

export const dynamic = 'force-dynamic';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'crea8.one',
  description: '',
};

export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <AccountSettings />
    </Suspense>
  );
}
