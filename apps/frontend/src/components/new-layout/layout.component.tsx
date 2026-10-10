'use client';

import React, { ReactNode, useCallback, useEffect } from 'react';
import { Logo } from '@gitroom/frontend/components/new-layout/logo';
import { Plus_Jakarta_Sans } from 'next/font/google';
const ModeComponent = dynamic(
  () => import('@gitroom/frontend/components/layout/mode.component'),
  {
    ssr: false,
  }
);

import clsx from 'clsx';
import dynamic from 'next/dynamic';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { usePathname, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { CheckPayment } from '@gitroom/frontend/components/layout/check.payment';
import { ToolTip } from '@gitroom/frontend/components/layout/top.tip';
import { ShowMediaBoxModal } from '@gitroom/frontend/components/media/media.component';
import { ShowLinkedinCompany } from '@gitroom/frontend/components/launches/helpers/linkedin.component';
import { MediaSettingsLayout } from '@gitroom/frontend/components/launches/helpers/media.settings.component';
import { Toaster } from '@gitroom/react/toaster/toaster';
import { ShowPostSelector } from '@gitroom/frontend/components/post-url-selector/post.url.selector';
import { NewSubscription } from '@gitroom/frontend/components/layout/new.subscription';
import { Support } from '@gitroom/frontend/components/layout/support';
import { ContinueProvider } from '@gitroom/frontend/components/layout/continue.provider';
import { ContextWrapper } from '@gitroom/frontend/components/layout/user.context';
import { CopilotKit } from '@copilotkit/react-core';
import { MantineWrapper } from '@gitroom/react/helpers/mantine.wrapper';
import { Impersonate } from '@gitroom/frontend/components/layout/impersonate';
import { AnnouncementBanner } from '@gitroom/frontend/components/layout/announcement.banner';
import {
  TopMenu,
  TopMenuUtilities,
  SettingsMenuItem,
} from '@gitroom/frontend/components/layout/top.menu';
import { LanguageComponent } from '@gitroom/frontend/components/layout/language.component';
import { ChromeExtensionComponent } from '@gitroom/frontend/components/layout/chrome.extension.component';
import NotificationComponent from '@gitroom/frontend/components/notifications/notification.component';
import { OrganizationSelector } from '@gitroom/frontend/components/layout/organization.selector';
import { StreakComponent } from '@gitroom/frontend/components/layout/streak.component';
import { PreConditionComponent } from '@gitroom/frontend/components/layout/pre-condition.component';
import { AttachToFeedbackIcon } from '@gitroom/frontend/components/new-layout/sentry.feedback.component';
import { FirstBillingComponent } from '@gitroom/frontend/components/billing/first.billing.component';
import { TrialTracker } from '@gitroom/frontend/components/layout/gtm.component';
import { setSentryUser } from '@gitroom/react/sentry/initialize.sentry.client';
import { DashboardSwitcher } from '@gitroom/frontend/components/dashboard/dashboard.switcher';
import { StalkerTopNav } from '@gitroom/frontend/components/stalker/stalker.nav';
import { SettingsPageSkeleton } from '@gitroom/frontend/components/layout/settings.component';

const jakartaSans = Plus_Jakarta_Sans({
  weight: ['600', '500', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  display: 'swap',
  preload: false,
});

export const LayoutComponent = ({ children }: { children: ReactNode }) => {
  const fetch = useFetch();

  const { backendUrl, billingEnabled, isGeneral } = useVariables();

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const load = useCallback(async (path: string) => {
    return await (await fetch(path)).json();
  }, [fetch]);
  const { data: user, mutate } = useSWR('/user/self', load, {
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
    if (pathname?.startsWith('/stalker')) {
      return (
        <div
          className={clsx(
            'flex flex-col min-h-screen min-w-screen text-newTextColor p-[16px] gap-[12px]',
            jakartaSans.className
          )}
        >
          <header className="flex items-center gap-[8px] min-h-[64px] bg-newBgColorInner rounded-[24px] border border-newBorder px-[12px] py-[8px] shrink-0">
            <Logo compact />
            <div className="w-[1px] self-stretch my-[8px] bg-blockSeparator hidden sm:block shrink-0" />
            <DashboardSwitcher />
            <StalkerTopNav />
            <div className="ms-auto flex shrink-0 items-center gap-[8px]" aria-hidden>
              <span className="h-[28px] w-[28px] animate-pulse rounded-full bg-newBoxHover" />
              <span className="h-[28px] w-[28px] animate-pulse rounded-full bg-newBoxHover" />
              <span className="hidden h-[28px] w-[28px] animate-pulse rounded-full bg-newBoxHover md:block" />
            </div>
          </header>
          <div className="flex-1 bg-newBgLineColor rounded-[20px] overflow-hidden flex flex-col min-h-0 border border-newBorder">
            <div className="flex flex-1 gap-[1px] min-h-0 overflow-hidden">{children}</div>
          </div>
          <Toaster />
        </div>
      );
    }
    if (pathname?.startsWith('/settings')) {
      return (
        <div className="flex flex-col min-h-screen text-newTextColor p-[16px] gap-[12px]">
          <div className="min-h-[64px] bg-newBgColorInner rounded-[24px] border border-newBorder" />
          <div className="flex-1 bg-newBgLineColor rounded-[20px] overflow-hidden flex min-h-0 border border-newBorder">
            <SettingsPageSkeleton />
          </div>
        </div>
      );
    }
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
          <ToolTip />
          <Toaster />
          <TrialTracker />
          <CheckPayment check={searchParams.get('check') || ''} mutate={mutate}>
            <ShowMediaBoxModal />
            <ShowLinkedinCompany />
            <MediaSettingsLayout />
            <ShowPostSelector />
            <PreConditionComponent />
            <NewSubscription />
            <ContinueProvider />
            <div
              className={clsx(
                'flex flex-col min-h-screen min-w-screen text-newTextColor p-[16px] gap-[12px]',
                jakartaSans.className
              )}
            >
              <div>{user?.admin ? <Impersonate /> : <div />}</div>
              {user.tier === 'FREE' && isGeneral && billingEnabled ? (
                <FirstBillingComponent />
              ) : (
                <>
                  <AnnouncementBanner />
                  <Support />
                  <header
                    className={clsx(
                      'flex items-center min-h-[64px] bg-newBgColorInner rounded-[24px] border border-newBorder py-[8px] shrink-0',
                      pathname?.startsWith('/stalker')
                        ? 'gap-[8px] px-[12px]'
                        : 'gap-[16px] px-[20px]'
                    )}
                  >
                    <Logo compact={!!pathname?.startsWith('/stalker')} />
                    <div className="w-[1px] self-stretch my-[8px] bg-blockSeparator hidden sm:block shrink-0" />
                    <DashboardSwitcher />
                    {pathname?.startsWith('/stalker') ? (
                      <StalkerTopNav />
                    ) : (
                      <>
                        <TopMenu />
                        <TopMenuUtilities />
                      </>
                    )}
                    <div
                      className={clsx(
                        'flex items-center text-textItemBlur shrink-0 ms-auto',
                        pathname?.startsWith('/stalker') ? 'gap-[8px]' : 'gap-[16px]'
                      )}
                    >
                      <StreakComponent />
                      <div className="w-[1px] h-[20px] bg-blockSeparator hidden md:block" />
                      <OrganizationSelector />
                      <div className="flex items-center justify-center">
                        <ModeComponent />
                      </div>
                      <div className="w-[1px] h-[20px] bg-blockSeparator hidden md:block" />
                      <div
                        className={clsx(
                          pathname?.startsWith('/stalker') && 'hidden min-[1440px]:block'
                        )}
                      >
                        <LanguageComponent />
                      </div>
                      <ChromeExtensionComponent />
                      <SettingsMenuItem variant="header" />
                      <div className="w-[1px] h-[20px] bg-blockSeparator hidden md:block" />
                      <div
                        className={clsx(
                          pathname?.startsWith('/stalker') && 'hidden min-[1440px]:block'
                        )}
                      >
                        <AttachToFeedbackIcon />
                      </div>
                      <NotificationComponent />
                    </div>
                  </header>
                  <div className="flex-1 bg-newBgLineColor rounded-[20px] overflow-hidden flex flex-col min-h-0 border border-newBorder blurMe">
                    <div className="flex flex-1 gap-[1px] min-h-0 overflow-hidden">
                      {children}
                    </div>
                  </div>
                </>
              )}
            </div>
          </CheckPayment>
        </MantineWrapper>
      </CopilotKit>
    </ContextWrapper>
  );
};
