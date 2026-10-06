'use client';

import { ReactNode } from 'react';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useStalkerProject } from '@gitroom/frontend/components/stalker/stalker.project';
import { StalkerWizard } from '@gitroom/frontend/components/stalker/stalker.wizard';
import { WavePhysicsLoader } from '@gitroom/frontend/components/layout/wave-physics-loader';

const Welcome = ({ onCreate }: { onCreate: () => void }) => (
  <div className="flex flex-1 items-center justify-center px-[24px] py-[64px]">
    <div className="flex max-w-[420px] flex-col items-center text-center">
      <h1 className="text-[28px] font-[600]">Welcome</h1>
      <p className="mt-[8px] text-[14px] text-textItemBlur">
        Create a project to start listening for mentions of your brand.
      </p>
      <button
        type="button"
        className="mt-[20px] rounded-full bg-newTextColor px-[18px] py-[10px] text-[14px] font-[600] text-newBgColorInner"
        onClick={onCreate}
      >
        Create your first project
      </button>
    </div>
  </div>
);

const StalkerBody = ({ children }: { children: ReactNode }) => {
  const { projects, loading, showWizard, setShowWizard } = useStalkerProject();

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-newBgColorInner">
      <main className="min-h-0 min-w-0 flex-1 overflow-auto">
        {loading ? (
          <div className="flex h-[240px] items-center justify-center">
            <WavePhysicsLoader theme="dark" />
          </div>
        ) : !projects.length ? (
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
      <div className="flex flex-1 items-center bg-newBgColorInner p-[32px] text-[15px] text-textItemBlur">
        {t(
          'stalker_disabled',
          'Stalker is turned off. Set STALKER_ENABLED=true on the frontend and the backend to open this dashboard.'
        )}
      </div>
    );
  }

  return <StalkerBody>{children}</StalkerBody>;
};
