import { ReactNode } from 'react';
import { MantineWrapper } from '@gitroom/react/helpers/mantine.wrapper';
import { Toaster } from '@gitroom/react/toaster/toaster';

export const dynamic = 'force-dynamic';

export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <MantineWrapper>
      <Toaster />
      {children}
    </MantineWrapper>
  );
}
