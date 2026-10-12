import { ReactNode } from 'react';
import { Metadata } from 'next';
import { LayoutComponent } from '@gitroom/frontend/components/new-layout/layout.component';
import { LinkShell } from '@gitroom/frontend/components/link-in-bio/link.shell';

export const metadata: Metadata = {
  title: 'crea8.one Link-in-Bio',
  description: '',
};

export default function LinkLayout({ children }: { children: ReactNode }) {
  return (
    <LayoutComponent>
      <LinkShell>{children}</LinkShell>
    </LayoutComponent>
  );
}
