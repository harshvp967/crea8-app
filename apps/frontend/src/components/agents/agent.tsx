'use client';

import React, {
  createContext,
  FC,
  useCallback,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import useSWR from 'swr';
import { orderBy } from 'lodash';
import { SVGLine } from '@gitroom/frontend/components/launches/launches.component';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import SafeImage from '@gitroom/react/helpers/safe.image';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useWaitForClass } from '@gitroom/helpers/utils/use.wait.for.class';
import { MultiMediaComponent } from '@gitroom/frontend/components/media/media.component';
import { Integration } from '@prisma/client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

export const MediaPortal: FC<{
  media: { path: string; id: string }[];
  value: string;
  setMedia: (event: {
    target: {
      name: string;
      value?: {
        id: string;
        path: string;
        alt?: string;
        thumbnail?: string;
        thumbnailTimestamp?: number;
      }[];
    };
  }) => void;
}> = ({ media, setMedia, value }) => {
  const waitForClass = useWaitForClass('copilotKitMessages');
  const t = useT();
  if (!waitForClass) return null;
  return (
    <div className="pl-[24px] pr-[24px] whitespace-nowrap editor rm-bg max-w-[860px] mx-auto w-full">
      <MultiMediaComponent
        allData={[{ content: value }]}
        text={value}
        label={t('attachments', 'Attachments')}
        description=""
        value={media}
        dummy={false}
        name="image"
        onChange={setMedia}
        onOpen={() => {}}
        onClose={() => {}}
      />
    </div>
  );
};

const useIntegrations = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return (await (await fetch('/integrations/list')).json()).integrations;
  }, []);

  return useSWR('integrations', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    fallbackData: [],
  });
};

const useThreads = () => {
  const fetch = useFetch();
  const threads = useCallback(async () => {
    return (await fetch('/copilot/list')).json();
  }, []);

  return useSWR('threads', threads);
};

