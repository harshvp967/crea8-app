'use client';

import { csrfHeaders } from '@gitroom/helpers/utils/custom.fetch.func';
import React, { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
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
import { LinkTopNav } from '@gitroom/frontend/components/link-in-bio/link.nav';
import { SettingsPageSkeleton } from '@gitroom/frontend/components/layout/settings.component';
import { HeaderOverflow } from '@gitroom/frontend/components/layout/header.overflow';
import { MobileTabBar } from '@gitroom/frontend/components/layout/mobile.tabbar';
import { C8Sidebar } from '@gitroom/frontend/components/layout/c8.sidebar';

const HeaderAvatar = ({
  name,
  pressed,
  onClick,
}: {
  name: string;
  pressed: boolean;
  onClick: () => void;
}) => {
  const initials =
    name
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || '•';
  return (
    <button
      type="button"
      className="header-avatar"
      title={name || undefined}
      aria-label={name ? `${name} account` : 'Account'}
      aria-haspopup="menu"
      aria-expanded={pressed}
      onClick={onClick}
    >
      {initials}
    </button>
  );
};

const jakartaSans = Plus_Jakarta_Sans({
  weight: ['400', '500', '600'],
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
  const [accountOpen, setAccountOpen] = useState(false);
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setAccountOpen(false);
  }
  const accountRef = useRef<HTMLDivElement>(null);
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

  const stalker = !!pathname?.startsWith('/stalker');
  const link = pathname === '/link' || !!pathname?.startsWith('/link/');

  if (!user) {
    if (stalker || link) {
      return (
        <div
          className={clsx(
            'app-shell flex flex-col min-h-screen min-w-screen text-newTextColor p-[16px] gap-[12px]',
            jakartaSans.className
          )}
        >
          <header className="app-header flex items-center gap-[8px] min-h-[64px] bg-newBgColorInner rounded-[26px] border border-newBorder px-[12px] py-[8px] shrink-0">
            <span className="app-logo">
            <Logo compact />
            </span>
            <div className="w-[1px] self-stretch my-[8px] bg-blockSeparator hidden sm:block shrink-0" />
            <DashboardSwitcher />
            {stalker ? <StalkerTopNav /> : <LinkTopNav />}
            <div className="ms-auto flex shrink-0 items-center gap-[8px]" aria-hidden>
              <span className="h-[28px] w-[28px] animate-pulse rounded-full bg-newBoxHover" />
              <span className="h-[28px] w-[28px] animate-pulse rounded-full bg-newBoxHover" />
              <span className="hidden h-[28px] w-[28px] animate-pulse rounded-full bg-newBoxHover md:block" />
            </div>
          </header>
          <div className="flex-1 bg-newBgLineColor rounded-[34px] overflow-hidden flex flex-col min-h-0 border border-newBorder">
            <div className="app-main flex flex-1 gap-[1px] min-h-0 overflow-hidden">{children}</div>
          </div>
          <MobileTabBar />
          <Toaster />
        </div>
      );
    }
    if (pathname?.startsWith('/settings') || pathname?.startsWith('/account')) {
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
        headers={csrfHeaders}
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
                'app-shell flex flex-col min-h-screen min-w-screen text-newTextColor p-[16px] gap-[12px]',
                'c8-shell',
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
                  <div className="c8-frame">
                    <C8Sidebar
                      name={user?.name || ''}
                      email={user?.email || ''}
                      accountOpen={accountOpen}
                      onAccount={() => setAccountOpen((value) => !value)}
                    />
                  <div className="c8-main">
                  <header
                    className="app-header flex items-center min-h-[64px] h-[64px] bg-newBgColorInner rounded-[26px] border border-newBorder gap-[8px] ps-[18px] pe-[12px] shrink-0"
                  >
                    <span className="app-logo">
                      <Logo compact={stalker || link} />
                    </span>
                    <DashboardSwitcher />
                    <div className="navsep w-[1px] h-[24px] bg-blockSeparator hidden sm:block shrink-0" />
                    {link || stalker ? null : <TopMenu />}
                    <div className="header-tools flex items-center text-textItemBlur shrink-0 ms-auto gap-[8px]">
                      <div className="header-account relative flex items-center" ref={accountRef}>
                        <HeaderAvatar
                          name={user?.name || user?.email || ''}
                          pressed={accountOpen}
                          onClick={() => setAccountOpen((value) => !value)}
                        />
                        <OrganizationSelector
                          menuOpen={accountOpen}
                          onClose={() => setAccountOpen(false)}
                        />
                      </div>
                      <div className="flex items-center justify-center">
                        <ModeComponent />
                      </div>
                      <div className="header-gear">
                        <SettingsMenuItem variant="header" />
                      </div>
                      <NotificationComponent />
                      <HeaderOverflow>
                        <StreakComponent />
                        <LanguageComponent />
                        <ChromeExtensionComponent />
                        <AttachToFeedbackIcon />
                        <TopMenuUtilities />
                      </HeaderOverflow>
                    </div>
                  </header>
                  <div className="app-stage flex-1 overflow-hidden flex flex-col min-h-0 blurMe">
                    <div className="app-main flex flex-1 gap-[12px] min-h-0 overflow-hidden">
                      {children}
                    </div>
                  </div>
                  </div>
                  </div>
                  <MobileTabBar
                    onAccount={
                      !stalker && !link
                        ? () => setAccountOpen((value) => !value)
                        : undefined
                    }
                  />
                </>
              )}
            </div>
          </CheckPayment>
        </MantineWrapper>
      </CopilotKit>
    </ContextWrapper>
  );
};
