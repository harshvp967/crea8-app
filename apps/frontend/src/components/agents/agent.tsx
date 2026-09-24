'use client';

import React, {
  createContext,
  FC,
  useCallback,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import clsx from 'clsx';
import useCookie from 'react-use-cookie';
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

export const AgentList: FC<{ onChange: (arr: any[]) => void }> = ({
  onChange,
}) => {
  const fetch = useFetch();
  const t = useT();
  const [selected, setSelected] = useState([]);

  const load = useCallback(async () => {
    return (await (await fetch('/integrations/list')).json()).integrations;
  }, []);

  const [collapseMenu, setCollapseMenu] = useCookie('collapseMenu', '0');

  const { data } = useSWR('integrations', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    fallbackData: [],
  });

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
    <div
      className={clsx(
        'trz agent-channels bg-newBgColorInner border-e border-newBorder flex flex-col gap-[15px] transition-all relative shrink-0',
        collapseMenu === '1'
          ? 'group sidebar w-[88px]'
          : 'w-[260px] max-xl:w-[220px]'
      )}
    >
      <div className="absolute top-0 start-0 w-full h-full p-[20px] overflow-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor">
        <div className="flex items-center mb-[8px]">
          <h2 className="group-[.sidebar]:hidden flex-1 text-[18px] font-[600] tracking-[-0.02em]">
            {t('select_channels', 'Select Channels')}
          </h2>
          <div
            onClick={() => setCollapseMenu(collapseMenu === '1' ? '0' : '1')}
            className="group-[.sidebar]:rotate-[180deg] group-[.sidebar]:mx-auto text-btnText bg-btnSimple rounded-full w-[28px] h-[28px] flex items-center justify-center cursor-pointer select-none hover:bg-[#00D9FF]/15 hover:text-[#00D9FF] transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="7"
              height="13"
              viewBox="0 0 7 13"
              fill="none"
            >
              <path
                d="M6 11.5L1 6.5L6 1.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        <div className={clsx('flex flex-col gap-[8px]')}>
          {sortedIntegrations.map((integration, index) => {
            const isSelected = selected.some((p) => p.id === integration.id);
            return (
              <div
                onClick={setIntegration(integration)}
                key={integration.id}
                className={clsx(
                  'flex gap-[12px] items-center group/profile justify-center rounded-[12px] cursor-pointer transition-all px-[8px] py-[8px] border',
                  isSelected
                    ? 'opacity-100 bg-[#00D9FF]/10 border-[#00D9FF]/35'
                    : 'opacity-45 border-transparent hover:opacity-100 hover:bg-boxHover hover:border-[#2a2a2a]'
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
                    isSelected ? 'text-newTextColor' : 'text-[#a0a0a0]'
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

  return (
    <PropertiesContext.Provider value={{ properties }}>
      <div className="agent-workspace flex flex-1 min-w-0 min-h-0 overflow-x-auto overflow-y-hidden">
        <AgentList onChange={setProperties} />
        <div className="bg-newBgColorInner flex flex-1 min-w-[min(100%,420px)] min-h-0">
          {children}
        </div>
        <Threads />
      </div>
    </PropertiesContext.Provider>
  );
};

const Threads: FC = () => {
  const fetch = useFetch();
  const t = useT();
  const threads = useCallback(async () => {
    return (await fetch('/copilot/list')).json();
  }, []);
  const { id } = useParams<{ id: string }>();

  const { data } = useSWR('threads', threads);

  return (
    <div
      className={clsx(
        'trz agent-threads bg-newBgColorInner border-s border-newBorder flex flex-col gap-[15px] transition-all relative shrink-0',
        'w-[260px] max-xl:w-[220px] max-md:w-[200px]'
      )}
    >
      <div className="absolute top-0 start-0 w-full h-full p-[20px] overflow-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor flex flex-col">
        <div className="mb-[16px] justify-center flex group-[.sidebar]:pb-[15px] shrink-0">
          <Link
            href={`/agents`}
            className="!text-[#0a0a0a] whitespace-nowrap flex-1 pt-[12px] pb-[12px] ps-[16px] pe-[20px] group-[.sidebar]:p-0 min-h-[44px] max-h-[44px] rounded-full bg-[#00D9FF] hover:bg-[#00B8D9] transition-colors flex justify-center items-center gap-[8px] outline-none font-[600]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="21"
              height="20"
              viewBox="0 0 21 20"
              fill="none"
              className="min-w-[21px] min-h-[20px] text-[#0a0a0a]"
            >
              <path
                d="M10.5001 4.16699V15.8337M4.66675 10.0003H16.3334"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="flex-1 text-start text-[15px] !text-[#0a0a0a] group-[.sidebar]:hidden">
              {t('start_a_new_chat', 'Start a new chat')}
            </div>
          </Link>
        </div>
        <div className="text-[11px] font-[600] uppercase tracking-[0.06em] text-[#6a6a6a] mb-[10px] px-[4px]">
          {t('conversations', 'Conversations')}
        </div>
        <div className="flex flex-col gap-[4px] flex-1">
          {data?.threads?.map((p: any) => (
            <Link
              className={clsx(
                'overflow-ellipsis overflow-hidden whitespace-nowrap px-[12px] py-[10px] rounded-[12px] cursor-pointer text-[13px] font-[500] border transition-colors',
                p.id === id
                  ? 'bg-[#00D9FF]/10 border-[#00D9FF]/35 text-newTextColor'
                  : 'border-transparent text-[#9a9a9a] hover:bg-[#1a1a1a] hover:text-newTextColor hover:border-[#2a2a2a]'
              )}
              href={`/agents/${p.id}`}
              key={p.id}
            >
              {p.title}
            </Link>
          ))}
          {(!data?.threads || data.threads.length === 0) && (
            <div className="px-[12px] py-[16px] text-[13px] text-[#6a6a6a] leading-relaxed">
              {t(
                'no_conversations_yet',
                'Your previous conversations will appear here.'
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
