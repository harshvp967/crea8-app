'use client';

import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useStalkerProject } from '@gitroom/frontend/components/stalker/stalker.project';
import { stkMenu, stkMenuItem } from '@gitroom/frontend/components/stalker/stalker.chrome';
import { chooseVisibleTabs, pill } from '@gitroom/frontend/components/layout/nav.pill';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';

type StalkerLink = {
  label: string;
  path: string;
  icon: ReactNode;
  tabIcon?: ReactNode;
};

const links: StalkerLink[] = [
  {
    label: 'Mentions',
    path: '/stalker/mentions',
    icon: <HugeIcon name="at" size={18} />,
    tabIcon: <HugeIcon name="at" size={18} />,
  },
  {
    label: 'Analytics',
    path: '/stalker/analytics',
    icon: <HugeIcon name="chart" size={18} />,
    tabIcon: <HugeIcon name="chart" size={18} />,
  },
  {
    label: 'Keywords',
    path: '/stalker/keywords',
    icon: <HugeIcon name="hashtag" size={18} />,
    tabIcon: <HugeIcon name="hashtag" size={18} />,
  },
  {
    label: 'Alerts',
    path: '/stalker/alerts',
    icon: <HugeIcon name="bell" size={18} />,
    tabIcon: <HugeIcon name="bell" size={18} />,
  },
  {
    label: 'API',
    path: '/stalker/api',
    icon: <HugeIcon name="code" size={18} />,
    tabIcon: <HugeIcon name="code" size={18} />,
  },
  {
    label: 'Settings',
    path: '/stalker/settings',
    icon: <HugeIcon name="settings" size={18} />,
    tabIcon: <HugeIcon name="settings" size={18} />,
  },
];

export const stalkerNavLinks = links;

export const StalkerProjectMenu = ({ onPick }: { onPick?: () => void }) => {
  const { projects, project, setProjectId, setShowWizard } = useStalkerProject();
  return (
    <>
      <p className="stk-proj-label">Projects</p>
      <ul className="stk-proj-list">
        {projects.map((item) => {
          const active = item.id === project?.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`${stkMenuItem} stk-proj-item`}
                onClick={() => {
                  setProjectId(item.id);
                  onPick?.();
                }}
              >
                <span
                  className="h-[8px] w-[8px] shrink-0 rounded-full"
                  style={{ backgroundColor: item.color || '#71717a' }}
                />
                <span className="stk-proj-name">{item.name}</span>
                {active ? (
                  <HugeIcon name="check" size={16} className="stk-proj-check" aria-label="Active" />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className={`${stkMenuItem} stk-proj-create`}
        onClick={() => {
          onPick?.();
          setShowWizard(true);
        }}
      >
        <HugeIcon name="plus" size={16} />
        Create project
      </button>
    </>
  );
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
  const { project, loading, requestAddKeyword, sample } = useStalkerProject();
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

  if (!force && !sample && (!stalkerEnabled || !pathname.startsWith('/stalker'))) {
    return null;
  }

  return (
    <div className="stk-top flex min-w-0 flex-1 items-center gap-[6px]">
      <div className="stk-project relative shrink-0" ref={menu}>
        <button
          type="button"
          className="flex h-[38px] max-w-[160px] items-center gap-[8px] rounded-[16px] border border-newBorder bg-newBgColorInner px-[12px] text-[14px] font-[500] min-[1200px]:max-w-[180px]"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span
            className="h-[8px] w-[8px] shrink-0 rounded-full"
            style={{ backgroundColor: project?.color || '#71717a' }}
          />
          {loading && !project ? (
            <span className="inline-block h-[14px] w-[88px] animate-pulse rounded-full bg-newBoxHover" />
          ) : (
            <span className="truncate">{project?.name || 'New project'}</span>
          )}
          <HugeIcon name="chevron-down" size={16} className="text-textItemBlur" />
        </button>
        {open ? (
          <div className={`${stkMenu} stk-proj-menu absolute start-0 top-[calc(100%+8px)] overflow-hidden`} role="listbox">
            <StalkerProjectMenu onPick={() => setOpen(false)} />
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
              {link.path === '/stalker/keywords' ? <span className="stk-add ms-[2px]" /> : null}
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
                  className="arc-icon-btn stk-add ms-[2px] rounded-[14px] border border-newBorder text-[18px]"
                  onClick={() => requestAddKeyword()}
                >
                  <HugeIcon name="plus" size={18} />
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
              More
              <HugeIcon name="chevron-down" size={16} />
            </button>
            {moreOpen ? (
              <div
                role="menu"
                className={`${stkMenu} absolute end-0 top-[calc(100%+8px)] w-[200px]`}
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
    </div>
  );
};
