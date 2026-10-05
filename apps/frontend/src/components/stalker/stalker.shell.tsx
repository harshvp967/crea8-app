'use client';

import { ReactNode, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import clsx from 'clsx';
import { Plus_Jakarta_Sans } from 'next/font/google';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { ContextWrapper } from '@gitroom/frontend/components/layout/user.context';
import { MantineWrapper } from '@gitroom/react/helpers/mantine.wrapper';
import { Toaster } from '@gitroom/react/toaster/toaster';
import { ToolTip } from '@gitroom/frontend/components/layout/top.tip';
import { CopilotKit } from '@copilotkit/react-core';
import { Logo } from '@gitroom/frontend/components/new-layout/logo';
import { DashboardSwitcher } from '@gitroom/frontend/components/dashboard/dashboard.switcher';
import { MenuItem } from '@gitroom/frontend/components/new-layout/menu-item';
import { StalkerProjectProvider, useStalkerProject } from '@gitroom/frontend/components/stalker/stalker.project';
import { StalkerWizard } from '@gitroom/frontend/components/stalker/stalker.wizard';
import { OrganizationSelector } from '@gitroom/frontend/components/layout/organization.selector';
import NotificationComponent from '@gitroom/frontend/components/notifications/notification.component';
import { FirstBillingComponent } from '@gitroom/frontend/components/billing/first.billing.component';
import { setSentryUser } from '@gitroom/react/sentry/initialize.sentry.client';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

const ModeComponent = dynamic(
  () => import('@gitroom/frontend/components/layout/mode.component'),
  { ssr: false }
);

const jakartaSans = Plus_Jakarta_Sans({
  weight: ['600', '500', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
});

const Dot = () => (
  <span className="block h-[8px] w-[8px] rounded-full bg-current" />
);

const StalkerBody = ({ children }: { children: ReactNode }) => {
  const t = useT();
  const {
    projects,
    project,
    setProjectId,
    loading,
    showWizard,
    setShowWizard,
  } = useStalkerProject();
  const links = [
    {
      label: t('stalker_mentions', 'Mentions'),
      path: '/stalker/mentions',
    },
    {
      label: t('stalker_analytics', 'Analytics'),
      path: '/stalker/analytics',
    },
    {
      label: t('stalker_themes', 'Themes'),
      path: '/stalker/themes',
    },
    {
      label: t('stalker_keywords', 'Keywords'),
      path: '/stalker/keywords',
    },
    {
      label: t('stalker_alerts', 'Alerts'),
      path: '/stalker/alerts',
    },
    {
      label: t('stalker_settings', 'Settings'),
      path: '/stalker/settings',
    },
  ];

  if (loading) {
    return <p className="p-[24px] text-[14px] text-textItemBlur">Loading Stalker…</p>;
  }

  if (showWizard) {
    return (
      <div className="flex-1 overflow-auto p-[20px]">
        <StalkerWizard />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <aside className="flex gap-[8px] overflow-x-auto border-b border-newBorder p-[16px] md:w-[240px] md:shrink-0 md:flex-col md:border-b-0 md:border-r">
        <label className="mb-[8px] flex min-w-[180px] flex-col gap-[6px] text-[12px] text-textItemBlur">
          Project
          <span className="flex items-center gap-[8px]">
            <span
              className="h-[10px] w-[10px] shrink-0 rounded-full"
              style={{ backgroundColor: project?.color || '#00D9FF' }}
            />
            <select
              aria-label="Project"
              className="w-full rounded-[10px] border border-[#2a2a2a] bg-[#141414] px-[8px] py-[6px] text-[13px] text-newTextColor"
              value={project?.id || ''}
              onChange={(event) => setProjectId(event.target.value)}
            >
              {projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </span>
          <button
            type="button"
            className="self-start text-[#00D9FF] underline"
            onClick={() => setShowWizard(true)}
          >
            New project
          </button>
        </label>
        {links.map((link) => (
          <MenuItem
            key={link.path}
            variant="sidebar"
            label={link.label}
            path={link.path}
            icon={<Dot />}
          />
        ))}
      </aside>
      <main className="min-w-0 flex-1 overflow-auto p-[20px]">{children}</main>
    </div>
  );
};

export const StalkerShell = ({ children }: { children: ReactNode }) => {
  const fetch = useFetch();
  const t = useT();
  const { stalkerEnabled, billingEnabled, isGeneral, backendUrl } = useVariables();
  const load = useCallback(async (path: string) => {
    return await (await fetch(path)).json();
  }, []);
  const { data: user } = useSWR('/user/self', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    refreshWhenOffline: false,
    refreshWhenHidden: false,
  });

  useEffect(() => {
    setSentryUser(
      user ? { id: user.id, email: user.email, orgId: user.orgId } : null
    );
  }, [user]);

  if (!user) {
    return null;
  }

  return (
    <ContextWrapper user={user}>
      <CopilotKit
        credentials="include"
        runtimeUrl={backendUrl + '/copilot/chat'}
        useSingleEndpoint={true}
        showDevConsole={false}
      >
      <MantineWrapper>
        <Toaster />
        <ToolTip />
        <div
          className={clsx(
            'flex flex-col min-h-screen min-w-screen text-newTextColor p-[16px] gap-[12px]',
            jakartaSans.className
          )}
        >
          {user.tier === 'FREE' && isGeneral && billingEnabled ? (
            <FirstBillingComponent />
          ) : (
            <>
              <header className="flex items-center gap-[16px] min-h-[64px] bg-newBgColorInner rounded-[24px] border border-newBorder px-[20px] py-[8px] shrink-0">
                <Logo />
                <div className="w-[1px] self-stretch my-[8px] bg-blockSeparator hidden sm:block shrink-0" />
                <DashboardSwitcher />
                <div className="flex items-center gap-[16px] text-textItemBlur shrink-0 ms-auto">
                  <OrganizationSelector />
                  <div className="flex items-center justify-center">
                    <ModeComponent />
                  </div>
                  <NotificationComponent />
                </div>
              </header>
              <div className="flex-1 bg-newBgLineColor rounded-[20px] overflow-hidden flex flex-col min-h-0 border border-newBorder">
                {!stalkerEnabled ? (
                  <div className="p-[32px] text-[15px] text-textItemBlur">
                    {t(
                      'stalker_disabled',
                      'Stalker is turned off. Set STALKER_ENABLED=true on the frontend and the backend to open this dashboard.'
                    )}
                  </div>
                ) : (
                  <StalkerProjectProvider>
                    <StalkerBody>{children}</StalkerBody>
                  </StalkerProjectProvider>
                )}
              </div>
            </>
          )}
        </div>
      </MantineWrapper>
      </CopilotKit>
    </ContextWrapper>
  );
};
