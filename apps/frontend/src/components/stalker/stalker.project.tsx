'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useSWRConfig } from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import {
  useStalkerProjects,
  useStalkerStatus,
} from '@gitroom/frontend/components/stalker/stalker.hooks';
import {
  SAMPLE_PROJECTS,
  SAMPLE_STATUS,
} from '@gitroom/frontend/components/stalker/stalker.sample';

const STORAGE_KEY = 'crea8-stalker-project';

export type StalkerProjectRecord = {
  id: string;
  name: string;
  description: string;
  color: string;
  brandName?: string;
  aliases?: string;
  exclusions?: string;
  handleX?: string;
  handleRedditUser?: string;
  handleRedditSubreddit?: string;
  handleYoutube?: string;
  handleLinkedin?: string;
  handleInstagram?: string;
  handleFacebook?: string;
  alertEmail?: string;
  alertsEnabled?: boolean;
  alertScope?: 'URGENT' | 'NEGATIVE' | 'ALL';
  alertDelivery?: 'INSTANT' | 'DIGEST';
  spikeEnabled?: boolean;
  spikeMultiplier?: number;
  sentimentDropEnabled?: boolean;
  sentimentDropPoints?: number;
  alertCooldownHours?: number;
  webhookUrl?: string;
  publicDashboard?: boolean;
  publicToken?: string;
  digestEnabled?: boolean;
  digestDismissed?: boolean;
  digestHour?: number;
  digestTimezone?: string;
  digestGroupName?: string;
  categories?: Array<{ id: string; name: string; description: string }>;
};

export type StalkerSourceStatus = {
  id: string;
  label: string;
  filter: string;
  available: boolean;
  detail: string;
};

type StalkerStatus = {
  pollHours?: number;
  maxKeywords?: number;
  keywordsSearchedPerRun?: number;
  openAi?: boolean;
  ownerEmail?: string;
  emailCap?: number;
  sources?: StalkerSourceStatus[];
  commentSources?: Array<{ id: string; label: string; available: boolean }>;
  suggestedHandles?: {
    x?: string;
    youtube?: string;
    linkedin?: string;
    instagram?: string;
    facebook?: string;
  };
};

export type StalkerScanSource = {
  id: string;
  ok: boolean;
  searched?: number;
  found?: number;
  stored?: number;
  error?: string;
};

export type StalkerScanView = {
  runId?: string | null;
  status: string;
  trigger?: string | null;
  error?: string;
  sources?: StalkerScanSource[];
  totals?: { found: number; stored: number; duplicates: number; offTopic: number };
};

type StalkerProjectContextValue = {
  projects: StalkerProjectRecord[];
  project: StalkerProjectRecord | null;
  projectId: string | null;
  setProjectId: (id: string) => void;
  status: StalkerStatus | null;
  loading: boolean;
  showWizard: boolean;
  setShowWizard: (value: boolean) => void;
  refreshProjects: () => void;
  addKeywordSignal: number;
  requestAddKeyword: () => void;
  sample: boolean;
  previewScan: string | null;
  scanning: boolean;
  scanResult: StalkerScanView | null;
  runScan: () => Promise<void>;
  watchScan: (id?: string) => Promise<void>;
};

const StalkerProjectContext = createContext<StalkerProjectContextValue | null>(
  null
);

