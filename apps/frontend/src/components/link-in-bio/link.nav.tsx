'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const Icon = ({ children }: { children: ReactNode }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
    {children}
  </svg>
);

export const linkNavLinks = [
  {
    label: 'Editor',
    path: '/link',
    icon: (
      <Icon>
        <path d="M4 7h16M4 12h10M4 17h16" />
      </Icon>
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
  },
  {
    label: 'Analytics',
    path: '/link/analytics',
    icon: (
      <Icon>
        <path d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-3" />
      </Icon>
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
  },
];

const active = (pathname: string, path: string) =>
  path === '/link' ? pathname === '/link' : pathname.startsWith(path);

export const LinkTopNav = () => {
  const pathname = usePathname() || '';
  return (
    <nav className="hidden min-w-0 flex-1 items-center gap-[4px] overflow-x-auto lg:flex" aria-label="Link-in-Bio">
      {linkNavLinks.map((item) => (
        <Link
          key={item.path}
          href={item.path}
          className={clsx(
            'inline-flex min-h-[36px] items-center gap-[6px] whitespace-nowrap rounded-[18px] border px-[12px] text-[14px] font-[500]',
            active(pathname, item.path)
              ? 'border-newBorder bg-newBoxHover text-newTextColor'
              : 'border-transparent text-textItemBlur hover:text-newTextColor'
          )}
          aria-current={active(pathname, item.path) ? 'page' : undefined}
        >
          {active(pathname, item.path) ? (
            <span className="h-[6px] w-[6px] rounded-full bg-forth" />
          ) : null}
          {item.label}
        </Link>
      ))}
    </nav>
  );
};
