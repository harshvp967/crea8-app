export const dynamic = 'force-dynamic';
import { Register } from '@gitroom/frontend/components/auth/register';
import { Login } from '@gitroom/frontend/components/auth/login';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in',
  description: '',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function Auth({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string; code?: string }>;
}) {
  const query = await searchParams;
  if (query?.provider && query?.code) {
    return <Register />;
  }
  return <Login />;
}
