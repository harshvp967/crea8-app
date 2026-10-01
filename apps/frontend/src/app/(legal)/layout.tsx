import { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { ReactNode } from 'react';
import clsx from 'clsx';
import '../global.scss';
import { crea8oneIcons } from '@gitroom/frontend/components/layout/crea8one.icons';

const jakartaSans = Plus_Jakarta_Sans({
  weight: ['600', '500'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
});

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
  icons: crea8oneIcons,
};

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        className={clsx(
          jakartaSans.className,
          'dark text-primary !bg-primary'
        )}
      >
        {children}
      </body>
    </html>
  );
}
