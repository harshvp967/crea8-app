'use client';

import { ReactNode, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Toaster } from '@gitroom/react/toaster/toaster';
import { StalkerProjectProvider } from '@gitroom/frontend/components/stalker/stalker.project';
import { StalkerTopNav } from '@gitroom/frontend/components/stalker/stalker.nav';
import { StalkerShell } from '@gitroom/frontend/components/stalker/stalker.shell';
import { StalkerMentions } from '@gitroom/frontend/components/stalker/stalker.mentions';
import { StalkerAnalytics } from '@gitroom/frontend/components/stalker/stalker.analytics';
import { StalkerKeywords } from '@gitroom/frontend/components/stalker/stalker.keywords';
import { StalkerAlerts } from '@gitroom/frontend/components/stalker/stalker.alerts';
import { StalkerSettings } from '@gitroom/frontend/components/stalker/stalker.settings';
import { StalkerApi } from '@gitroom/frontend/components/stalker/stalker.api';

const pages: Record<string, ReactNode> = {
  mentions: <StalkerMentions />,
  analytics: <StalkerAnalytics />,
  keywords: <StalkerKeywords />,
  alerts: <StalkerAlerts />,
  settings: <StalkerSettings />,
  api: <StalkerApi />,
  wizard: <StalkerMentions />,
  welcome: null,
};

const Frame = ({ page }: { page: string }) => {
  const search = useSearchParams();

  useEffect(() => {
    const mode = search.get('mode') === 'light' ? 'light' : 'dark';
    document.body.classList.remove('dark', 'light');
    document.body.classList.add(mode);
  }, [search]);

  return (
    <div className="flex min-h-screen flex-col gap-[12px] bg-newBgLineColor p-[16px] text-newTextColor">
      <Toaster />
      <header className="flex min-h-[64px] items-center gap-[12px] rounded-[24px] border border-newBorder bg-newBgColorInner px-[16px] py-[8px]">
        <span className="shrink-0 text-[16px] font-[700]">Crea8one</span>
        <StalkerTopNav force base="/stalker-preview" />
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] border border-newBorder bg-newBgColorInner">
        <StalkerShell>{pages[page] || null}</StalkerShell>
      </div>
    </div>
  );
};

export const StalkerPreview = ({ page }: { page: string }) => (
  <StalkerProjectProvider sample empty={page === 'welcome'} initialWizard={page === 'wizard'}>
    <Frame page={page} />
  </StalkerProjectProvider>
);
