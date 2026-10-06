'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { MenuItem } from '@gitroom/frontend/components/new-layout/menu-item';
import {
  StalkerProjectProvider,
  useStalkerProject,
} from '@gitroom/frontend/components/stalker/stalker.project';
import { StalkerWizard } from '@gitroom/frontend/components/stalker/stalker.wizard';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

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
    labelKey: 'stalker_mentions',
    label: 'Mentions',
    path: '/stalker/mentions',
    icon: (
      <Icon>
        <path d="M5 6h14M5 12h14M5 18h9" />
      </Icon>
    ),
  },
  {
    labelKey: 'stalker_analytics',
    label: 'Analytics',
    path: '/stalker/analytics',
    icon: (
      <Icon>
        <path d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-3" />
      </Icon>
    ),
  },
  {
    labelKey: 'stalker_keywords',
    label: 'Keywords',
    path: '/stalker/keywords',
    icon: (
      <Icon>
        <path d="M7 7h6l4 4v6a2 2 0 01-2 2H7a2 2 0 01-2-2V9a2 2 0 012-2z" />
      </Icon>
    ),
  },
  {
    labelKey: 'stalker_alerts',
    label: 'Alerts',
    path: '/stalker/alerts',
    icon: (
      <Icon>
        <path d="M6 16h12l-1.2-2.2A6 6 0 0012 4a6 6 0 00-4.8 9.8L6 16zM10 18a2 2 0 004 0" />
      </Icon>
    ),
  },
  {
    labelKey: 'stalker_settings',
    label: 'Settings',
    path: '/stalker/settings',
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
      </Icon>
    ),
  },
  {
    labelKey: 'stalker_themes',
    label: 'Themes',
    path: '/stalker/themes',
    icon: (
      <Icon>
        <path d="M12 3a7 7 0 100 14h1.5a2 2 0 010 4H12" />
      </Icon>
    ),
  },
];

const StalkerBody = ({ children }: { children: ReactNode }) => {
  const t = useT();
  const {
    projects,
    project,
    setProjectId,
    loading,
    showWizard,
    setShowWizard,
  } = useStalkerProject();

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col md:flex-row">
      <aside className="flex shrink-0 gap-[8px] overflow-x-auto border-b border-newBorder bg-newBgColorInner p-[16px] md:w-[280px] md:flex-col md:gap-[15px] md:overflow-y-auto md:border-b-0 md:border-e md:p-[20px]">
        <div className="flex min-w-[200px] flex-col gap-[8px]">
          <label className="flex items-center gap-[8px] text-[13px]">
            <span
              className="h-[10px] w-[10px] shrink-0 rounded-full"
              style={{ backgroundColor: project?.color || '#00D9FF' }}
            />
            <select
              aria-label="Project"
              className="w-full rounded-[10px] border border-newBorder bg-newBgColorInner px-[8px] py-[8px] text-[13px] text-newTextColor outline-none"
              value={project?.id || ''}
              onChange={(event) => setProjectId(event.target.value)}
            >
              {!projects.length ? <option value="">No project</option> : null}
              {projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="self-start text-[13px] font-[600] text-[#00D9FF]"
            onClick={() => setShowWizard(true)}
          >
            + New project
          </button>
        </div>
        <nav className="flex min-w-0 flex-1 gap-[8px] md:flex-col" aria-label="Stalker">
          {links.map((link) =>
            link.path === '/stalker/keywords' ? (
              <div key={link.path} className="flex min-w-[160px] items-center gap-[6px] md:min-w-0">
                <div className="min-w-0 flex-1">
                  <MenuItem
                    variant="sidebar"
                    label={t(link.labelKey, link.label)}
                    path={link.path}
                    icon={link.icon}
                  />
                </div>
                <Link
                  href="/stalker/keywords#add-keyword"
                  aria-label="Add keyword"
                  className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full border border-newBorder text-[16px] text-textItemBlur hover:border-[#00D9FF]/40 hover:text-[#00D9FF]"
                >
                  +
                </Link>
              </div>
            ) : (
              <div key={link.path} className="min-w-[140px] md:min-w-0">
                <MenuItem
                  variant="sidebar"
                  label={t(link.labelKey, link.label)}
                  path={link.path}
                  icon={link.icon}
                />
              </div>
            )
          )}
        </nav>
      </aside>
      <main className="min-h-0 min-w-0 flex-1 overflow-auto bg-newBgColorInner p-[16px] md:p-[20px]">
        {loading ? (
          <div className="flex flex-col gap-[12px]" aria-hidden>
            <div className="h-[28px] w-[180px] animate-pulse rounded-[8px] bg-newBorder" />
            <div className="h-[88px] animate-pulse rounded-[16px] border border-newBorder" />
            <div className="h-[140px] animate-pulse rounded-[16px] border border-newBorder" />
          </div>
        ) : showWizard ? (
          <StalkerWizard />
        ) : (
          children
        )}
      </main>
    </div>
  );
};

export const StalkerShell = ({ children }: { children: ReactNode }) => {
  const t = useT();
  const { stalkerEnabled } = useVariables();

  if (!stalkerEnabled) {
    return (
      <div className="flex flex-1 items-center bg-newBgColorInner p-[32px] text-[15px] text-textItemBlur">
        {t(
          'stalker_disabled',
          'Stalker is turned off. Set STALKER_ENABLED=true on the frontend and the backend to open this dashboard.'
        )}
      </div>
    );
  }

  return (
    <StalkerProjectProvider>
      <StalkerBody>{children}</StalkerBody>
    </StalkerProjectProvider>
  );
};
