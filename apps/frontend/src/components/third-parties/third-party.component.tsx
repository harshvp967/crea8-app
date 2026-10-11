'use client';

import clsx from 'clsx';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { ThirdPartyListComponent } from '@gitroom/frontend/components/third-parties/third-party.list.component';
import { useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';

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
          <h1>{t('integrations', 'Integrations')}</h1>
        </div>
        {isLoading && !data ? (
          <LoadingComponent />
        ) : (
          <div className="integrations-scroll">
            <ThirdPartyListComponent reload={mutate} saved={data || []} />
          </div>
        )}
      </div>
    </div>
  );
};
