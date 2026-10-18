'use client';

import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { stkMenu, stkMenuItem } from '@gitroom/frontend/components/stalker/stalker.chrome';
import { chooseVisibleTabs, pill } from '@gitroom/frontend/components/layout/nav.pill';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';

type LinkNavItem = {
  label: string;
  path: string;
  icon: ReactNode;
  tabIcon?: ReactNode;
};

const links: LinkNavItem[] = [
  {
    label: 'Editor',
    path: '/link',
    icon: <HugeIcon name="pencil" size={18} />,
    tabIcon: <HugeIcon name="pencil" size={18} />,
  },
  {
    label: 'Appearance',
    path: '/link/appearance',
    icon: <HugeIcon name="palette" size={18} />,
    tabIcon: <HugeIcon name="palette" size={18} />,
  },
  {
    label: 'Settings',
    path: '/link/settings',
    icon: <HugeIcon name="settings" size={18} />,
    tabIcon: <HugeIcon name="settings" size={18} />,
  },
  {
    label: 'Analytics',
    path: '/link/analytics',
    icon: <HugeIcon name="chart" size={18} />,
    tabIcon: <HugeIcon name="chart" size={18} />,
  },
  {
    label: 'Leads',
    path: '/link/leads',
    icon: <HugeIcon name="mail" size={18} />,
    tabIcon: <HugeIcon name="mail" size={18} />,
  },
];

const isActive = (pathname: string, path: string) =>
  path === '/link' ? pathname === '/link' : pathname.startsWith(path);

export const linkNavLinks = links;

export const LinkTopNav = () => {
  const pathname = usePathname() || '';
  const [moreOpen, setMoreOpen] = useState(false);
  const [visible, setVisible] = useState<number[]>(links.map((_, index) => index));
  const moreMenu = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!moreMenu.current?.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const activeIndex = links.findIndex((link) => isActive(pathname, link.path));

  useLayoutEffect(() => {
    const nav = navRef.current;
    const measure = measureRef.current;
    if (!nav || !measure) {
      return;
    }
    let frame = 0;
    let attempts = 0;
    const fit = () => {
      const tabs = Array.from(measure.querySelectorAll<HTMLElement>('[data-tab]'));
      const more = measure.querySelector<HTMLElement>('[data-more]');
      const widths = tabs.map((tab) => tab.offsetWidth);
      if (!widths.length || widths.some((width) => width < 8)) {
        if (attempts < 8) {
          attempts += 1;
          frame = requestAnimationFrame(fit);
        }
        return;
      }
      const next = chooseVisibleTabs(
        widths,
        Math.max(0, nav.clientWidth - 2),
        activeIndex,
        more?.offsetWidth || 72
      );
      setVisible((current) =>
        current.length === next.length && current.every((value, index) => value === next[index])
          ? current
          : next
      );
    };
    const observer = new ResizeObserver(fit);
    observer.observe(nav);
    fit();
    const fonts = document.fonts?.ready.then(() => fit());
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      void fonts;
    };
  }, [activeIndex, pathname]);

  return (
    <nav
      ref={navRef}
      className="desktop-nav relative flex min-w-0 flex-1 items-center gap-[2px]"
      aria-label="Link-in-Bio"
    >
      <div
        ref={measureRef}
        className="pointer-events-none invisible absolute left-0 top-0 flex w-max items-center gap-[2px]"
        aria-hidden
      >
        {links.map((link) => (
          <span key={link.path} data-tab className="inline-flex items-center">
            <span className={pill(false)}>
              <span className="max-[1439px]:hidden">{link.icon}</span>
              <span>{link.label}</span>
            </span>
          </span>
        ))}
        <span data-more className={pill(false)}>
          More
          <HugeIcon name="chevron-down" size={16} />
        </span>
      </div>
      {links.map((link, index) => {
        if (!visible.includes(index)) {
          return null;
        }
        const active = isActive(pathname, link.path);
        return (
          <Link key={link.path} href={link.path} prefetch className={pill(active)} aria-current={active ? 'page' : undefined}>
            <span className="max-[1439px]:hidden">{link.icon}</span>
            <span>{link.label}</span>
          </Link>
        );
      })}
      {visible.length < links.length ? (
        <div className="relative" ref={moreMenu}>
          <button
            type="button"
            className={pill(false)}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((value) => !value)}
          >
            More
            <HugeIcon name="chevron-down" size={16} />
          </button>
          {moreOpen ? (
            <div role="menu" className={`${stkMenu} absolute end-0 top-[calc(100%+8px)] w-[200px]`}>
              {links.map((link, index) => {
                if (visible.includes(index)) {
                  return null;
                }
                return (
                  <Link
                    key={link.path}
                    href={link.path}
                    prefetch={false}
                    role="menuitem"
                    className={stkMenuItem}
                    onClick={() => setMoreOpen(false)}
                  >
                    {link.icon}
                    {link.label}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
};
