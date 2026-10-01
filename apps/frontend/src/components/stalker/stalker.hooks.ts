'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

const readJson = async (response: Response) => {
  if (!response.ok) {
    return null;
  }
  return response.json();
};

export const useStalkerMentions = (search: string) => {
  const fetch = useFetch();
  const load = useCallback(async (path: string) => {
    return readJson(await fetch(path));
  }, []);
  return useSWR(
    `/stalker/mentions${search ? `?${search}` : ''}`,
    load,
    { revalidateOnFocus: false }
  );
};

export const useStalkerThemes = () => {
  const fetch = useFetch();
  const load = useCallback(async (path: string) => {
    return readJson(await fetch(path));
  }, []);
  return useSWR('/stalker/themes', load, { revalidateOnFocus: false });
};

export const useStalkerKeywords = () => {
  const fetch = useFetch();
  const load = useCallback(async (path: string) => {
    return readJson(await fetch(path));
  }, []);
  return useSWR('/stalker/keywords', load, { revalidateOnFocus: false });
};

export const useStalkerStatus = () => {
  const fetch = useFetch();
  const load = useCallback(async (path: string) => {
    return readJson(await fetch(path));
  }, []);
  return useSWR('/stalker/status', load, { revalidateOnFocus: false });
};
