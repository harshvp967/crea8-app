'use client';

import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { linkStartupKeys } from '@gitroom/frontend/components/link-in-bio/link.startup.keys';

// Same window as the calendar startup reads. The shell used to paint only
// after /user/self, and these requests started on the next mount.
export const linkStartup = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  revalidateIfStale: false,
  revalidateOnMount: true,
  refreshWhenHidden: false,
  refreshWhenOffline: false,
  dedupingInterval: 15000,
};

export function useLinkStartup(pathname: string) {
  const fetch = useFetch();
  const keys = linkStartupKeys(pathname);
  useSWR(
    keys.page,
    async (path: string) => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const response = await fetch(`${path}?timezone=${encodeURIComponent(timezone)}`);
      if (!response.ok) {
        throw new Error('Could not load your page');
      }
      return response.json();
    },
    linkStartup
  );
  useSWR(
    keys.posts,
    async (path: string) => {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error('Could not load posts');
      }
      return response.json();
    },
    linkStartup
  );
  useSWR(
    keys.leads,
    async (path: string) => {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error('Could not load leads');
      }
      return response.json();
    },
    linkStartup
  );
}
