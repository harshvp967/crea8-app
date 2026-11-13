'use client';

import { csrfHeaders } from '@gitroom/helpers/utils/custom.fetch.func';
import React, { ReactNode, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
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
import { SettingsPageSkeleton } from '@gitroom/frontend/components/layout/settings.component';
import { useIntegrationList } from '@gitroom/frontend/components/launches/helpers/use.integration.list';
import { HeaderOverflow } from '@gitroom/frontend/components/layout/header.overflow';
import { MobileTabBar } from '@gitroom/frontend/components/layout/mobile.tabbar';
import { C8Sidebar } from '@gitroom/frontend/components/layout/c8.sidebar';
import { AccountMenu, useAccountMenu } from '@gitroom/frontend/components/layout/account.menu';
import { useLinkStartup } from '@gitroom/frontend/components/link-in-bio/link.startup';
import { Skeleton } from '@gitroom/frontend/components/ui/skeleton';

const HeaderAvatar = ({
  name,
  picture,
  onClick,
  expanded,
  ref,
}: {
  name: string;
  picture?: string;
  onClick: () => void;
  expanded?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
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
      ref={ref}
      type="button"
      className="header-avatar"
      title={name || undefined}
      aria-haspopup="menu"
      aria-expanded={!!expanded}
      aria-label={name ? `${name}, account menu` : 'Account menu'}
      onClick={onClick}
    >
      {picture ? <img src={picture} alt="" /> : initials}
    </button>
  );
};

const useShellBreakpoint = () => {
  useLayoutEffect(() => {
    const desktop = window.matchMedia('(min-width: 1200px) and (min-height: 501px)');
    const phone = window.matchMedia('(max-width: 639px), (max-height: 500px)');
    const apply = () => {
      const next = phone.matches ? 'phone' : desktop.matches ? 'desktop' : 'tablet';
      if (document.documentElement.dataset.c8Bp !== next) {
        document.documentElement.dataset.c8Bp = next;
      }
    };
    apply();
    desktop.addEventListener('change', apply);
    phone.addEventListener('change', apply);
    window.addEventListener('resize', apply);
    return () => {
      desktop.removeEventListener('change', apply);
      phone.removeEventListener('change', apply);
      window.removeEventListener('resize', apply);
    };
  }, []);
};

const startupQuery = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  revalidateIfStale: false,
  revalidateOnMount: true,
  refreshWhenHidden: false,
  refreshWhenOffline: false,
  dedupingInterval: 15000,
};

const jakartaSans = Plus_Jakarta_Sans({
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  display: 'swap',
  preload: false,
});

