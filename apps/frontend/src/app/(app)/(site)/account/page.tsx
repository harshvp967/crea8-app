import { AccountSettings } from '@gitroom/frontend/components/settings/account.settings';

export const dynamic = 'force-dynamic';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Account settings',
  description: '',
};

export default function AccountPage() {
  return <AccountSettings />;
}
