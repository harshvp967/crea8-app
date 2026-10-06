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

export const useStalkerProjects = () => {
  const fetch = useFetch();
  const load = useCallback(async (path: string) => {
    return readJson(await fetch(path));
  }, []);
  return useSWR('/stalker/projects', load, { revalidateOnFocus: false });
};

export const useStalkerMentions = (
  projectId: string | null,
  search: string
) => {
  const fetch = useFetch();
  const load = useCallback(async (path: string) => {
    return readJson(await fetch(path));
  }, []);
  const query = new URLSearchParams(search);
  if (projectId) {
    query.set('projectId', projectId);
  }
  return useSWR(
    projectId ? `/stalker/mentions?${query.toString()}` : null,
    load,
    { revalidateOnFocus: false, keepPreviousData: true }
  );
};

export const useStalkerThemes = () => {
  const fetch = useFetch();
  const load = useCallback(async (path: string) => {
    return readJson(await fetch(path));
  }, []);
  return useSWR('/stalker/themes', load, { revalidateOnFocus: false });
};

export const useStalkerKeywords = (projectId: string | null) => {
  const fetch = useFetch();
  const load = useCallback(async (path: string) => {
    return readJson(await fetch(path));
  }, []);
  return useSWR(
    projectId ? `/stalker/keywords?projectId=${projectId}` : null,
    load,
    { revalidateOnFocus: false, keepPreviousData: true }
  );
};

export const useStalkerAnalytics = (
  projectId: string | null,
  date = '30d'
) => {
  const fetch = useFetch();
  const load = useCallback(async (path: string) => {
    return readJson(await fetch(path));
  }, []);
  return useSWR(
    projectId
      ? `/stalker/analytics?projectId=${projectId}&date=${date}`
      : null,
    load,
    { revalidateOnFocus: false, keepPreviousData: true }
  );
};

export const useStalkerViews = (projectId: string | null) => {
  const fetch = useFetch();
  const load = useCallback(async (path: string) => {
    return readJson(await fetch(path));
  }, []);
  return useSWR(
    projectId ? `/stalker/views?projectId=${projectId}` : null,
    load,
    { revalidateOnFocus: false }
  );
};

export const useStalkerAlerts = (projectId: string | null) => {
  const fetch = useFetch();
  const load = useCallback(async (path: string) => {
    return readJson(await fetch(path));
  }, []);
  return useSWR(
    projectId ? `/stalker/alerts?projectId=${projectId}` : null,
    load,
    { revalidateOnFocus: false, keepPreviousData: true }
  );
};

export const useStalkerStatus = () => {
  const fetch = useFetch();
  const load = useCallback(async (path: string) => {
    return readJson(await fetch(path));
  }, []);
  return useSWR('/stalker/status', load, { revalidateOnFocus: false });
};
