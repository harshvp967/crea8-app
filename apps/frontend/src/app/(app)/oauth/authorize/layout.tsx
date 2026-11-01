import { Metadata } from 'next';
import { ReactNode } from 'react';
import '../../../c8-oauth.scss';

export const metadata: Metadata = {
  title: 'Authorize Application',
};

export default async function OAuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="bg-c8-bg flex flex-1 min-h-screen w-screen">
      {children}
    </div>
  );
}
