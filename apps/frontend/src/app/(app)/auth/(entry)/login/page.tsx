export const dynamic = 'force-dynamic';
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
export default async function Auth() {
  return <Login />;
}
