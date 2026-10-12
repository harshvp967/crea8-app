'use client';

import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { stkMenu, stkMenuItem } from '@gitroom/frontend/components/stalker/stalker.chrome';
import { chooseVisibleTabs, pill } from '@gitroom/frontend/components/layout/nav.pill';

const Icon = ({ children }: { children: ReactNode }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    aria-hidden
  >
    {children}
  </svg>
);

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
    icon: (
      <Icon>
        <path d="M4 7h16M4 12h10M4 17h16" />
      </Icon>
    ),
    tabIcon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M4 20h4l10.5-10.5a2.1 2.1 0 00-3-3L5 17v3z" />
        <path d="M13.5 6.5l3 3" />
      </svg>
    ),
  },
  {
    label: 'Appearance',
    path: '/link/appearance',
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
      </Icon>
    ),
    tabIcon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M12 3a9 9 0 100 18h1.2a1.8 1.8 0 001.8-1.8 1.4 1.4 0 011.4-1.4H19a2 2 0 002-2A9 9 0 0012 3z" />
        <circle cx="7.5" cy="10" r="1" fill="currentColor" />
        <circle cx="10.5" cy="7.2" r="1" fill="currentColor" />
        <circle cx="14.2" cy="7.2" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: 'Analytics',
    path: '/link/analytics',
    icon: (
      <Icon>
        <path d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-3" />
      </Icon>
    ),
    tabIcon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden>
        <rect x="1.5" y="9" width="3.2" height="7" rx="0.8" />
        <rect x="7.4" y="5" width="3.2" height="11" rx="0.8" />
        <rect x="13.3" y="2" width="3.2" height="14" rx="0.8" />
      </svg>
    ),
  },
  {
    label: 'Leads',
    path: '/link/leads',
    icon: (
      <Icon>
        <path d="M4 6h16v12H4zM4 10h16" />
      </Icon>
    ),
    tabIcon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M4 7h16v10H4z" />
        <path d="M4 7l8 7 8-7" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    path: '/link/settings',
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M18.5 5.5l-1.4 1.4M6.9 17.1l-1.4 1.4" />
      </Icon>
    ),
    tabIcon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M18.5 5.5l-1.4 1.4M6.9 17.1l-1.4 1.4" />
      </svg>
    ),
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
          More ▾
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
            More ▾
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
