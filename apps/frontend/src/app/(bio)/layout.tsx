import { Metadata } from 'next';
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

export default function BioLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={clsx(jakartaSans.className, 'dark text-primary !bg-primary')}>{children}</body>
    </html>
  );
}
