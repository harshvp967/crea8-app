import { ReactNode } from 'react';
import { Metadata } from 'next';
import { LayoutComponent } from '@gitroom/frontend/components/new-layout/layout.component';
import { StalkerShell } from '@gitroom/frontend/components/stalker/stalker.shell';
import { StalkerProjectProvider } from '@gitroom/frontend/components/stalker/stalker.project';

export const metadata: Metadata = {
  title: `Crea8one Stalker`,
  description: '',
};

export default function StalkerLayout({ children }: { children: ReactNode }) {
  return (
    <StalkerProjectProvider>
      <LayoutComponent>
        <StalkerShell>{children}</StalkerShell>
      </LayoutComponent>
    </StalkerProjectProvider>
  );
}
