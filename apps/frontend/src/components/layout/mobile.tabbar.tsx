'use client';

import React, { useState } from 'react';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { useMenuItem, useVisibleMenuItems } from '@gitroom/frontend/components/layout/top.menu';
import { stalkerNavLinks } from '@gitroom/frontend/components/stalker/stalker.nav';
import { linkNavLinks } from '@gitroom/frontend/components/link-in-bio/link.nav';
import { useOpenComposer } from '@gitroom/frontend/components/launches/new.post';

const phoneBarLimit = 5;

export const MobileTabBar = () => {
  const pathname = (usePathname() || '').replace(/^\/stalker-preview/, '/stalker');
  const router = useRouter();
  const openComposer = useOpenComposer();
  const stalker = pathname.startsWith('/stalker');
  const link = pathname === '/link' || pathname.startsWith('/link/');
  const { firstMenu, secondMenu } = useMenuItem();
  const primary = useVisibleMenuItems(firstMenu);
  const extra = useVisibleMenuItems(secondMenu);
  const [more, setMore] = useState(false);
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setMore(false);
  }

  const asItem = (item: {
    name?: string;
    label?: string;
    path: string;
    icon: React.ReactNode;
    onClick?: () => void;
  }) => ({
    name: item.name || item.label || '',
    path: item.path,
    icon: item.icon,
    onClick: item.onClick,
  });

  const openChannels = () => {
    if (pathname.startsWith('/launches')) {
      window.dispatchEvent(new Event('c8-open-channels'));
      return;
    }
    sessionStorage.setItem('c8-open-channels', '1');
    router.push('/launches');
  };

  const direct = link
    ? linkNavLinks.map((item) => asItem({ ...item, icon: item.tabIcon || item.icon }))
    : stalker
    ? stalkerNavLinks.map((item) => asItem({ ...item, icon: item.tabIcon || item.icon }))
    : null;
  const schedulerTabs = [
    ...primary.slice(0, 1).map(asItem),
    {
      name: 'Composer',
      path: '#',
      icon: <HugeIcon name="pencil" size={18} />,
      onClick: openComposer,
    },
    ...primary.slice(1, 3).map(asItem),
  ];
  const schedulerOverflow = [
    {
      name: 'Channels',
      path: '#',
      icon: <HugeIcon name="plug" size={18} />,
      onClick: openChannels,
    },
    ...[...primary.slice(3), ...extra].map(asItem),
  ];
  const all = direct ?? [...schedulerTabs, ...schedulerOverflow];
  const showMore = all.length > phoneBarLimit;
  const tabs = showMore ? (direct ? direct.slice(0, 4) : schedulerTabs) : all;
  const overflow = showMore ? (direct ? direct.slice(4) : schedulerOverflow) : [];

  const active = (path: string) =>
    path === '/link' ? pathname === '/link' : path !== '#' && pathname.indexOf(path) === 0;
  const moreActive = !tabs.some((item) => active(item.path));
  const sheetOpen = more && showMore;

  return (
    <div className="contents">
      {sheetOpen ? (
        <div
          className="sheet-backdrop more-backdrop"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setMore(false);
          }}
        />
      ) : null}
      {sheetOpen ? (
        <div className="mobile-sheet" role="menu">
          {overflow.map((item) => {
            const click = item.onClick;
            if (click) {
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => {
                    click();
                    setMore(false);
                  }}
                >
                  {item.icon}
                  <span>{item.name}</span>
                </button>
              );
            }
            return (
              <Link
                key={item.path + item.name}
                href={item.path}
                onClick={() => setMore(false)}
                className={clsx(active(item.path) && 'arc-selected')}
              >
                {item.icon}
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      ) : null}
      <nav className="mobile-tabbar" aria-label="Primary">
        {tabs.map((item) =>
          item.onClick ? (
            <button key={item.name} type="button" onClick={item.onClick}>
              {item.icon}
              <span>{item.name}</span>
            </button>
          ) : (
            <Link
              key={item.path + item.name}
              href={item.path}
              className={clsx(active(item.path) && 'arc-selected')}
              aria-current={active(item.path) ? 'page' : undefined}
            >
              {item.icon}
              <span>{item.name}</span>
            </Link>
          )
        )}
        {showMore ? (
          <button
            type="button"
            className={clsx((more || moreActive) && 'arc-selected')}
            aria-expanded={more}
            aria-current={moreActive ? 'page' : undefined}
            aria-label="More"
            onClick={() => setMore((value) => !value)}
          >
            <HugeIcon name="more" size={18} />
            <span>More</span>
          </button>
        ) : null}
      </nav>
    </div>
  );
};
