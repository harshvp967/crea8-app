'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import Link from 'next/link';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import type { HugeIconName } from '@gitroom/frontend/components/icons/hugeicons/paths';
import {
  useMenuItem,
  useVisibleMenuItems,
} from '@gitroom/frontend/components/layout/top.menu';
import { insertComposer } from '@gitroom/frontend/components/layout/shell.nav';
import { stalkerNavLinks } from '@gitroom/frontend/components/stalker/stalker.nav';
import { linkNavLinks } from '@gitroom/frontend/components/link-in-bio/link.nav';
import NotificationComponent from '@gitroom/frontend/components/notifications/notification.component';
import { useOpenComposer } from '@gitroom/frontend/components/launches/new.post';
import { AccountMenu } from '@gitroom/frontend/components/layout/account.menu';
import { useWorkspaceSwitch } from '@gitroom/frontend/components/layout/organization.selector';
import { useUser } from '@gitroom/frontend/components/layout/user.context';

const SIDEBAR_KEY = 'c8.sidebar.collapsed';

type SidebarMode = 'collapsed' | 'expanded' | 'auto';

type SideTip = {
  text: string;
  top: number;
  left: number;
  rtl: boolean;
};

const storedSidebarMode = (): SidebarMode => {
  try {
    const stored = window.localStorage.getItem(SIDEBAR_KEY);
    if (stored === '1') {
      return 'collapsed';
    }
    if (stored === '0') {
      return 'expanded';
    }
  } catch {
    return 'auto';
  }
  return 'auto';
};

const initialsOf = (name: string) =>
  name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '•';

