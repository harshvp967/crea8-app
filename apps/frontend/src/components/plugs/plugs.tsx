'use client';

import useSWR from 'swr';
import { FC, ReactNode, useCallback, useMemo, useState } from 'react';
import { orderBy } from 'lodash';
import clsx from 'clsx';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import SafeImage from '@gitroom/react/helpers/safe.image';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Button } from '@gitroom/react/form/button';
import { useRouter } from 'next/navigation';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { PlugsContext } from '@gitroom/frontend/components/plugs/plugs.context';
import { Plug } from '@gitroom/frontend/components/plugs/plug';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';

const PlugsPageHead: FC<{ children?: ReactNode }> = ({ children }) => {
  const t = useT();
  return (
    <header className="plugs-head">
      <div className="plugs-kicker">
        <span className="plugs-sticker">{t('schedule', 'Schedule')}</span>
        <span className="plugs-period">
          {t('auto_actions_per_channel', 'Auto-actions per channel')}
        </span>
      </div>
      <h1>{t('plugs', 'Plugs')}</h1>
      {children}
    </header>
  );
};

const PlugsSkeleton = () => (
  <div className="plugs-skeleton" role="status">
    <span className="sr-only">Loading</span>
    <div className="plugs-skel-toolbar">
      <span className="plugs-skel-bar is-tool" />
    </div>
    {[0, 1, 2].map((i) => (
      <div key={i} className="plugs-skel-card">
        <div className="plugs-skel-row">
          <span className="plugs-skel-dot" />
          <div className="plugs-skel-lines">
            <span className="plugs-skel-bar is-a" />
            <span className="plugs-skel-bar is-b" />
          </div>
        </div>
        <span className={`plugs-skel-bar is-full is-${i}`} />
      </div>
    ))}
  </div>
);

export const Plugs = () => {
  const fetch = useFetch();
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [refresh, setRefresh] = useState(false);
  const toaster = useToaster();
  const load = useCallback(async () => {
    return (await (await fetch('/integrations/list')).json()).integrations;
  }, []);
  const load2 = useCallback(async (path: string) => {
    return await (await fetch(path)).json();
  }, []);
  const { data: plugList, isLoading: plugLoading } = useSWR(
    '/integrations/plug/list',
    load2,
    {
      fallbackData: [],
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      revalidateOnMount: true,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
    }
  );
  const { data, isLoading } = useSWR('analytics-list', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    fallbackData: [],
  });

  const [sheet, setSheet] = useState(false);
  const t = useT();

  const sortedIntegrations = useMemo(() => {
    return orderBy(
      data.filter((integration: any) =>
        plugList?.plugs?.some(
          (f: any) => f.identifier === integration.identifier
        )
      ),
      // data.filter((integration) => !integration.disabled),
      ['type', 'disabled', 'identifier'],
      ['desc', 'asc', 'asc']
    );
  }, [data, plugList]);
  const currentIntegration = useMemo(() => {
    return sortedIntegrations[current];
  }, [current, sortedIntegrations]);
  const currentIntegrationPlug = useMemo(() => {
    const plug = plugList?.plugs?.find(
      (f: any) => f?.identifier === currentIntegration?.identifier
    );
    if (!plug) {
      return null;
    }
    return {
      providerId: currentIntegration.id,
      ...plug,
    };
  }, [currentIntegration, plugList]);

  const pickChannel = (integration: (typeof sortedIntegrations)[number], index: number) => {
    if (integration.refreshNeeded) {
      toaster.show(
        'Please refresh the integration from the calendar',
        'warning'
      );
      return;
    }
    setRefresh(true);
    setTimeout(() => {
      setRefresh(false);
    }, 10);
    setCurrent(index);
    setSheet(false);
  };

  const channelMark = (integration: (typeof sortedIntegrations)[number]) => (
    <span
      className={clsx(
        'analytics-channel-mark',
        integration.disabled && 'is-disabled'
      )}
    >
      {(integration.inBetweenSteps || integration.refreshNeeded) && (
        <span className="analytics-channel-warn">!</span>
      )}
      <ImageWithFallback
        fallbackSrc={`/icons/platforms/${integration.identifier}.png`}
        src={integration.picture}
        className="avatar"
        alt={integration.identifier}
        width={36}
        height={36}
      />
      <SafeImage
        src={`/icons/platforms/${integration.identifier}.png`}
        className="badge"
        alt=""
        width={14}
        height={14}
      />
    </span>
  );

  const channelButtons = () =>
    sortedIntegrations.map((integration, index) => (
      <button
        type="button"
        key={integration.id}
        onClick={() => pickChannel(integration, index)}
        className={clsx(
          'analytics-channel',
          currentIntegration?.id === integration.id && 'is-selected',
          integration.disabled && 'is-disabled'
        )}
      >
        {channelMark(integration)}
        <span className="analytics-channel-name">{integration.name}</span>
      </button>
    ));

  if (isLoading || plugLoading) {
    return (
      <div className="plugs-screen">
        <div className="plugs-main">
          <PlugsPageHead />
          <PlugsSkeleton />
        </div>
      </div>
    );
  }

  if (!sortedIntegrations.length && !isLoading) {
    return (
      <div className="plugs-screen">
        <div className="plugs-main">
          <PlugsPageHead />
          <div className="plugs-state-card is-empty">
            <span className="plugs-state-tile is-empty" aria-hidden="true">
              <HugeIcon name="plug" size={25} />
            </span>
            <div className="plugs-state-text">
              <h2 className="plugs-state-title">
                {t(
                  'there_are_not_plugs_matching_your_channels',
                  'There are not plugs matching your channels'
                )}
              </h2>
              <p className="plugs-state-body">
                {t(
                  'you_have_to_add_x_linkedin_page_threads_or_bluesky',
                  'You have to add: X, LinkedIn Page, Threads or Bluesky'
                )}
              </p>
            </div>
            <Button onClick={() => router.push('/launches')}>
              <HugeIcon name="plus" size={18} />
              {t(
                'go_to_the_calendar_to_add_channels',
                'Go to the calendar to add channels'
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const platformLabel = currentIntegration.identifier
    .split('-')
    .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return (
    <div className="plugs-screen">
      <div className="analytics-channels plugs-channels">
        <h2>{t('channels', 'Channels')}</h2>
        <div className="analytics-channel-list">{channelButtons()}</div>
      </div>
      <div className="plugs-main">
        <PlugsPageHead>
          <button
            type="button"
            className="plugs-sub"
            onClick={() => setSheet((open) => !open)}
          >
            {currentIntegration.name} on {platformLabel}
          </button>
          {sheet && <div className="plugs-sheet">{channelButtons()}</div>}
        </PlugsPageHead>
        <div className="plugs-toolbar">
          <div className="plugs-strip">
            {sortedIntegrations.map((integration, index) => (
              <button
                type="button"
                key={integration.id}
                title={integration.name}
                aria-label={integration.name}
                onClick={() => pickChannel(integration, index)}
                className={clsx(
                  currentIntegration?.id === integration.id && 'is-selected',
                  integration.disabled && 'is-disabled'
                )}
              >
                {channelMark(integration)}
              </button>
            ))}
          </div>
        </div>
        <div className="plugs-scroll">
          <PlugsContext.Provider value={currentIntegrationPlug}>
            <Plug />
          </PlugsContext.Provider>
        </div>
      </div>
    </div>
  );
};
