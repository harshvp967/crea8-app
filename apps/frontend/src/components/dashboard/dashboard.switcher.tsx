'use client';

import { usePathname } from 'next/navigation';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { SegmentedControl } from '@gitroom/frontend/components/ui/segmented-control';

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
    <SegmentedControl
      aria-label="Dashboards"
      size="sm"
      className="shrink-0"
      value={active}
      options={DASHBOARDS.map((item) => ({
        value: item.id,
        label: item.label,
        href: item.href,
      }))}
    />
  );
};