export const StalkerProjectProvider = ({
  children,
  sample = false,
  empty = false,
  initialWizard = false,
  previewScan = null,
}: {
  children: ReactNode;
  sample?: boolean;
  empty?: boolean;
  initialWizard?: boolean;
  previewScan?: string | null;
}) => {
  const fetch = useFetch();
  const { mutate: mutateKeys } = useSWRConfig();
  const { data, mutate, isLoading } = useStalkerProjects(!sample);
  const { data: status } = useStalkerStatus(!sample);
  const projects: StalkerProjectRecord[] = sample
    ? empty
      ? []
      : SAMPLE_PROJECTS
    : Array.isArray(data)
      ? data
      : [];
  const [projectId, setProjectIdState] = useState<string | null>(
    sample ? (empty ? null : SAMPLE_PROJECTS[0].id) : null
  );
  const [showWizard, setShowWizard] = useState(initialWizard);
  const [addKeywordSignal, setAddKeywordSignal] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<StalkerScanView | null>(null);
  const scanToken = useRef(0);
  const [hydrated, setHydrated] = useState(sample);
  const dataIds = Array.isArray(data) ? data.map((item) => item.id).join(',') : '';
  const [syncedIds, setSyncedIds] = useState(sample ? 'sample' : '');

  if (!sample && !hydrated && typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    setHydrated(true);
    if (stored) {
      setProjectIdState(stored);
    }
  }

  if (!sample && hydrated && !isLoading && dataIds && syncedIds !== dataIds) {
    setSyncedIds(dataIds);
    setProjectIdState((current) => {
      const list = Array.isArray(data) ? data : [];
      const selected = list.some((item) => item.id === current)
        ? current
        : list[0]?.id || null;
      if (selected) {
        window.localStorage.setItem(STORAGE_KEY, selected);
      }
      return selected;
    });
  }

  const setProjectId = (id: string) => {
    setProjectIdState(id);
    window.localStorage.setItem(STORAGE_KEY, id);
    setShowWizard(false);
  };

  const matched = projects.find((item) => item.id === projectId) || null;
  const project = matched || (projects.length ? projects[0] : null);
  const activeId = project?.id || projectId;

  const revalidateFeeds = useCallback(() => {
    mutateKeys(
      (key) =>
        typeof key === 'string' &&
        (key.startsWith('/stalker/mentions') ||
          key.startsWith('/stalker/keywords') ||
          key.startsWith('/stalker/analytics'))
    );
  }, [mutateKeys]);

  const watchScan = useCallback(
    async (id?: string) => {
      const target = id || activeId;
      if (!target || sample) {
        return;
      }
      const token = ++scanToken.current;
      setScanning(true);
      const started = Date.now();
      while (Date.now() - started < 180000) {
        if (scanToken.current !== token) {
          return;
        }
        const response = await fetch(`/stalker/projects/${target}/scan`);
        const body = response.ok ? await response.json() : null;
        if (scanToken.current !== token) {
          return;
        }
        if (body?.status === 'queued' || body?.status === 'running') {
          setScanResult(body);
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        }
        setScanning(false);
        if (body) {
          setScanResult(body);
        }
        if (body?.status === 'succeeded' || body?.status === 'failed') {
          revalidateFeeds();
        }
        return;
      }
      if (scanToken.current === token) {
        setScanning(false);
      }
    },
    [activeId, fetch, revalidateFeeds, sample]
  );

  const runScan = useCallback(async () => {
    if (sample) {
      setScanning(true);
      setScanResult(null);
      window.setTimeout(() => {
        setScanning(false);
        setScanResult({
          status: 'succeeded',
          sources: [
            { id: 'youtube', ok: true, searched: 3, found: 15, stored: 12 },
          ],
          totals: { found: 15, stored: 12, duplicates: 3, offTopic: 0 },
        });
      }, 400);
      return;
    }
    if (!activeId) {
      return;
    }
    setScanning(true);
    setScanResult(null);
    const response = await fetch(`/stalker/projects/${activeId}/scan`, {
      method: 'POST',
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setScanning(false);
      setScanResult({
        status: 'failed',
        error:
          body?.message ||
          (response.status === 429
            ? 'A check just ran. Try again in a couple of minutes'
            : 'Could not start a scan'),
        sources: [],
      });
      return;
    }
    await watchScan(activeId);
  }, [activeId, fetch, sample, watchScan]);

  useEffect(() => {
    if (sample || !activeId) {
      return;
    }
    let cancelled = false;
    (async () => {
      const response = await fetch(`/stalker/projects/${activeId}/scan`);
      if (cancelled || !response.ok) {
        return;
      }
      const body = await response.json();
      if (cancelled) {
        return;
      }
      if (body?.status === 'queued' || body?.status === 'running') {
        watchScan(activeId);
        return;
      }
      const finished = body?.finishedAt ? new Date(body.finishedAt).getTime() : 0;
      if (
        finished &&
        Date.now() - finished < 2 * 60 * 1000 &&
        (body?.status === 'succeeded' || body?.status === 'failed')
      ) {
        setScanResult(body);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId, fetch, sample, watchScan]);

  return (
    <StalkerProjectContext.Provider
      value={{
        projects,
        project,
        projectId: activeId,
        setProjectId,
        status: sample ? SAMPLE_STATUS : status || null,
        loading: sample ? false : !hydrated || isLoading,
        showWizard,
        setShowWizard,
        refreshProjects: () => {
          mutate();
        },
        addKeywordSignal,
        requestAddKeyword: () => setAddKeywordSignal((value) => value + 1),
        sample,
        previewScan,
        scanning,
        scanResult,
        runScan,
        watchScan,
      }}
    >
      {children}
    </StalkerProjectContext.Provider>
  );
};

export const useStalkerProject = () => {
  const value = useContext(StalkerProjectContext);
  if (!value) {
    throw new Error('Stalker project context is missing');
  }
  return value;
};
