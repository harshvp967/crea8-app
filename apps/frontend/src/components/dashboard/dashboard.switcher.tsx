'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { SegmentedControl } from '@gitroom/frontend/components/ui/segmented-control';
import {
  CalendarIcon,
  StalkerIcon,
} from '@gitroom/frontend/components/ui/icons';

// Add a future dashboard by appending an item and a flag check.
// Schedule is always on. Stalker is on only when STALKER_ENABLED=true.
export const DASHBOARDS = [
  {
    id: 'schedule',
    label: 'Schedule',
    href: '/launches',
    Icon: CalendarIcon,
  },
  {
    id: 'stalker',
    label: 'Stalker',
    href: '/stalker/mentions',
    Icon: StalkerIcon,
  },
] as const;

export const DashboardSwitcher = () => {
  const pathname = usePathname() || '';
  const { stalkerEnabled } = useVariables();
  const [open, setOpen] = useState(false);
  if (!stalkerEnabled) {
    return null;
  }

  const active = pathname.startsWith('/stalker') ? 'stalker' : 'schedule';
  const current = DASHBOARDS.find((item) => item.id === active) || DASHBOARDS[0];

  return (
    <>
      <div className="dash-mswitch">
        <button
          type="button"
          className="dash-mswitch-btn"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {current.label}
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <path d="M2 3.5 L5 6.5 L8 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
        {open ? (
          <div className="arc-menu dash-mswitch-menu" role="menu">
            {DASHBOARDS.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                role="menuitem"
                className={item.id === active ? 'arc-selected' : undefined}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
      <div className="dash-seg">
        <SegmentedControl
          aria-label="Dashboards"
          size="sm"
          className="shrink-0"
          compactBelow1440={pathname.startsWith('/stalker')}
          value={active}
          options={DASHBOARDS.map((item) => ({
            value: item.id,
            label: item.label,
            href: item.href,
            icon: <item.Icon />,
          }))}
        />
      </div>
    </>
  );
};