export const AgentList: FC<{ onChange: (arr: any[]) => void }> = ({
  onChange,
}) => {
  const t = useT();
  const [selected, setSelected] = useState([]);
  const { data } = useIntegrations();

  const setIntegration = useCallback(
    (integration: Integration) => () => {
      if (selected.some((p) => p.id === integration.id)) {
        onChange(selected.filter((p) => p.id !== integration.id));
        setSelected(selected.filter((p) => p.id !== integration.id));
      } else {
        onChange([...selected, integration]);
        setSelected([...selected, integration]);
      }
    },
    [selected]
  );

  const sortedIntegrations = useMemo(() => {
    return orderBy(
      data || [],
      ['type', 'disabled', 'identifier'],
      ['desc', 'asc', 'asc']
    );
  }, [data]);

  return (
    <div className="trz agent-channels bg-newBgColorInner flex flex-col relative h-full w-full min-h-0">
      <div className="absolute top-0 start-0 w-full h-full p-[20px] overflow-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor">
        <div className="flex items-center mb-[8px]">
          <h2 className="flex-1 text-[18px] font-[600] tracking-[-0.02em]">
            {t('select_channels', 'Select Channels')}
          </h2>
        </div>
        <div className={clsx('flex flex-col gap-[8px]')}>
          {sortedIntegrations.map((integration) => {
            const isSelected = selected.some((p) => p.id === integration.id);
            return (
              <div
                onClick={setIntegration(integration)}
                key={integration.id}
                className={clsx(
                  'agent-channel flex gap-[12px] items-center group/profile justify-center rounded-[12px] cursor-pointer transition-all px-[8px] py-[8px] border',
                  isSelected && 'is-selected'
                )}
              >
                <div
                  className={clsx(
                    'relative rounded-full flex justify-center items-center gap-[6px]',
                    integration.disabled && 'opacity-50'
                  )}
                >
                  {(integration.inBetweenSteps || integration.refreshNeeded) && (
                    <div className="absolute start-0 top-0 w-[39px] h-[46px] cursor-pointer">
                      <div className="bg-red-500 w-[15px] h-[15px] rounded-full start-0 -top-[5px] absolute z-[200] text-[10px] flex justify-center items-center">
                        !
                      </div>
                      <div className="bg-primary/60 w-[39px] h-[46px] start-0 top-0 absolute rounded-full z-[199]" />
                    </div>
                  )}
                  <div
                    className={clsx(
                      'h-full w-[4px] -ms-[12px] rounded-s-[3px] transition-opacity',
                      isSelected
                        ? 'opacity-100'
                        : 'opacity-0 group-hover/profile:opacity-100'
                    )}
                  >
                    <SVGLine />
                  </div>
                  <ImageWithFallback
                    fallbackSrc={`/icons/platforms/${integration.identifier}.png`}
                    src={integration.picture}
                    className="rounded-[8px]"
                    alt={integration.identifier}
                    width={36}
                    height={36}
                  />
                  <SafeImage
                    src={`/icons/platforms/${integration.identifier}.png`}
                    className="rounded-[8px] absolute z-10 bottom-[5px] -end-[5px] border border-fifth"
                    alt={integration.identifier}
                    width={18.41}
                    height={18.41}
                  />
                </div>
                <div
                  className={clsx(
                    'flex-1 whitespace-nowrap text-ellipsis overflow-hidden group-[.sidebar]:hidden text-[14px] font-[500]',
                    integration.disabled && 'opacity-50',
                    isSelected ? 'text-newTextColor' : 'text-textItemBlur'
                  )}
                >
                  {integration.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const PropertiesContext = createContext({ properties: [] });
export const Agent: FC<{ children: ReactNode }> = ({ children }) => {
  const [properties, setProperties] = useState([]);
  const [channelsOpen, setChannelsOpen] = useState(false);
  const [threadsOpen, setThreadsOpen] = useState(false);
  const { id } = useParams<{ id?: string }>();
  const t = useT();

  useEffect(() => {
    setThreadsOpen(false);
  }, [id]);

  useEffect(() => {
    if (!channelsOpen && !threadsOpen) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setChannelsOpen(false);
        setThreadsOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [channelsOpen, threadsOpen]);

  const sheet =
    channelsOpen || threadsOpen ? (
      <button
        type="button"
        className="agent-sheet-backdrop"
        aria-label={t('close', 'Close')}
        onClick={() => {
          setChannelsOpen(false);
          setThreadsOpen(false);
        }}
      />
    ) : null;

  return (
    <PropertiesContext.Provider value={{ properties }}>
      <div className="agent-workspace">
        <div className={clsx('agent-threads', threadsOpen && 'is-open')}>
          <Threads onPick={() => setThreadsOpen(false)} />
        </div>
        <div className="agent-chat-pane">
          <AgentTitle
            onChannels={() => {
              setThreadsOpen(false);
              setChannelsOpen(true);
            }}
            onHistory={() => {
              setChannelsOpen(false);
              setThreadsOpen(true);
            }}
          />
          <div className="agent-chat-body">{children}</div>
        </div>
      </div>
      {channelsOpen
        ? createPortal(
            <>
              {sheet}
              <div className="agent-channels-sheet" role="dialog">
                <AgentList onChange={setProperties} />
              </div>
            </>,
            document.body
          )
        : threadsOpen
          ? createPortal(sheet, document.body)
          : null}
    </PropertiesContext.Provider>
  );
};

const AgentTitle: FC<{ onChannels: () => void; onHistory: () => void }> = ({
  onChannels,
  onHistory,
}) => {
  const t = useT();
  const { id } = useParams<{ id?: string }>();
  const { data: threads } = useThreads();
  const { data: integrations } = useIntegrations();
  const current = threads?.threads?.find(
    (thread: { id: string }) => thread.id === id
  );
  const title =
    current?.title || t('your_assistant', 'Crea8one AI Agent');
  const count = integrations?.length || 0;

  return (
    <div className="agent-titlebar">
      <button
        type="button"
        className="agent-history"
        aria-label={t('conversations', 'Conversations')}
        onClick={onHistory}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
        >
          <path
            d="M3 4.5h12M3 9h12M3 13.5h8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <h1>{title}</h1>
      <button type="button" className="agent-channels-pill" onClick={onChannels}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path
            d="M6 7.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5ZM11.25 7a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5ZM2.75 13.25v-.75A2.75 2.75 0 0 1 5.5 9.75h1a2.75 2.75 0 0 1 2.75 2.75v.75M9.5 9.9a2.5 2.5 0 0 1 3.75 2.16v1.19"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
        <span>
          {t('channels', 'Channels')} · {count}
        </span>
      </button>
    </div>
  );
};

const Threads: FC<{ onPick: () => void }> = ({ onPick }) => {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const { data } = useThreads();

  return (
    <div className="absolute top-0 start-0 w-full h-full p-[16px] overflow-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor flex flex-col">
      <div className="mb-[16px] shrink-0">
        <Link
          href="/agents"
          onClick={onPick}
          className="agent-new-chat whitespace-nowrap flex w-full min-h-[44px] rounded-[18px] items-center gap-[8px] px-[14px] outline-none font-[600]"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 21 20"
            fill="none"
          >
            <path
              d="M10.5001 4.16699V15.8337M4.66675 10.0003H16.3334"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[15px]">
            {t('start_a_new_chat', 'Start a new chat')}
          </span>
        </Link>
      </div>
      <div className="agent-thread-label">
        {t('conversations', 'Conversations')}
      </div>
      <div className="flex flex-col gap-[4px] flex-1">
        {data?.threads?.map((p: any) => (
          <Link
            className={clsx(
              'agent-thread overflow-ellipsis overflow-hidden whitespace-nowrap',
              p.id === id && 'is-current'
            )}
            href={`/agents/${p.id}`}
            key={p.id}
            onClick={onPick}
          >
            {p.title}
          </Link>
        ))}
        {(!data?.threads || data.threads.length === 0) && (
          <div className="agent-thread-empty">
            {t(
              'no_conversations_yet',
              'Your previous conversations will appear here.'
            )}
          </div>
        )}
      </div>
    </div>
  );
};
