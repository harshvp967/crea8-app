import { ReactNode } from 'react';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
import { StalkerShell } from '@gitroom/frontend/components/stalker/stalker.shell';

export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Crea8one' : 'Gitroom'} Stalker`,
  description: '',
};

export default function StalkerLayout({ children }: { children: ReactNode }) {
  return <StalkerShell>{children}</StalkerShell>;
}
