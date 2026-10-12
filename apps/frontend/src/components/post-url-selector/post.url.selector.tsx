'use client';

import { EventEmitter } from 'events';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { TopTitle } from '@gitroom/frontend/components/launches/helpers/top.title.component';
import dayjs from 'dayjs';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import removeMd from 'remove-markdown';
import clsx from 'clsx';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
const postUrlEmitter = new EventEmitter();
export const ShowPostSelector = () => {
  const [showPostSelector, setShowPostSelector] = useState(false);
  const [callback, setCallback] = useState<{
    callback: (tag: string | undefined) => void;
  } | null>({
    callback: (tag: string | undefined) => {
      return tag;
    },
  } as any);
  const [date, setDate] = useState(newDayjs());
  useEffect(() => {
    postUrlEmitter.on(
      'show',
      (params: {
        date: dayjs.Dayjs;
        callback: (url: string | undefined) => void;
      }) => {
        setCallback(params);
        setDate(params.date);
        setShowPostSelector(true);
      }
    );
    return () => {
      setShowPostSelector(false);
      setCallback(null);
      setDate(newDayjs());
      postUrlEmitter.removeAllListeners();
    };
  }, []);
  const close = useCallback(() => {
    setShowPostSelector(false);
    setCallback(null);
    setDate(newDayjs());
  }, []);
  if (!showPostSelector) {
    return <></>;
  }
  return (
    <PostSelector onClose={close} onSelect={callback?.callback!} date={date} />
  );
};
export const showPostSelector = (date: dayjs.Dayjs) => {
  return new Promise<string>((resolve) => {
    postUrlEmitter.emit('show', {
      date,
      callback: (tag: string) => {
        resolve(tag);
      },
    });
  });
};
export const useShowPostSelector = (day: dayjs.Dayjs) => {
  return useCallback(() => {
    return showPostSelector(day);
  }, [day]);
};
export const PostSelector: FC<{
  onClose: () => void;
  onSelect: (tag: string | undefined) => void;
  only?: 'article' | 'social';
  noModal?: boolean;
  date: dayjs.Dayjs;
}> = (props) => {
  const { onClose, onSelect, only, date, noModal } = props;
  const fetch = useFetch();
  const fetchOldPosts = useCallback(() => {
    return fetch(
      '/posts/old?date=' + date.utc().format('YYYY-MM-DDTHH:mm:00'),
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    ).then((res) => res.json());
  }, [date]);
  const onCloseWithEmptyString = useCallback(() => {
    onSelect('');
    onClose();
  }, []);
  const [current, setCurrent] = useState<string | undefined>(undefined);
  const select = useCallback(
    (id: string) => () => {
      setCurrent(current === id ? undefined : id);
      onSelect(current === id ? undefined : `(post:${id})`);
      onClose();
    },
    [current]
  );
  const { data: loadData } = useSWR('old-posts', fetchOldPosts);
  const data = useMemo(() => {
    if (!only) {
      return loadData;
    }
    return loadData?.filter((p: any) => p.integration.type === only);
  }, [loadData, only]);

  const t = useT();

  return (
    <>
      {!noModal ||
        (data?.length > 0 && (
          <div
            className={
              !noModal
                ? 'text-textColor fixed start-0 top-0 bg-primary/80 z-[300] w-full h-full p-[60px] animate-fade'
                : ''
            }
          >
            <div
              className={
                !noModal
                  ? 'flex flex-col w-full max-w-[1200px] mx-auto h-full bg-sixth border-tableBorder border-2 rounded-xl pb-[20px] px-[20px] relative'
                  : ''
              }
            >
              {!noModal && (
                <div className="flex">
                  <div className="flex-1">
                    <TopTitle
                      title={
                        'Select Post Before ' +
                        date.format('DD/MM/YYYY HH:mm:ss')
                      }
                    />
                  </div>
                  <button
                    onClick={onCloseWithEmptyString}
                    className="outline-none absolute end-[20px] top-[20px] mantine-UnstyledButton-root mantine-ActionIcon-root bg-primary hover:bg-tableBorder cursor-pointer mantine-Modal-close mantine-1dcetaa"
                    type="button"
                  >
                    <HugeIcon name="close" size={16} />
                  </button>
                </div>
              )}
              {!!data && data.length > 0 && (
                <div className="mt-[10px]">
                  <div className="flex flex-row flex-wrap gap-[10px]">
                    {data.map((p: any) => (
                      <div
                        onClick={select(p.id)}
                        className={clsx(
                          'cursor-pointer overflow-hidden flex gap-[20px] flex-col w-[200px] h-[200px] text-ellipsis p-3 border border-tableBorder rounded-[8px] hover:bg-primary',
                          current === p.id ? 'bg-primary' : 'bg-secondary'
                        )}
                        key={p.id}
                      >
                        <div className="flex gap-[10px] items-center">
                          <div className="relative">
                            <img
                              src={p.integration.picture}
                              className="w-[32px] h-[32px] rounded-full"
                            />
                            <img
                              className="w-[20px] h-[20px] rounded-full absolute z-10 -bottom-[5px] -end-[5px] border border-fifth"
                              src={
                                `/icons/platforms/` +
                                p?.integration?.providerIdentifier +
                                '.png'
                              }
                            />
                          </div>
                          <div>{p.integration.name}</div>
                        </div>
                        <div className="flex-1">{removeMd(p.content)}</div>
                        <div>
                          {t('status', 'Status:')}
                          {p.state}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
    </>
  );
};
