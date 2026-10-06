'use client';

import {
  createContext,
  ReactNode,
  useContext,
  useState,
} from 'react';
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
};

const StalkerProjectContext = createContext<StalkerProjectContextValue | null>(
  null
);

export const StalkerProjectProvider = ({
  children,
  sample = false,
  empty = false,
  initialWizard = false,
}: {
  children: ReactNode;
  sample?: boolean;
  empty?: boolean;
  initialWizard?: boolean;
}) => {
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

  const project =
    projects.find((item) => item.id === projectId) || projects[0] || null;

  return (
    <StalkerProjectContext.Provider
      value={{
        projects,
        project,
        projectId: project?.id || null,
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
