'use client';

import clsx from 'clsx';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import {
  IntegrationsSkeleton,
  ThirdPartyListComponent,
} from '@gitroom/frontend/components/third-parties/third-party.list.component';
import { useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { SchedulePageHead } from '@gitroom/frontend/components/layout/schedule.shell';

export const ThirdPartyComponent = () => {
  const t = useT();
  const fetch = useFetch();

  const integrations = useCallback(async () => {
    return (await fetch('/third-party')).json();
  }, []);

  const { data, isLoading, mutate } = useSWR('third-party', integrations, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    dedupingInterval: 15000,
  });

  return (
    <div className="integrations-screen c8-sched-shell c8-sched-frame">
      <div className={clsx('integrations-main', isLoading && !data && 'integrations-state')}>
        <SchedulePageHead
          title={t('integrations', 'Integrations')}
          context={t('connected_tools', 'Connected tools')}
        />
        {isLoading && !data ? (
          <IntegrationsSkeleton />
        ) : (
          <div className="integrations-scroll">
            <ThirdPartyListComponent reload={mutate} saved={data || []} />
          </div>
        )}
      </div>
    </div>
  );
};
