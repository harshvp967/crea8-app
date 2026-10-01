import { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { ReactNode } from 'react';
import clsx from 'clsx';
import '../global.scss';

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
};

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
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
