'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
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
    'inline-flex items-center gap-[8px] whitespace-nowrap rounded-full border px-[14px] py-[8px] text-[14px] font-[600] transition-colors',
    active
      ? 'border-[#00D9FF]/45 bg-[#00D9FF]/10 text-newTextColor'
      : 'border-transparent text-textItemBlur hover:border-newBorder hover:bg-newBoxHover hover:text-newTextColor'
  );

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
    setProjectId,
    setShowWizard,
    requestAddKeyword,
    sample,
  } = useStalkerProject();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!menu.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (!force && !sample && (!stalkerEnabled || !pathname.startsWith('/stalker'))) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-[10px]">
      <div className="relative shrink-0" ref={menu}>
        <button
          type="button"
          className="flex max-w-[220px] items-center gap-[8px] rounded-full border border-newBorder bg-newBgColorInner px-[12px] py-[8px] text-[13px] font-[600]"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span
            className="h-[10px] w-[10px] shrink-0 rounded-full border border-black/10"
            style={{ backgroundColor: project?.color || '#71717a' }}
          />
          <span className="truncate">{project?.name || 'No project'}</span>
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
                        <span className="text-[13px] text-[#00A3C4]" aria-label="Active">
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
        className="flex min-w-0 flex-1 items-center gap-[4px] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Stalker"
      >
        {links.map((link) => {
          const href = `${base}${link.path.replace('/stalker', '')}`;
          const active = pathname.startsWith(href);
          if (link.path === '/stalker/keywords') {
            return (
              <span key={link.path} className="inline-flex items-center">
                <Link href={href} className={pill(active)}>
                  {link.icon}
                  <span>{link.label}</span>
                </Link>
                <button
                  type="button"
                  aria-label="Add keyword"
                  className="ms-[2px] flex h-[28px] w-[28px] items-center justify-center rounded-full border border-newBorder text-[16px] text-textItemBlur hover:border-[#00D9FF]/40 hover:text-newTextColor"
                  onClick={() => requestAddKeyword()}
                >
                  +
                </button>
              </span>
            );
          }
          return (
            <Link key={link.path} href={href} className={pill(active)}>
              {link.icon}
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
