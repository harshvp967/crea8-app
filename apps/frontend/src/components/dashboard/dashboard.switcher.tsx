'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { useVariables } from '@gitroom/react/helpers/variable.context';

// Add a future dashboard by appending an item and a flag check.
// Schedule is always on. Stalker is on only when STALKER_ENABLED=true.
export const DASHBOARDS = [
  {
    id: 'schedule',
    label: 'Schedule',
    href: '/launches',
  },
  {
    id: 'stalker',
    label: 'Stalker',
    href: '/stalker/mentions',
  },
] as const;

export const DashboardSwitcher = () => {
  const pathname = usePathname() || '';
  const { stalkerEnabled } = useVariables();
  if (!stalkerEnabled) {
    return null;
  }

  const active = pathname.startsWith('/stalker') ? 'stalker' : 'schedule';

  return (
    <nav
      aria-label="Dashboards"
      className="flex items-center rounded-full border border-[#2a2a2a] bg-[#141414] p-[3px] shrink-0"
    >
      {DASHBOARDS.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={clsx(
            'rounded-full px-[12px] py-[6px] text-[13px] font-[600]',
            active === item.id
              ? 'bg-[#00D9FF] text-[#050304]'
              : 'text-[#b0b0b0] hover:text-white'
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
};
