'use client';

import { FC, ReactNode, useCallback } from 'react';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { MenuItem } from '@gitroom/frontend/components/new-layout/menu-item';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { AgentMediaModal } from '@gitroom/frontend/components/layout/agent.media.modal';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { primaryNav } from '@gitroom/frontend/components/layout/shell.nav';

/** Schedule and phone nav. Set true to show the UGC item again. */
export const ugcNavEnabled = false;

interface MenuItemInterface {
  name: string;
  icon: ReactNode;
  path: string;
  role?: string[];
  hide?: boolean;
  requireBilling?: boolean;
  onClick?: () => void;
}

export const useMenuItem = () => {
  const { isGeneral } = useVariables();
  const t = useT();
  const { openModal } = useModals();

  const handleAgentMediaClick = useCallback(() => {
    openModal({
      title: t('agent_media_title', 'UGC videos by AgentMedia'),
      closeOnClickOutside: true,
      closeOnEscape: true,
      children: <AgentMediaModal />,
    });
  }, [openModal, t]);

  const firstMenu = primaryNav.map((item) => ({
    name:
      'name' in item
        ? item.name
        : item.otherFallback
          ? isGeneral
            ? t(item.labelKey, item.fallback)
            : t('launches', item.otherFallback)
          : t(item.labelKey, item.fallback),
    icon: <HugeIcon name={item.icon} size={18} />,
    path: item.path,
  })) satisfies MenuItemInterface[] as MenuItemInterface[];

  const secondMenu = [
    {
      name: t('UGC', 'UGC'),
      icon: <HugeIcon name="ugc" size={18} />,
      path: '#',
      role: ['ADMIN', 'SUPERADMIN', 'USER'],
      requireBilling: true,
      hide: !ugcNavEnabled,
      onClick: handleAgentMediaClick,
    },
    {
      name: t('settings', 'Settings'),
      icon: <HugeIcon name="settings" size={18} />,
      path: '/account',
      role: ['ADMIN', 'USER', 'SUPERADMIN'],
    },
  ] satisfies MenuItemInterface[] as MenuItemInterface[];

  return {
    all: [...firstMenu, ...secondMenu],
    firstMenu,
    secondMenu,
  };
};

export const useVisibleMenuItems = (
  items: MenuItemInterface[],
  options?: { excludeSettings?: boolean }
) => {
  const user = useUser();
  const { isGeneral, billingEnabled } = useVariables();

  return items.filter((f) => {
    if (options?.excludeSettings && f.path === '/account') {
      return false;
    }
    if (f.hide) {
      return false;
    }
    if (f.requireBilling && !billingEnabled) {
      return false;
    }
    if (f.name === 'Billing' && user?.isLifetime) {
      return false;
    }
    if (f.role) {
      return f.role.includes(user?.role!);
    }
    return true;
  });
};

/** Primary top navigation: Calendar, Agent, Analytics, Media, Plugs, Integrations */
export const TopMenu: FC = () => {
  const user = useUser();
  const { firstMenu } = useMenuItem();
  const { isGeneral, billingEnabled } = useVariables();
  const visible = useVisibleMenuItems(firstMenu);

  // @ts-ignore
  if (!user?.orgId) return null;
  // @ts-ignore
  if (user.tier === 'FREE' && isGeneral && billingEnabled) return null;

  return (
    <nav
      className="desktop-nav flex flex-1 items-center gap-[4px] min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Main"
    >
      {visible.map((item) => (
        <MenuItem
          path={item.path}
          label={item.name}
          icon={item.icon}
          key={item.name}
          onClick={item.onClick}
          variant="horizontal"
        />
      ))}
    </nav>
  );
};

/**
 * Secondary items outside the primary pills. UGC stays in this list and is
 * hidden while ugcNavEnabled is false. Settings lives in the global header.
 */
export const TopMenuUtilities: FC = () => {
  const { secondMenu } = useMenuItem();
  const visible = useVisibleMenuItems(secondMenu, { excludeSettings: true });

  if (!visible.length) return null;

  return (
    <div className="desktop-utilities flex flex-col gap-[4px]">
      {visible.map((item) => (
        <MenuItem
          path={item.path}
          label={item.name}
          icon={item.icon}
          key={item.name}
          onClick={item.onClick}
          variant="utility"
        />
      ))}
    </div>
  );
};

/** Account settings. The /settings URL stays the GitHub and OIDC callback. */
export const SettingsMenuItem: FC<{
  collapsed?: boolean;
  variant?: 'sidebar' | 'utility' | 'header';
}> = ({ collapsed, variant = 'header' }) => {
  const { secondMenu } = useMenuItem();
  const settings = secondMenu.find((item) => item.path === '/account');
  const visible = useVisibleMenuItems(settings ? [settings] : []);
  const pathname = usePathname();

  if (!visible.length || !settings) return null;

  if (variant === 'header') {
    const isActive = pathname.indexOf(settings.path) === 0;
    return (
      <Link
        href={settings.path}
        title={settings.name}
        aria-label={settings.name}
        className={clsx(
          'flex items-center justify-center w-[38px] h-[38px] rounded-[14px] transition-colors shrink-0 [&_svg]:w-[18px] [&_svg]:h-[18px]',
          isActive
            ? 'arc-selected'
            : 'text-textItemBlur hover:text-[color:var(--arc-accent-text)] hover:bg-[var(--arc-selected)]'
        )}
      >
        {settings.icon}
      </Link>
    );
  }

  return (
    <div
      className={clsx(
        collapsed && variant === 'sidebar' && '[&_span]:hidden flex justify-center'
      )}
    >
      <MenuItem
        path={settings.path}
        label={settings.name}
        icon={settings.icon}
        variant={variant}
      />
    </div>
  );
};