export const C8Sidebar = ({
  name,
  email,
  picture,
  menu,
}: {
  name: string;
  email: string;
  picture?: string;
  menu: {
    open: boolean;
    helpOpen: boolean;
    planOpen: boolean;
    onHelpToggle: () => void;
    onPlanToggle: () => void;
    close: () => void;
    onSettings: () => void;
    onBilling: () => void;
    toggle: () => void;
  };
}) => {
  const pathname = usePathname() || '';
  const router = useRouter();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [mode, setMode] = useState<SidebarMode>('auto');
  const [narrow, setNarrow] = useState(false);
  const [tip, setTip] = useState<SideTip | null>(null);
  useLayoutEffect(() => {
    const query = window.matchMedia('(max-width: 1199px)');
    const apply = () => setNarrow(query.matches);
    apply();
    setMode(storedSidebarMode());
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);
  const collapsed = mode === 'collapsed' || (mode === 'auto' && narrow);
  const hideTip = () => setTip(null);
  const showTip = (event: { currentTarget: HTMLElement }) => {
    const text = event.currentTarget.getAttribute('data-tip');
    if (!text) {
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    const rtl = document.documentElement.dir === 'rtl';
    setTip({
      text,
      top: box.top + box.height / 2,
      left: rtl ? box.left - 10 : box.right + 10,
      rtl,
    });
  };
  const tipProps = (text: string) =>
    collapsed
      ? {
          'data-tip': text,
          onMouseEnter: showTip,
          onMouseLeave: hideTip,
          onFocus: showTip,
          onBlur: hideTip,
        }
      : {};
  const toggleSidebar = () => {
    hideTip();
    const next = !collapsed;
    setMode(next ? 'collapsed' : 'expanded');
    try {
      window.localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
    } catch {
      // Storage can be blocked. The toggle still applies for this view.
    }
  };
  const user = useUser();
  const { current } = useWorkspaceSwitch();
  const workspaceLine = current?.name ? `Workspace - ${current.name}` : '';
  const openComposer = useOpenComposer();
  const { stalkerEnabled, isGeneral, billingEnabled } = useVariables();
  const planLocked =
    user?.tier?.current === 'FREE' && !!isGeneral && !!(billingEnabled || user?.billingEnabled);
  const { firstMenu, secondMenu } = useMenuItem();
  const primary = useVisibleMenuItems(firstMenu);
  const settings = useVisibleMenuItems(
    secondMenu.filter((item) => item.path === '/account')
  );
  const extras = useVisibleMenuItems(secondMenu, { excludeSettings: true });

  const apps = [
    {
      id: 'schedule',
      label: 'Schedule',
      href: '/schedule',
      icon: 'calendar' as HugeIconName,
      tile: 'is-schedule',
    },
    ...(stalkerEnabled
      ? [
          {
            id: 'stalker',
            label: 'Stalker',
            href: '/stalker/mentions',
            icon: 'eye' as HugeIconName,
            tile: 'is-stalker',
          },
        ]
      : []),
    {
      id: 'link',
      label: 'Link-in-Bio',
      href: '/linkinbio',
      icon: 'link' as HugeIconName,
      tile: 'is-link',
    },
  ];
  const activeApp = pathname.startsWith('/stalker')
    ? 'stalker'
    : pathname === '/linkinbio' || pathname.startsWith('/linkinbio/') || pathname === '/link' || pathname.startsWith('/link/')
    ? 'link'
    : 'schedule';

  const rows = [
    ...insertComposer(primary, {
      name: 'Composer',
      path: '/schedule',
      icon: <HugeIcon name="pencil" size={18} />,
      onClick: openComposer,
    }),
    ...settings,
    ...extras,
  ];
  const sectionLabel =
    activeApp === 'stalker' ? 'Stalker' : activeApp === 'link' ? 'Link-in-Bio' : 'Schedule';
  const sectionRows =
    activeApp === 'stalker'
      ? stalkerNavLinks.map((link) => ({
          name: link.label,
          path: link.path,
          icon: link.icon,
          onClick: undefined as (() => void) | undefined,
        }))
      : activeApp === 'link'
      ? linkNavLinks.map((item) => ({
          name: item.label,
          path: item.path,
          icon: item.icon,
          onClick: undefined as (() => void) | undefined,
        }))
      : rows;

  return (
    <aside
      className={clsx(
        'c8-sidebar',
        mode === 'collapsed' && 'is-collapsed',
        mode === 'expanded' && 'is-expanded'
      )}
      aria-label={sectionLabel}
      onScroll={hideTip}
    >
      <Link
        href="/schedule"
        className="c8-side-logo"
        aria-label="crea8.one"
        data-tip="crea8.one"
        onMouseEnter={showTip}
        onMouseLeave={hideTip}
        onFocus={showTip}
        onBlur={hideTip}
      >
        <img
          className="c8-side-mark"
          src="/crea8one-icon-cyan.svg"
          alt=""
        />
        <span className="c8-side-word">
          <img
            className="c8-side-word-img c8-side-word-light"
            src="/crea8one-logo-horizontal-color.svg"
            alt=""
          />
          <img
            className="c8-side-word-img c8-side-word-dark"
            src="/crea8one-logo-horizontal-color-on-dark.svg"
            alt=""
          />
        </span>
      </Link>
      <nav id="c8-side-apps" className="c8-side-apps" aria-label="Apps">
        {apps.map((app) => {
          const locked = planLocked && (app.id === 'schedule' || app.id === 'stalker');
          const className = clsx('c8-side-app', app.id === activeApp && 'is-active');
          const inner = (
            <>
              <span className={clsx('c8-side-tile', app.tile)}>
                <HugeIcon name={app.icon} size={16} />
              </span>
              <span className="c8-side-text">{app.label}</span>
              {locked ? (
                <span className="c8-side-lock" aria-hidden>
                  <HugeIcon name="lock" size={14} />
                </span>
              ) : null}
            </>
          );
          if (locked) {
            return (
              <button
                key={app.id}
                type="button"
                className={className}
                aria-current={app.id === activeApp ? 'page' : undefined}
                aria-label={app.label}
                {...tipProps(app.label)}
                onClick={() => {
                  if (pathname !== '/schedule' && pathname !== '/launches') {
                    router.push('/schedule');
                  }
                }}
              >
                {inner}
              </button>
            );
          }
          return (
            <Link
              key={app.id}
              href={app.href}
              className={className}
              aria-current={app.id === activeApp ? 'page' : undefined}
              aria-label={app.label}
              {...tipProps(app.label)}
            >
              {inner}
            </Link>
          );
        })}
      </nav>
      <div className="c8-side-rule" />
      <nav id="c8-side-section" className="c8-side-nav" aria-label={sectionLabel}>
        {sectionRows.map((item) => {
          const active =
            !item.onClick &&
            item.path !== '#' &&
            (activeApp === 'link'
              ? item.path === '/linkinbio'
                ? pathname === '/linkinbio' || pathname === '/link'
                : pathname === item.path || pathname.startsWith(`${item.path}/`)
              : item.path === '/schedule'
                ? pathname === '/schedule' || pathname === '/launches'
                : pathname === item.path || pathname.startsWith(`${item.path}/`));
          const className = clsx('c8-side-link', active && 'is-active');
          const inner = (
            <>
              <span className="c8-side-ico">{item.icon}</span>
              <span className="c8-side-text">{item.name}</span>
              {active ? <span className="c8-side-dot" aria-hidden /> : null}
            </>
          );
          if (item.onClick) {
            return (
              <button
                key={item.name}
                type="button"
                className={className}
                aria-label={item.name}
                {...tipProps(item.name)}
                onClick={item.onClick}
              >
                {inner}
              </button>
            );
          }
          return (
            <Link
              key={item.path + item.name}
              href={item.path}
              className={className}
              aria-label={item.name}
              aria-current={active ? 'page' : undefined}
              {...tipProps(item.name)}
            >
              {inner}
            </Link>
          );
        })}
      </nav>
      <div className="c8-side-spacer" />
      <div className="c8-side-foot">
        <button
          ref={anchorRef}
          type="button"
          className="c8-side-user"
          aria-haspopup="menu"
          aria-expanded={menu.open}
          aria-label={
            name || email ? `${name || email}, account menu` : 'Account menu'
          }
          {...tipProps(name || email || 'Account')}
          onClick={menu.toggle}
        >
          <span className="c8-side-avatar">
            {picture ? <img src={picture} alt="" /> : initialsOf(name || email)}
          </span>
          <span className="c8-side-user-copy">
            <span className="c8-side-user-name">{name || email}</span>
            <span className="c8-side-user-handle" title={workspaceLine || undefined}>
              {workspaceLine}
            </span>
          </span>
        </button>
        <AccountMenu
          open={menu.open}
          helpOpen={menu.helpOpen}
          planOpen={menu.planOpen}
          onHelpToggle={menu.onHelpToggle}
          onPlanToggle={menu.onPlanToggle}
          onClose={menu.close}
          onSettings={menu.onSettings}
          onBilling={menu.onBilling}
          anchorRef={anchorRef}
          surface="sidebar"
        />
        <NotificationComponent />
        <button
          type="button"
          className="c8-side-collapse"
          aria-expanded={!collapsed}
          aria-controls="c8-side-apps c8-side-section"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          data-tip={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onMouseEnter={showTip}
          onMouseLeave={hideTip}
          onFocus={showTip}
          onBlur={hideTip}
          onClick={toggleSidebar}
        >
          <HugeIcon name={collapsed ? 'chevron-right' : 'chevron-left'} size={16} />
        </button>
      </div>
      {tip
        ? createPortal(
            <span
              className="c8-side-tip"
              role="tooltip"
              style={{
                top: tip.top,
                left: tip.left,
                transform: tip.rtl ? 'translate(-100%, -50%)' : 'translateY(-50%)',
              }}
            >
              {tip.text}
            </span>,
            document.body
          )
        : null}
    </aside>
  );
};
