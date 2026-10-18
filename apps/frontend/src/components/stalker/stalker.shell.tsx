'use client';

import { ReactNode } from 'react';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useStalkerProject } from '@gitroom/frontend/components/stalker/stalker.project';
import { StalkerWizard } from '@gitroom/frontend/components/stalker/stalker.wizard';
import { stkEmpty, stkIconTile, stkPrimary } from '@gitroom/frontend/components/stalker/stalker.chrome';

const Welcome = ({ onCreate }: { onCreate: () => void }) => (
  <div className="stk-state-wrap flex flex-1 items-center justify-center px-[24px] py-[64px]">
    <div className={`${stkEmpty} stk-state`}>
      <span className={`${stkIconTile} stk-state-mark`} aria-hidden>
        <HugeIcon name="list" size={24} />
      </span>
      <h1 className="text-[16px] font-[600]">Welcome</h1>
      <p className="max-w-[360px] text-[14px] text-textItemBlur">
        Create a project to start listening for mentions of your brand.
      </p>
      <button type="button" className={`${stkPrimary} mt-[6px]`} onClick={onCreate}>
        Create your first project
      </button>
    </div>
  </div>
);

const PageSkeleton = () => (
  <div className="flex flex-col gap-[12px] p-[24px]" aria-hidden>
    <div className="stk-skel h-[22px] w-[180px] animate-pulse" />
    <div className="stk-skel h-[14px] w-[260px] animate-pulse" />
    <div className="stk-skel mt-[8px] h-[120px] animate-pulse" />
    <div className="stk-skel h-[120px] animate-pulse" />
  </div>
);

const StalkerBody = ({ children }: { children: ReactNode }) => {
  const { projects, projectId, loading, showWizard, setShowWizard, sample } =
    useStalkerProject();

  return (
    <div
      className={`stk-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border border-newBorder bg-newBgColorInner${
        sample ? '' : ' stalker-screen'
      }`}
    >
      <main className="min-h-0 min-w-0 flex-1 overflow-auto">
        {loading && !projectId ? (
          <PageSkeleton />
        ) : !loading && !projects.length ? (
          <Welcome onCreate={() => setShowWizard(true)} />
        ) : (
          children
        )}
      </main>
      {showWizard ? <StalkerWizard /> : null}
    </div>
  );
};

export const StalkerShell = ({ children }: { children: ReactNode }) => {
  const t = useT();
  const { stalkerEnabled } = useVariables();
  const project = useStalkerProject();

  if (!stalkerEnabled && !project.sample) {
    return (
      <div className="stalker-screen flex flex-1 items-center bg-newBgColorInner p-[32px] text-[15px] text-textItemBlur">
        {t(
          'stalker_disabled',
          'Stalker is turned off. Set STALKER_ENABLED=true on the frontend and the backend to open this dashboard.'
        )}
      </div>
    );
  }

  return <StalkerBody>{children}</StalkerBody>;
};
