import { ReactNode } from 'react';
import { Metadata } from 'next';
import { StalkerShell } from '@gitroom/frontend/components/stalker/stalker.shell';

export const metadata: Metadata = {
  title: `Crea8one Stalker`,
  description: '',
};

export default function StalkerLayout({ children }: { children: ReactNode }) {
  return <StalkerShell>{children}</StalkerShell>;
}
