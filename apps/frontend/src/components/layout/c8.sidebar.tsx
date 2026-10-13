'use client';

import { useRouter, usePathname } from 'next/navigation';
import clsx from 'clsx';
import Link from 'next/link';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import type { HugeIconName } from '@gitroom/frontend/components/icons/hugeicons/paths';
import {
  useMenuItem,
  useVisibleMenuItems,
} from '@gitroom/frontend/components/layout/top.menu';
import NotificationComponent from '@gitroom/frontend/components/notifications/notification.component';
import dynamic from 'next/dynamic';

const ModeComponent = dynamic(
  () => import('@gitroom/frontend/components/layout/mode.component'),
  { ssr: false }
);

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
  accountOpen,
  onAccount,
}: {
  name: string;
  email: string;
  accountOpen: boolean;
  onAccount: () => void;
}) => {
  const pathname = usePathname() || '';
  const router = useRouter();
  const { stalkerEnabled } = useVariables();
  const { firstMenu, secondMenu } = useMenuItem();
  const primary = useVisibleMenuItems(firstMenu);
  const settings = useVisibleMenuItems(
    secondMenu.filter((item) => item.path === '/settings')
  );
  const extras = useVisibleMenuItems(secondMenu, { excludeSettings: true });

  const apps = [
    {
      id: 'schedule',
      label: 'Schedule',
      href: '/launches',
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
      href: '/link',
      icon: 'link' as HugeIconName,
      tile: 'is-link',
    },
  ];
  const activeApp = pathname.startsWith('/stalker')
    ? 'stalker'
    : pathname === '/link' || pathname.startsWith('/link/')
    ? 'link'
    : 'schedule';

  const openComposer = () => {
    const button = document.querySelector<HTMLButtonElement>(
      '.strip-create button, .sidebar-create button, .phone-create button'
    );
    if (button) {
      button.click();
      return;
    }
    router.push('/launches');
  };

  const rows = [
    ...primary.slice(0, 1),
    {
      name: 'Composer',
      path: '/launches',
      icon: <HugeIcon name="pencil" size={18} />,
      onClick: openComposer,
    },
    ...primary.slice(1),
    ...settings,
    ...extras,
  ];

  return (
    <aside className="c8-sidebar" aria-label="Schedule">
      <Link href="/launches" className="c8-side-logo" title="crea8.one">
        <img className="c8-side-mark" src="/crea8one-icon-cyan.svg" alt="" />
        <span className="c8-side-logo-word">crea8.one</span>
        <span className="c8-side-dot" aria-hidden />
      </Link>
      <p className="c8-side-kicker">Apps</p>
      <nav className="c8-side-apps" aria-label="Apps">
        {apps.map((app) => (
          <Link
            key={app.id}
            href={app.href}
            className={clsx('c8-side-app', app.id === activeApp && 'is-active')}
            aria-current={app.id === activeApp ? 'page' : undefined}
            title={app.label}
          >
            <span className={clsx('c8-side-tile', app.tile)}>
              <HugeIcon name={app.icon} size={16} />
            </span>
            <span className="c8-side-text">{app.label}</span>
          </Link>
        ))}
      </nav>
      <div className="c8-side-rule" />
      <p className="c8-side-kicker">Schedule</p>
      <nav className="c8-side-nav" aria-label="Schedule">
        {rows.map((item) => {
          const active =
            !item.onClick &&
            item.path !== '#' &&
            pathname.indexOf(item.path) === 0;
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
                title={item.name}
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
              title={item.name}
              aria-current={active ? 'page' : undefined}
            >
              {inner}
            </Link>
          );
        })}
      </nav>
      <div className="c8-side-spacer" />
      <div className="c8-side-foot">
        <button
          type="button"
          className="c8-side-user"
          aria-haspopup="menu"
          aria-expanded={accountOpen}
          onClick={onAccount}
        >
          <span className="c8-side-avatar">{initialsOf(name || email)}</span>
          <span className="c8-side-user-copy">
            <span className="c8-side-user-name">{name || email}</span>
            <span className="c8-side-user-handle">crea8.one</span>
          </span>
        </button>
        <NotificationComponent />
        <ModeComponent />
      </div>
    </aside>
  );
};
