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
import { Logo } from '@gitroom/frontend/components/new-layout/logo';
import { MobileTabBar } from '@gitroom/frontend/components/layout/mobile.tabbar';

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
    <div className="app-shell flex min-h-screen flex-col gap-[12px] bg-[var(--arc-canvas)] p-[16px] text-newTextColor">
      <Toaster />
      <header className="app-header flex min-h-[64px] items-center gap-[8px] rounded-[26px] border border-newBorder bg-newBgColorInner px-[12px] py-[8px] shadow-[var(--arc-shadow-resting)]">
        <Logo compact />
        <div className="hidden h-[32px] shrink-0 items-center justify-center rounded-full border border-newBorder px-[12px] text-[12px] font-[600] text-textItemBlur sm:flex">
          Schedule | Stalker
        </div>
        <StalkerTopNav force base="/stalker-preview" />
        <div className="ms-auto flex shrink-0 items-center gap-[8px] text-textItemBlur" aria-hidden>
          <span className="h-[28px] w-[28px] rounded-full border border-newBorder" />
          <span className="h-[28px] w-[28px] rounded-full border border-newBorder" />
          <span className="h-[28px] w-[28px] rounded-full border border-newBorder" />
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[26px] border border-newBorder bg-newBgColorInner shadow-[var(--arc-shadow-resting)]">
        <StalkerShell>{pages[page] || null}</StalkerShell>
      </div>
      <MobileTabBar />
    </div>
  );
};

export const StalkerPreview = ({ page }: { page: string }) => {
  const search = useSearchParams();
  return (
    <StalkerProjectProvider
      sample
      empty={page === 'welcome'}
      initialWizard={page === 'wizard'}
      previewScan={search.get('scan')}
    >
      <Frame page={page} />
    </StalkerProjectProvider>
  );
};
