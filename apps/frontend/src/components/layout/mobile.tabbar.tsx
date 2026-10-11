'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { useMenuItem, useVisibleMenuItems } from '@gitroom/frontend/components/layout/top.menu';
import { stalkerNavLinks } from '@gitroom/frontend/components/stalker/stalker.nav';

export const MobileTabBar = () => {
  const pathname = (usePathname() || '').replace(/^\/stalker-preview/, '/stalker');
  const stalker = pathname.startsWith('/stalker');
  const { firstMenu, secondMenu } = useMenuItem();
  const primary = useVisibleMenuItems(firstMenu);
  const extra = useVisibleMenuItems(secondMenu);
  const [more, setMore] = useState(false);

  useEffect(() => {
    setMore(false);
  }, [pathname]);

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

  const tabs = (stalker ? stalkerNavLinks.slice(0, 4) : primary.slice(0, 4)).map(asItem);
  const overflow = (stalker ? stalkerNavLinks.slice(4) : [...primary.slice(4), ...extra]).map(
    asItem
  );

  const active = (path: string) => path !== '#' && pathname.indexOf(path) === 0;
  const moreActive = !tabs.some((item) => active(item.path));

  return (
    <div className="contents">
      {more ? (
        <div
          className="sheet-backdrop"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setMore(false);
          }}
        />
      ) : null}
      {more ? (
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
        {tabs.map((item) => (
          <Link
            key={item.path + item.name}
            href={item.path}
            className={clsx(active(item.path) && 'arc-selected')}
            aria-current={active(item.path) ? 'page' : undefined}
          >
            {item.icon}
            <span>{item.name}</span>
          </Link>
        ))}
        <button
          type="button"
          className={clsx((more || moreActive) && 'arc-selected')}
          aria-expanded={more}
          aria-current={moreActive ? 'page' : undefined}
          aria-label="More"
          onClick={() => setMore((value) => !value)}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden>
            <circle cx="3.5" cy="9" r="1.35" />
            <circle cx="9" cy="9" r="1.35" />
            <circle cx="14.5" cy="9" r="1.35" />
          </svg>
          <span>More</span>
        </button>
      </nav>
    </div>
  );
};
