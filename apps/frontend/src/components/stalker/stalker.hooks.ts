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

export const useStalkerProjects = (enabled = true) => {
  const fetch = useFetch();
  const load = useCallback(async (path: string) => {
    return readJson(await fetch(path));
  }, [fetch]);
  return useSWR(enabled ? '/stalker/projects' : null, load, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });
};

export const useStalkerMentions = (
  projectId: string | null,
  search: string
) => {
  const fetch = useFetch();
  const load = useCallback(async (path: string) => {
    return readJson(await fetch(path));
  }, [fetch]);
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
  }, [fetch]);
  return useSWR('/stalker/themes', load, { revalidateOnFocus: false });
};

export const useStalkerKeywords = (projectId: string | null) => {
  const fetch = useFetch();
  const load = useCallback(async (path: string) => {
    return readJson(await fetch(path));
  }, [fetch]);
  return useSWR(
    projectId ? `/stalker/keywords?projectId=${projectId}` : null,
    load,
    { revalidateOnFocus: false, keepPreviousData: true }
  );
};

export const useStalkerAnalytics = (
  projectId: string | null,
  search = 'date=30d'
) => {
  const fetch = useFetch();
  const load = useCallback(async (path: string) => {
    return readJson(await fetch(path));
  }, [fetch]);
  const query = new URLSearchParams(
    search.startsWith('date=') && !search.includes('&') && !search.includes('start')
      ? search
      : search
  );
  if (projectId) query.set('projectId', projectId);
  if (!query.get('date') && !query.get('start')) query.set('date', '30d');
  return useSWR(
    projectId ? `/stalker/analytics?${query.toString()}` : null,
    load,
    { revalidateOnFocus: false, keepPreviousData: true }
  );
};

export const useStalkerViews = (projectId: string | null) => {
  const fetch = useFetch();
  const load = useCallback(async (path: string) => {
    return readJson(await fetch(path));
  }, [fetch]);
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
  }, [fetch]);
  return useSWR(
    projectId ? `/stalker/alerts?projectId=${projectId}` : null,
    load,
    { revalidateOnFocus: false, keepPreviousData: true }
  );
};

export const useStalkerGroups = (projectId: string | null) => {
  const fetch = useFetch();
  const load = useCallback(async (path: string) => {
    return readJson(await fetch(path));
  }, [fetch]);
  return useSWR(
    projectId ? `/stalker/groups?projectId=${projectId}` : null,
    load,
    { revalidateOnFocus: false }
  );
};

export const useStalkerAuthors = (projectId: string | null) => {
  const fetch = useFetch();
  const load = useCallback(async (path: string) => {
    return readJson(await fetch(path));
  }, [fetch]);
  return useSWR(
    projectId ? `/stalker/authors?projectId=${projectId}` : null,
    load,
    { revalidateOnFocus: false }
  );
};

export const useStalkerRules = (projectId: string | null) => {
  const fetch = useFetch();
  const load = useCallback(async (path: string) => {
    return readJson(await fetch(path));
  }, [fetch]);
  return useSWR(
    projectId ? `/stalker/rules?projectId=${projectId}` : null,
    load,
    { revalidateOnFocus: false }
  );
};

export const useStalkerStatus = (enabled = true) => {
  const fetch = useFetch();
  const load = useCallback(async (path: string) => {
    return readJson(await fetch(path));
  }, [fetch]);
  return useSWR(enabled ? '/stalker/status' : null, load, {
    revalidateOnFocus: false,
  });
};
