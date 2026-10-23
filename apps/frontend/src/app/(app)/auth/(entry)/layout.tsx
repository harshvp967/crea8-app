import { ReactNode } from 'react';
import loadDynamic from 'next/dynamic';
import { Geist, Manrope, Syne } from 'next/font/google';
import clsx from 'clsx';
import { WaitlistBackground } from '@gitroom/frontend/components/auth/waitlist.background';
import './waitlist.scss';

export const dynamic = 'force-dynamic';

const ReturnUrlComponent = loadDynamic(() => import('../return.url.component'));

const geist = Geist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist',
});

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-manrope',
});

const syne = Syne({
  subsets: ['latin'],
  weight: ['600', '700'],
  display: 'swap',
  variable: '--font-display',
});

export default async function LoginAuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className={clsx(geist.variable, manrope.variable, syne.variable, 'wl-auth')}>
      <WaitlistBackground />
      <ReturnUrlComponent />
      <main className="wl-auth-panel">{children}</main>
    </div>
  );
}
