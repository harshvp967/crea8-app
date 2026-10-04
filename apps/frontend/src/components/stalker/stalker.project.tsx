'use client';

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  useStalkerProjects,
  useStalkerStatus,
} from '@gitroom/frontend/components/stalker/stalker.hooks';

const STORAGE_KEY = 'crea8-stalker-project';

export type StalkerProjectRecord = {
  id: string;
  name: string;
  description: string;
  color: string;
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
  sources?: StalkerSourceStatus[];
  commentSources?: Array<{ id: string; label: string; available: boolean }>;
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
};

const StalkerProjectContext = createContext<StalkerProjectContextValue | null>(
  null
);

export const StalkerProjectProvider = ({ children }: { children: ReactNode }) => {
  const { data, mutate, isLoading } = useStalkerProjects();
  const { data: status } = useStalkerStatus();
  const projects: StalkerProjectRecord[] = Array.isArray(data) ? data : [];
  const [projectId, setProjectIdState] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setProjectIdState(stored);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || isLoading || !Array.isArray(data)) {
      return;
    }
    if (!data.length) {
      setShowWizard(true);
      return;
    }
    setProjectIdState((current) => {
      const selected = data.some((project) => project.id === current)
        ? current
        : data[0].id;
      if (selected) {
        window.localStorage.setItem(STORAGE_KEY, selected);
      }
      return selected || null;
    });
  }, [ready, isLoading, data]);

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
        status: status || null,
        loading: !ready || isLoading,
        showWizard,
        setShowWizard,
        refreshProjects: () => {
          mutate();
        },
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
