'use client';

import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useStalkerProject } from '@gitroom/frontend/components/stalker/stalker.project';

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

const links = [
  {
    label: 'Mentions',
    path: '/stalker/mentions',
    icon: (
      <Icon>
        <path d="M5 6h14M5 12h14M5 18h9" />
      </Icon>
    ),
  },
  {
    label: 'Analytics',
    path: '/stalker/analytics',
    icon: (
      <Icon>
        <path d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-3" />
      </Icon>
    ),
  },
  {
    label: 'Keywords',
    path: '/stalker/keywords',
    icon: (
      <Icon>
        <path d="M5 9h6M5 15h10M15 7l4 4-4 4" />
      </Icon>
    ),
  },
  {
    label: 'Alerts',
    path: '/stalker/alerts',
    icon: (
      <Icon>
        <path d="M6 16h12l-1.2-2.2A6 6 0 0012 4a6 6 0 00-4.8 9.8L6 16zM10 18a2 2 0 004 0" />
      </Icon>
    ),
  },
  {
    label: 'API',
    path: '/stalker/api',
    icon: (
      <Icon>
        <path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13 6l-2 12" />
      </Icon>
    ),
  },
  {
    label: 'Settings',
    path: '/stalker/settings',
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
      </Icon>
    ),
  },
];

const pill = (active: boolean) =>
  clsx(
    'inline-flex items-center gap-[6px] whitespace-nowrap rounded-[18px] border px-[12px] min-h-[36px] text-[14px] font-[500] transition-colors',
    active
      ? 'arc-selected'
      : 'border-transparent text-textItemBlur hover:border-newBorder hover:bg-newBoxHover hover:text-newTextColor'
  );

export const stalkerNavLinks = links;

const chooseVisibleTabs = (
  widths: number[],
  available: number,
  activeIndex: number,
  moreWidth: number
) => {
  const gap = 2;
  const sum = (indexes: number[]) =>
    indexes.reduce((total, index) => total + widths[index], 0) +
    Math.max(0, indexes.length - 1) * gap;
  const all = widths.map((_, index) => index);
  if (sum(all) <= available) {
    return all;
  }
  const room = Math.max(0, available - moreWidth - gap);
  const chosen: number[] = [];
  for (let index = 0; index < widths.length; index += 1) {
    const next = [...chosen, index];
    const pending =
      activeIndex > index && !next.includes(activeIndex) ? widths[activeIndex] + gap : 0;
    if (sum(next) + pending <= room) {
      chosen.push(index);
    }
  }
  if (activeIndex >= 0 && !chosen.includes(activeIndex)) {
    const without = [...chosen];
    while (without.length && sum(without) + widths[activeIndex] + gap > room) {
      without.pop();
    }
    without.push(activeIndex);
    return without;
  }
  return chosen;
};

