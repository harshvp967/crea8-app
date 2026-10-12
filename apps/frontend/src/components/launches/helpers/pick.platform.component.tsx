import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { Integrations } from '@gitroom/frontend/components/launches/calendar.context';
import { useMoveToIntegrationListener } from '@gitroom/frontend/components/launches/helpers/use.move.to.integration';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import clsx from 'clsx';
import SafeImage from '@gitroom/react/helpers/safe.image';
import { useCopilotAction, useCopilotReadable } from '@copilotkit/react-core';
import { useStateCallback } from '@gitroom/react/helpers/use.state.callback';
import { timer } from '@gitroom/helpers/utils/timer';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
export const PickPlatforms: FC<{
  integrations: Integrations[];
  selectedIntegrations: Integrations[];
  onChange: (integrations: Integrations[], callback: () => void) => void;
  singleSelect: boolean;
  hide?: boolean;
  isMain: boolean;
  toolTip?: boolean;
}> = (props) => {
  const { hide, isMain, integrations, selectedIntegrations, onChange } = props;
  const ref = useRef<HTMLDivElement>(null);
  const [isLeft, setIsLeft] = useState(false);
  const [isRight, setIsRight] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useStateCallback<
    Integrations[]
  >(
    selectedIntegrations.slice(0).map((p) => ({
      ...p,
    }))
  );
  useEffect(() => {
    if (
      props.singleSelect &&
      selectedAccounts.length &&
      integrations.indexOf(selectedAccounts?.[0]) === -1
    ) {
      addPlatform(integrations[0])();
    }
  }, [integrations, selectedAccounts]);
  const checkLeftRight = (test = true) => {
    const scrollWidth = ref.current?.scrollWidth;
    const offsetWidth = +(ref.current?.offsetWidth || 0);
    const scrollOffset = ref.current?.scrollLeft || 0;
    const totalScroll = scrollOffset + offsetWidth + 100;
    setIsLeft(!!scrollOffset);
    setIsRight(!!scrollWidth && !!offsetWidth && scrollWidth > totalScroll);
  };
  const changeOffset = useCallback(
    (offset: number) => () => {
      if (ref.current) {
        ref.current.scrollLeft += offset;
        checkLeftRight();
      }
    },
    [selectedIntegrations, integrations, selectedAccounts]
  );
  useEffect(() => {
    checkLeftRight();
  }, [selectedIntegrations, integrations]);
  useMoveToIntegrationListener(
    [integrations],
    props.singleSelect,
    ({ identifier, toPreview }: { identifier: string; toPreview: boolean }) => {
      const findIntegration = integrations.find((p) => p.id === identifier);
      if (findIntegration) {
        addPlatform(findIntegration)();
      }
    }
  );
  const addPlatform = useCallback(
    (integration: Integrations) => async () => {
      const promises = [];
      if (props.singleSelect) {
        promises.push(
          new Promise((res) => {
            onChange([integration], () => {
              res('');
            });
          })
        );
        promises.push(
          new Promise((res) => {
            setSelectedAccounts([integration], () => {
              res('');
            });
          })
        );
        return;
      }
      if (selectedAccounts.some((account) => account.id === integration.id)) {
        const changedIntegrations = selectedAccounts.filter(
          ({ id }) => id !== integration.id
        );
        if (
          !props.singleSelect &&
          !(await deleteDialog(
            'Are you sure you want to remove this platform?'
          ))
        ) {
          return;
        }
        promises.push(
          new Promise((res) => {
            onChange(changedIntegrations, () => {
              res('');
            });
          })
        );
        promises.push(
          new Promise((res) => {
            setSelectedAccounts(changedIntegrations, () => {
              res('');
            });
          })
        );
      } else {
        const changedIntegrations = [...selectedAccounts, integration];
        promises.push(
          new Promise((res) => {
            onChange(changedIntegrations, () => {
              res('');
            });
          })
        );
        promises.push(
          new Promise((res) => {
            setSelectedAccounts(changedIntegrations, () => {
              res('');
            });
          })
        );
      }
      await timer(500);
      await Promise.all(promises);
    },
    [onChange, props.singleSelect, selectedAccounts, setSelectedAccounts]
  );
  const handler = async ({ integrationsId }: { integrationsId: string[] }) => {
    const selected = selectedIntegrations.map((p) => p.id);
    const notToRemove = selected.filter((p) => integrationsId.includes(p));
    const toAdd = integrationsId.filter((p) => !selected.includes(p));
    const newIntegrations = [...notToRemove, ...toAdd]
      .map((id) => integrations.find((p) => p.id === id)!)
      .filter((p) => p);
    setSelectedAccounts(newIntegrations, () => {
      console.log('changed');
    });
    onChange(newIntegrations, () => {
      console.log('changed');
    });
  };
  useCopilotReadable({
    description: isMain
      ? 'All available platforms channels'
      : 'Possible platforms channels to edit',
    value: JSON.stringify(integrations),
  });
  useCopilotAction(
    {
      name: isMain ? `addOrRemovePlatform` : 'setSelectedIntegration',
      description: isMain
        ? `Add or remove channels to schedule your post to, pass all the ids as array`
        : 'Set selected integrations',
      parameters: [
        {
          name: 'integrationsId',
          type: 'string[]',
          description: 'List of integrations id to set as selected',
          required: true,
        },
      ],
      handler,
    },
    [
      addPlatform,
      selectedAccounts,
      integrations,
      onChange,
      props.singleSelect,
      setSelectedAccounts,
    ]
  );
  if (hide) {
    return null;
  }
  return (
    <div
      className={clsx('flex select-none', props.singleSelect && 'gap-[10px]')}
    >
      {props.singleSelect && isLeft && (
        <div className="flex items-center">
          {isLeft && (
            <HugeIcon
              name="chevron-left"
              size={16}
              onClick={changeOffset(-200)}
            />
          )}
        </div>
      )}
      <div
        className={clsx(
          'flex-1 flex',
          props.singleSelect && 'relative h-[40px]'
        )}
      >
        <div
          className={clsx(
            props.singleSelect
              ? 'absolute w-full h-[40px] flex flex-nowrap overflow-hidden transition-all'
              : 'flex-1 flex'
          )}
          ref={ref}
        >
          <div className="innerComponent">
            <div className="flex gap-[10px] flex-wrap">
              {integrations
                .filter((f) => !f.inBetweenSteps)
                .map((integration) =>
                  !props.singleSelect ? (
                    <div
                      key={integration.id}
                      className="flex gap-[8px] items-center"
                      {...(props.toolTip && {
                        'data-tooltip-id': 'tooltip',
                        'data-tooltip-content': integration.name,
                      })}
                    >
                      <div
                        onClick={addPlatform(integration)}
                        className={clsx(
                          'cursor-pointer relative w-[34px] h-[34px] rounded-full flex justify-center items-center bg-fifth filter transition-all duration-500',
                          selectedAccounts.findIndex(
                            (p) => p.id === integration.id
                          ) === -1
                            ? 'opacity-40'
                            : ''
                        )}
                      >
                        <SafeImage
                          src={integration.picture || '/no-picture.jpg'}
                          className="rounded-full"
                          alt={integration.identifier}
                          width={32}
                          height={32}
                        />
                        {integration.identifier === 'youtube' ? (
                          <img
                            src="/icons/platforms/youtube.svg"
                            className="absolute z-10 bottom-0 -end-[5px]"
                            width={20}
                          />
                        ) : (
                          <SafeImage
                            src={`/icons/platforms/${integration.identifier}.png`}
                            className="rounded-full absolute z-10 -bottom-[5px] -end-[5px] border border-fifth"
                            alt={integration.identifier}
                            width={20}
                            height={20}
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div key={integration.id} className="">
                      <div
                        onClick={addPlatform(integration)}
                        className={clsx(
                          'cursor-pointer rounded-[50px] w-[200px] relative h-[40px] flex justify-center items-center bg-fifth filter transition-all duration-500',
                          selectedAccounts.findIndex(
                            (p) => p.id === integration.id
                          ) === -1
                            ? 'bg-third border border-third'
                            : 'bg-customColor29 border border-customColor30'
                        )}
                      >
                        <div className="flex items-center justify-center gap-[10px]">
                          <div className="relative">
                            <img
                              src={integration.picture || '/no-picture.jpg'}
                              className="rounded-full"
                              alt={integration.identifier}
                              width={24}
                              height={24}
                            />
                            <SafeImage
                              src={`/icons/platforms/${integration.identifier}.png`}
                              className="rounded-full absolute z-10 -bottom-[5px] -end-[5px] border border-fifth"
                              alt={integration.identifier}
                              width={15}
                              height={15}
                            />
                          </div>
                          <div>
                            {integration.name.slice(0, 10)}
                            {integration.name.length > 10 ? '...' : ''}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                )}
            </div>
          </div>
        </div>
      </div>
      {props.singleSelect && isRight && (
        <div className="flex items-center">
          <HugeIcon
            name="chevron-right"
            size={16}
            className={!isRight ? 'pointer-events-none invisible' : ' '}
            onClick={changeOffset(200)}
          />
        </div>
      )}
    </div>
  );
};
