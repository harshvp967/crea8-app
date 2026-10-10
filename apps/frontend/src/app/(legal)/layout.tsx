import { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { ReactNode } from 'react';
import clsx from 'clsx';
import '../global.scss';
import { crea8oneIcons } from '@gitroom/frontend/components/layout/crea8one.icons';
import { publicPageMetadata } from '@gitroom/frontend/components/layout/site.metadata';

const jakartaSans = Plus_Jakarta_Sans({
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  ...publicPageMetadata(),
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
