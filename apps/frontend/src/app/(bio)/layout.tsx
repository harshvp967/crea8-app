import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { ReactNode } from 'react';
import clsx from 'clsx';
import '../global.scss';
import '@gitroom/frontend/components/link-in-bio/link.scss';
import { crea8oneIcons } from '@gitroom/frontend/components/layout/crea8one.icons';

const jakartaSans = Plus_Jakarta_Sans({
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  icons: crea8oneIcons,
};

export default async function BioLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const mode = cookieStore.get('mode')?.value === 'light' ? 'light' : 'dark';
  return (
    <html lang="en">
      <body className={clsx(jakartaSans.className, mode, 'text-primary !bg-primary')}>{children}</body>
    </html>
  );
}
