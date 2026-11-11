'use client';

import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useCallback, useState } from 'react';
import useSWR from 'swr';

export const useIntegrationList = (enabled = true) => {
  const fetch = useFetch();
  const [channelTotal, setChannelTotal] = useState<number | null>(null);

  const load = useCallback(async (path: string) => {
    const json = await (await fetch(path)).json();
    setChannelTotal(typeof json.total === 'number' ? json.total : null);
    return json.integrations;
  }, []);

  const list = useSWR(enabled ? '/integrations/list' : null, load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    dedupingInterval: 15000,
    fallbackData: [],
  });

  return { ...list, channelTotal };
};