// Painted on the server, before /user/self returns. The signed-in shell used
// to be `return null`, so the first HTML was only the dark body background.
export const AppShellSkeleton = () => {
  useShellBreakpoint();
  const accountMenu = useAccountMenu();
  return (
    <div
      className={clsx(
        'app-shell flex flex-col min-h-screen min-w-screen text-newTextColor p-[16px] gap-[12px]',
        'c8-shell',
        'c8-shell-loading',
        jakartaSans.className
      )}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading</span>
      <div className="c8-frame">
        <C8Sidebar name="" email="" picture="" menu={accountMenu} />
        <div className="c8-main">
          <header className="app-header flex items-center min-h-[64px] h-[64px] bg-newBgColorInner rounded-[26px] border border-newBorder gap-[8px] ps-[18px] pe-[12px] shrink-0">
            <span className="app-logo">
              <Logo />
            </span>
            <DashboardSwitcher />
            <div className="navsep w-[1px] h-[24px] bg-blockSeparator hidden sm:block shrink-0" />
            <div
              className="header-tools flex items-center text-textItemBlur shrink-0 ms-auto gap-[8px]"
              aria-hidden
            >
              <Skeleton className="h-[38px] w-[38px] shrink-0 rounded-[14px]" />
              <Skeleton className="header-avatar" />
            </div>
          </header>
          <div className="app-stage flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="app-main flex flex-1 gap-[12px] min-h-0 overflow-hidden p-[4px]">
              <div className="flex min-h-[240px] flex-1 flex-col gap-[12px] rounded-[26px] border border-newBorder bg-newBgColorInner p-[20px]">
                <Skeleton className="h-[20px] w-[180px] max-w-full rounded-full" />
                <Skeleton className="h-[120px] w-full rounded-[16px]" />
                <Skeleton className="h-[120px] w-full rounded-[16px]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const LayoutComponent = ({ children }: { children: ReactNode }) => {
  useShellBreakpoint();
  const fetch = useFetch();

  const { backendUrl, billingEnabled, isGeneral } = useVariables();

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const accountMenu = useAccountMenu();
  const accountRef = useRef<HTMLDivElement>(null);
  const headerAvatarRef = useRef<HTMLButtonElement>(null);
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
  // These used to start only after /user/self rendered the page. SWR keeps the
  // result, and the page hooks share these keys, so a mount inside the dedupe
  // window does not send them again.
  const launchesRoute = pathname === '/launches';
  const thirdPartyRoute =
    pathname === '/third-party' || !!pathname?.startsWith('/third-party/');
  useIntegrationList(launchesRoute);
  useSWR(
    launchesRoute ? 'sets' : null,
    async () => (await fetch('/sets')).json(),
    startupQuery
  );
  useSWR(
    launchesRoute ? 'default-sign' : null,
    async () => (await fetch('/signatures/default')).json(),
    startupQuery
  );
  useSWR(
    thirdPartyRoute ? 'third-party' : null,
    async () => (await fetch('/third-party')).json(),
    startupQuery
  );
  useSWR(
    thirdPartyRoute ? 'third-party-list' : null,
    async () => (await fetch('/third-party/list')).json(),
    startupQuery
  );
  useLinkStartup(pathname || '');

  useEffect(() => {
    setSentryUser(
      user ? { id: user.id, email: user.email, orgId: user.orgId } : null
    );
  }, [user]);

  const stalker = !!pathname?.startsWith('/stalker');
  const link = pathname === '/link' || !!pathname?.startsWith('/link/');

  if (!user) {
    if (stalker || link) {
      return <AppShellSkeleton />;
    }
    if (pathname?.startsWith('/settings') || pathname?.startsWith('/account')) {
      return (
        <div className="settings-screen c8-page-load">
          <SettingsPageSkeleton />
        </div>
      );
    }
    return <AppShellSkeleton />;
  }

  const needsPlan =
    user.tier === 'FREE' && isGeneral && (billingEnabled || user.billingEnabled);
  const linkRoute = pathname === '/link' || !!pathname?.startsWith('/link/');
  const accountRoute = pathname === '/account' || !!pathname?.startsWith('/account/');
  const settingsRoute = !!pathname?.startsWith('/settings');
  const keptOpen =
    linkRoute ||
    accountRoute ||
    settingsRoute ||
    pathname === '/join' ||
    pathname === '/err' ||
    !!pathname?.startsWith('/admin');
  const showPlanPicker = needsPlan && !keptOpen;

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
              <AnnouncementBanner />
              <Support />
              <ModeComponent applyOnly />
              <div className="c8-frame">
                <C8Sidebar
                  name={user?.name || ''}
                  email={user?.email || ''}
                  picture={user?.picture?.path || ''}
                  menu={accountMenu}
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
                        <OrganizationSelector />
                      </div>
                      <div className="header-gear">
                        <SettingsMenuItem variant="header" />
                      </div>
                      <NotificationComponent />
                      <div className="header-avatar-wrap relative flex items-center">
                        <HeaderAvatar
                          ref={headerAvatarRef}
                          name={user?.name || user?.email || ''}
                          picture={user?.picture?.path || ''}
                          expanded={accountMenu.open}
                          onClick={accountMenu.toggle}
                        />
                        <AccountMenu
                          open={accountMenu.open}
                          helpOpen={accountMenu.helpOpen}
                          planOpen={accountMenu.planOpen}
                          onHelpToggle={accountMenu.onHelpToggle}
                          onPlanToggle={accountMenu.onPlanToggle}
                          onClose={accountMenu.close}
                          onSettings={accountMenu.onSettings}
                          onBilling={accountMenu.onBilling}
                          anchorRef={headerAvatarRef}
                          surface="header"
                        />
                      </div>
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
                      {showPlanPicker ? (
                        <div className="flex min-h-0 min-w-0 flex-1 overflow-auto">
                          <FirstBillingComponent />
                        </div>
                      ) : (
                        children
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <MobileTabBar />
            </div>
          </CheckPayment>
        </MantineWrapper>
      </CopilotKit>
    </ContextWrapper>
  );
};
