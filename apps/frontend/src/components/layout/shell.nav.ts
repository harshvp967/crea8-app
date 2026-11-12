import type { HugeIconName } from '@gitroom/frontend/components/icons/hugeicons/paths';

type NamedNav = {
  icon: HugeIconName;
  path: string;
  name: string;
};

type TranslatedNav = {
  icon: HugeIconName;
  path: string;
  labelKey: string;
  fallback: string;
  otherFallback?: string;
};

export type PrimaryNavItem = NamedNav | TranslatedNav;

// Schedule shell items. The sidebar, the header menu, and the loading shell
// all read this list. Composer is inserted after the first item by insertComposer.
export const primaryNav: readonly PrimaryNavItem[] = [
  {
    icon: 'calendar',
    path: '/launches',
    labelKey: 'calendar',
    fallback: 'Calendar',
    otherFallback: 'Launches',
  },
  { icon: 'agent', path: '/agents', name: 'Agent' },
  {
    icon: 'analytics',
    path: '/analytics',
    labelKey: 'analytics',
    fallback: 'Analytics',
  },
  { icon: 'media', path: '/media', labelKey: 'media', fallback: 'Media' },
  { icon: 'plug', path: '/plugs', labelKey: 'plugs', fallback: 'Plugs' },
  {
    icon: 'puzzle',
    path: '/third-party',
    labelKey: 'integrations',
    fallback: 'Integrations',
  },
];

export function primaryNavNames(isGeneral = true): string[] {
  return primaryNav.map((item) => {
    if ('name' in item) {
      return item.name;
    }
    if (!isGeneral && item.otherFallback) {
      return item.otherFallback;
    }
    return item.fallback;
  });
}

export function insertComposer<T>(primary: readonly T[], composer: T): T[] {
  return [...primary.slice(0, 1), composer, ...primary.slice(1)];
}

// Loading shell nav. Same items and order as the live Schedule sidebar.
export function shellSkeletonNavNames(isGeneral = true): string[] {
  return insertComposer(primaryNavNames(isGeneral), 'Composer');
}
