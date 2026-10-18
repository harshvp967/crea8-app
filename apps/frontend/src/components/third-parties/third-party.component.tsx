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
  });

  return (
    <div className="integrations-screen">
      <div className={clsx('integrations-main', isLoading && !data && 'integrations-state')}>
        <div className="integrations-head">
          <div className="integrations-kicker">
            <span className="integrations-sticker">{t('schedule', 'Schedule')}</span>
            <span className="integrations-period">
              {t('connected_tools', 'Connected tools')}
            </span>
          </div>
          <h1>{t('integrations', 'Integrations')}</h1>
        </div>
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