export const StalkerTopNav = ({
  force = false,
  base = '/stalker',
}: {
  force?: boolean;
  base?: string;
}) => {
  const pathname = usePathname() || '';
  const { stalkerEnabled } = useVariables();
  const {
    projects,
    project,
    loading,
    setProjectId,
    setShowWizard,
    requestAddKeyword,
    sample,
  } = useStalkerProject();
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [visible, setVisible] = useState<number[]>(links.map((_, index) => index));
  const menu = useRef<HTMLDivElement>(null);
  const moreMenu = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!menu.current?.contains(event.target as Node)) {
        setOpen(false);
      }
      if (!moreMenu.current?.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const activeIndex = links.findIndex((link) => {
    const href = `${base}${link.path.replace('/stalker', '')}`;
    return pathname.startsWith(href);
  });

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
        nav.clientWidth,
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

  if (!force && !sample && (!stalkerEnabled || !pathname.startsWith('/stalker'))) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-[10px]">
      <div className="relative shrink-0" ref={menu}>
        <button
          type="button"
          className="flex max-w-[128px] items-center gap-[8px] rounded-full border border-newBorder bg-newBgColorInner px-[12px] py-[7px] text-[13px] font-[600] min-[1440px]:max-w-[160px]"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span
            className="h-[10px] w-[10px] shrink-0 rounded-full border border-black/10"
            style={{ backgroundColor: project?.color || '#71717a' }}
          />
          {loading && !project ? (
            <span className="inline-block h-[14px] w-[88px] animate-pulse rounded-full bg-newBoxHover" />
          ) : (
            <span className="truncate">{project?.name || 'New project'}</span>
          )}
          <span className="text-textItemBlur" aria-hidden>
            ▾
          </span>
        </button>
        {open ? (
          <div className="absolute start-0 top-[calc(100%+8px)] z-30 w-[260px] overflow-hidden rounded-[16px] border border-newBorder bg-newBgColorInner shadow-[var(--menu-shadow)]">
            <ul className="max-h-[280px] overflow-auto p-[6px]" role="listbox">
              {projects.map((item) => {
                const active = item.id === project?.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-[10px] rounded-[12px] px-[10px] py-[8px] text-start hover:bg-newBoxHover"
                      onClick={() => {
                        setProjectId(item.id);
                        setOpen(false);
                      }}
                    >
                      <span
                        className="mt-[4px] h-[10px] w-[10px] shrink-0 rounded-full"
                        style={{ backgroundColor: item.color || '#71717a' }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-[600]">
                          {item.name}
                        </span>
                        {item.description ? (
                          <span className="block truncate text-[12px] text-textItemBlur">
                            {item.description}
                          </span>
                        ) : null}
                      </span>
                      {active ? (
                        <span className="text-[13px] text-[color:var(--arc-accent)]" aria-label="Active">
                          ✓
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              className="flex w-full items-center gap-[8px] border-t border-newBorder px-[16px] py-[12px] text-[13px] font-[600] hover:bg-newBoxHover"
              onClick={() => {
                setOpen(false);
                setShowWizard(true);
              }}
            >
              <span className="text-textItemBlur">+</span> New project
            </button>
          </div>
        ) : null}
      </div>
      <nav
        ref={navRef}
        className="desktop-nav relative flex min-w-0 flex-1 items-center gap-[2px]"
        aria-label="Stalker"
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
              {link.path === '/stalker/keywords' ? (
                <span className="ms-[2px] flex h-[28px] w-[28px]" />
              ) : null}
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
          const href = `${base}${link.path.replace('/stalker', '')}`;
          const active = pathname.startsWith(href);
          if (link.path === '/stalker/keywords') {
            return (
              <span key={link.path} className="inline-flex items-center">
                <Link href={href} prefetch className={pill(active)}>
                  <span className="max-[1439px]:hidden">{link.icon}</span>
                  <span>{link.label}</span>
                </Link>
                <button
                  type="button"
                  aria-label="Add keyword"
                  className="ms-[2px] flex h-[28px] w-[28px] items-center justify-center rounded-[14px] border border-newBorder text-[16px] text-textItemBlur hover:border-[color:var(--arc-selected-border)] hover:text-newTextColor"
                  onClick={() => requestAddKeyword()}
                >
                  +
                </button>
              </span>
            );
          }
          return (
            <Link key={link.path} href={href} prefetch className={pill(active)}>
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
              <div
                role="menu"
                className="absolute end-0 top-[calc(100%+8px)] z-30 w-[180px] rounded-[14px] border border-newBorder bg-newBgColorInner p-[6px] shadow-[var(--menu-shadow)]"
              >
                {links.map((link, index) => {
                  if (visible.includes(index)) {
                    return null;
                  }
                  const href = `${base}${link.path.replace('/stalker', '')}`;
                  return (
                    <Link
                      key={link.path}
                      href={href}
                      prefetch={false}
                      role="menuitem"
                      className="flex items-center gap-[8px] rounded-[10px] px-[10px] py-[8px] text-[13px] font-[600] hover:bg-newBoxHover"
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
    </div>
  );
};
