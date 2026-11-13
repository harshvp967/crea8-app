'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { SegmentedControl } from '@gitroom/frontend/components/ui/segmented-control';
import {
  CalendarIcon,
  LinkIcon,
  StalkerIcon,
} from '@gitroom/frontend/components/ui/icons';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import type { HugeIconName } from '@gitroom/frontend/components/icons/hugeicons/paths';

// Add a future dashboard by appending an item and a flag check.
// Schedule and Link-in-Bio are always on. Stalker is on only when STALKER_ENABLED=true.
// `icon` and `tile` match the sidebar app rail (calendar / eye / link).
export const DASHBOARDS = [
  {
    id: 'schedule',
    label: 'Schedule',
    href: '/schedule',
    Icon: CalendarIcon,
    icon: 'calendar' as HugeIconName,
    tile: 'is-schedule',
  },
  {
    id: 'link',
    label: 'Link-in-Bio',
    href: '/linkinbio',
    Icon: LinkIcon,
    icon: 'link' as HugeIconName,
    tile: 'is-link',
  },
  {
    id: 'stalker',
    label: 'Stalker',
    href: '/stalker/mentions',
    Icon: StalkerIcon,
    icon: 'eye' as HugeIconName,
    tile: 'is-stalker',
  },
] as const;

const ProductMark = ({
  icon,
  tile,
}: {
  icon: HugeIconName;
  tile: string;
}) => (
  <span className={clsx('dash-mswitch-mark', tile)} aria-hidden>
    <HugeIcon name={icon} size={16} />
  </span>
);

export const DashboardSwitcher = () => {
  const pathname = usePathname() || '';
  const { stalkerEnabled } = useVariables();
  const [open, setOpen] = useState(false);
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(false);
  }
  const items = DASHBOARDS.filter((item) => item.id !== 'stalker' || stalkerEnabled);
  if (items.length < 2) {
    return null;
  }

  const active = pathname.startsWith('/stalker')
    ? 'stalker'
    : pathname === '/linkinbio' || pathname.startsWith('/linkinbio/') || pathname === '/link' || pathname.startsWith('/link/')
    ? 'link'
    : 'schedule';
  const current = items.find((item) => item.id === active) || items[0];

  return (
    <>
      {open ? (
        <div
          className="sheet-backdrop"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }}
        />
      ) : null}
      <div className={clsx('dash-mswitch', open && 'is-open')}>
        <button
          type="button"
          className="dash-mswitch-btn"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <ProductMark icon={current.icon} tile={current.tile} />
          {current.label}
          <HugeIcon name="chevron-down" size={16} />
        </button>
        {open ? (
          <div className="arc-menu dash-mswitch-menu" role="menu">
            {items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                role="menuitem"
                className={item.id === active ? 'arc-selected' : undefined}
                onClick={() => setOpen(false)}
              >
                <ProductMark icon={item.icon} tile={item.tile} />
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
          compactBelow1440={items.length > 2}
          value={active}
          options={items.map((item) => ({
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
