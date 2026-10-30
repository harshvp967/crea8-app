export const dynamic = 'force-dynamic';
import { Register } from '@gitroom/frontend/components/auth/register';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign up',
  description: '',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function RegisterPage() {
  return <Register />;
}
