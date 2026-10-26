'use client';

import { FC, RefObject, useCallback, useEffect, useState } from 'react';
import {
  SelectedIntegrations,
  useLaunchStore,
} from '@gitroom/frontend/components/new-launch/store';
import clsx from 'clsx';
import SafeImage from '@gitroom/react/helpers/safe.image';
import { useShallow } from 'zustand/react/shallow';
import { GlobalIcon } from '@gitroom/frontend/components/ui/icons';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Integrations } from '@gitroom/frontend/components/launches/calendar.context';
import { capitalize } from 'lodash';
import {
  useDecisionModal,
  useModals,
} from '@gitroom/frontend/components/layout/new-modal';

export function useHasScroll(ref: RefObject<HTMLElement | null>): boolean {
  const [hasHorizontalScroll, setHasHorizontalScroll] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const checkScroll = () => {
      const el = ref.current;
      if (el) {
        setHasHorizontalScroll(el.scrollWidth > el.clientWidth);
      }
    };

    checkScroll(); // initial check

    const resizeObserver = new ResizeObserver(checkScroll);
    resizeObserver.observe(ref.current);

    const mutationObserver = new MutationObserver(checkScroll);
    mutationObserver.observe(ref.current, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [ref]);

  return hasHorizontalScroll;
}

export const SelectCurrent: FC = () => {
  const t = useT();
  const modals = useDecisionModal();
  const {
    selectedIntegrations,
    current,
    setCurrent,
    locked,
    setHide,
    addOrRemoveSelectedIntegration,
  } = useLaunchStore(
    useShallow((state) => ({
      selectedIntegrations: state.selectedIntegrations,
      addOrRemoveSelectedIntegration: state.addOrRemoveSelectedIntegration,
      current: state.current,
      setCurrent: state.setCurrent,
      locked: state.locked,
      setHide: state.setHide,
    }))
  );

  const removeSocial = useCallback(
    (sIntegration: Integrations) => async (e: any) => {
      e.stopPropagation();
      e.preventDefault();
      const open = await modals.open({
        title: 'Remove Social Account',
        description:
          'Are you sure you want to remove this social from scheduling?',
      });

      if (!open) {
        return;
      }

      addOrRemoveSelectedIntegration(sIntegration, {});
    },
    []
  );

  if (!selectedIntegrations.length) {
    return null;
  }

  return (
    <>
      <div className="po-current select-none w-full">
        <div
          className={clsx(
            'po-current-row flex gap-[8px] w-full flex-wrap',
            locked && 'opacity-50 pointer-events-none'
          )}
        >
          <button
            type="button"
            onClick={() => {
              setHide(true);
              setCurrent('global');
            }}
            aria-label={t('all_channels', 'All channels')}
            data-tooltip-id="tooltip"
            data-tooltip-content={t(
              'you_are_in_global_editing_mode',
              'You are in global editing mode'
            )}
            className={clsx(
              'po-global cursor-pointer flex gap-[8px] h-[44px] justify-center items-center bg-newBgColorInner',
              current !== 'global'
                ? 'text-[#A3A3A3] rounded-full w-[44px] border border-newBorder'
                : 'po-global-on rounded-[18px] px-[12px] border border-[#00D9FF] text-[#00D9FF]'
            )}
          >
            <GlobalIcon />
            {current === 'global' && (
              <span className="po-global-label text-[13px] font-[600] whitespace-nowrap">
                {t('all_channels', 'All channels')}
              </span>
            )}
          </button>
          {selectedIntegrations.map(({ integration }) => {
            const platform = capitalize(
              (integration.identifier || '').split('-')[0]
            );
            const channelLabel = platform
              ? `${platform} · ${integration.name}`
              : integration.name;
            const selected = current === integration.id;
            return (
              <div
                onClick={() => {
                  setHide(true);
                  setCurrent(integration.id);
                }}
                key={integration.id}
                aria-label={channelLabel}
                className={clsx(
                  'po-selected border cursor-pointer relative flex gap-[8px] h-[44px] items-center bg-newBgColorInner justify-center',
                  selected
                    ? 'is-on po-selected-on rounded-[18px] ps-[2px] pe-[12px]'
                    : 'rounded-full w-[44px] border-newBorder'
                )}
              >
                <div className="po-avatar relative w-[40px] h-[40px] shrink-0">
                  <button
                    type="button"
                    onClick={removeSocial(integration)}
                    className="po-chip-remove"
                    aria-label={t('remove', 'Remove')}
                  >
                    <span aria-hidden>×</span>
                  </button>
                  <IsGlobal id={integration.id} />
                  <div
                    {...{
                      'data-tooltip-id': 'tooltip',
                      'data-tooltip-content': channelLabel,
                    }}
                    className={clsx(
                      'relative w-full h-full rounded-full flex justify-center items-center filter transition-all duration-500'
                    )}
                  >
                    <SafeImage
                      src={integration.picture || '/no-picture.jpg'}
                      className="rounded-full w-[36px] h-[36px] min-w-[36px] object-cover"
                      alt={integration.identifier}
                      width={36}
                      height={36}
                      onError={(e) => {
                        e.currentTarget.src = '/no-picture.jpg';
                        e.currentTarget.srcset = '/no-picture.jpg';
                      }}
                    />
                    {integration.identifier === 'youtube' ? (
                      <img
                        src="/icons/platforms/youtube.svg"
                        className="absolute z-10 bottom-[2px] end-[2px] min-w-[12px]"
                        width={12}
                      />
                    ) : (
                      <SafeImage
                        src={`/icons/platforms/${integration.identifier}.png`}
                        className="min-w-[12px] min-h-[12px] rounded-[3px] absolute z-10 bottom-[6px] end-[6px]"
                        alt={integration.identifier}
                        width={12}
                        height={12}
                      />
                    )}
                  </div>
                </div>
                {selected && (
                  <span className="po-channel-label text-[14px] font-[600] whitespace-nowrap">
                    {channelLabel}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="po-current-spacer h-[44px]" />
    </>
  );
};

export const IsGlobal: FC<{ id: string }> = ({ id }) => {
  const t = useT();
  const { isInternal } = useLaunchStore(
    useShallow((state) => ({
      isInternal: !!state.internal.find((p) => p.integration.id === id),
    }))
  );

  if (!isInternal) {
    return null;
  }

  return (
    <div
      data-tooltip-id="tooltip"
      data-tooltip-content={t(
        'no_longer_global_mode',
        'No longer in global mode'
      )}
      className="w-[8px] h-[8px] bg-[#00D9FF] -top-[1px] -start-[3px] absolute rounded-full"
    />
  );
};
