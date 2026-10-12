'use client';

import { FC } from 'react';
import clsx from 'clsx';
import SafeImage from '@gitroom/react/helpers/safe.image';
import { useLaunchStore } from '@gitroom/frontend/components/new-launch/store';
import { useShallow } from 'zustand/react/shallow';
import { useExistingData } from '@gitroom/frontend/components/launches/helpers/use.existing.data';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';

export const PicksSocialsComponent: FC<{ toolTip?: boolean }> = ({
  toolTip,
}) => {
  const exising = useExistingData();

  const {
    locked,
    addOrRemoveSelectedIntegration,
    integrations,
    selectedIntegrations,
  } = useLaunchStore(
    useShallow((state) => ({
      integrations: state.integrations,
      selectedIntegrations: state.selectedIntegrations,
      addOrRemoveSelectedIntegration: state.addOrRemoveSelectedIntegration,
      locked: state.locked,
    }))
  );

  return (
    <div className={clsx('flex', locked && 'opacity-50 pointer-events-none')}>
      <div className="flex flex-1">
        <div className="innerComponent flex-1 flex">
          <div className="po-picks flex flex-wrap gap-[10px] flex-1">
            {integrations
              .filter((f) => {
                if (exising.integration) {
                  return f.id === exising.integration;
                }
                return !f.inBetweenSteps && !f.disabled;
              })
              .map((integration) => (
                <div
                  key={integration.id}
                  className="flex gap-[8px] items-center"
                  {...(toolTip && {
                    'data-tooltip-id': 'tooltip',
                    'data-tooltip-content': integration.name,
                  })}
                >
                  <div
                    onClick={() => {
                      if (exising.integration) {
                        return;
                      }
                      addOrRemoveSelectedIntegration(integration, {});
                    }}
                    className={clsx(
                      'po-pick cursor-pointer border relative rounded-full flex justify-center items-center bg-newBgColorInner transition-all duration-500',
                      selectedIntegrations.findIndex(
                        (p) => p.integration.id === integration.id
                      ) === -1
                        ? 'border-newBorder'
                        : 'is-on border-[#00D9FF]'
                    )}
                  >
                    <ImageWithFallback
                      fallbackSrc="/no-picture.jpg"
                      src={integration.picture || '/no-picture.jpg'}
                      className="rounded-full transition-all w-[40px] h-[40px] min-w-[40px] min-h-[40px] object-cover"
                      alt={integration.identifier}
                      width={40}
                      height={40}
                    />
                    {integration.identifier === 'youtube' ? (
                      <img
                        src="/icons/platforms/youtube.svg"
                        className="po-platform absolute z-10"
                        width={14}
                        height={14}
                      />
                    ) : (
                      <SafeImage
                        src={`/icons/platforms/${integration.identifier}.png`}
                        className="po-platform rounded-[4px] absolute z-10"
                        alt={integration.identifier}
                        width={14}
                        height={14}
                      />
                    )}
                    {selectedIntegrations.findIndex(
                      (p) => p.integration.id === integration.id
                    ) !== -1 && (
                      <span className="po-pick-check" aria-hidden>
                        <HugeIcon name="check" size={12} />
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};
