'use client';

import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { FC, useCallback, useState } from 'react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { useClickAway } from '@uidotdev/usehooks';
import ReactLoading from '@gitroom/frontend/components/layout/loading';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
function replaceLinks(text: string) {
  const urlRegex =
    /(\bhttps?:\/\/[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%=~_|])/gi;
  return text.replace(
    urlRegex,
    '<a class="cursor-pointer underline font-bold" target="_blank" href="$1">$1</a>'
  );
}
export const ShowNotification: FC<{
  notification: {
    createdAt: string;
    content: string;
  };
  lastReadNotification: string;
}> = (props) => {
  const { notification } = props;
  const [newNotification] = useState(
    new Date(notification.createdAt) > new Date(props.lastReadNotification)
  );
  const createdAt = dayjs(notification.createdAt);
  const isWithin24h = dayjs().diff(createdAt, 'hour') < 24;
  const fullDate = createdAt.format('MMM D, YYYY h:mm A');
  return (
    <div
      className={clsx(
        `text-textColor px-[16px] py-[10px] border-b border-tableBorder last:border-b-0 transition-colors`,
        newNotification && 'font-[500] bg-[var(--arc-selected)] text-[color:var(--arc-accent-text)]'
      )}
    >
      <div
        className="break-words"
        dangerouslySetInnerHTML={{
          __html: replaceLinks(notification.content),
        }}
      />
      <div
        className="text-[11px] mt-[4px] opacity-60 font-normal"
        title={isWithin24h ? fullDate : undefined}
      >
        {isWithin24h ? createdAt.fromNow() : fullDate}
      </div>
    </div>
  );
};
export const NotificationOpenComponent = () => {
  const fetch = useFetch();
  const loadNotifications = useCallback(async () => {
    return await (await fetch('/notifications/list')).json();
  }, []);
  const t = useT();

  const { data, isLoading } = useSWR('notifications', loadNotifications);
  return (
    <div
      id="notification-popup"
        className="notify-panel opacity-0 animate-normalFadeDown mt-[10px] absolute w-[min(420px,calc(100vw-24px))] min-h-[200px] top-[100%] end-0 bg-newBgColorInner text-textColor rounded-[26px] flex flex-col border border-newBorder z-[600] shadow-[var(--menu-shadow)]"
    >
      <div
        className="p-[16px] border-b border-newBorder font-[600] text-[16px]"
      >
        {t('notifications', 'Notifications')}
      </div>

      <div className="flex flex-col max-h-[400px] overflow-y-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor">
        {isLoading && (
          <div className="flex-1 flex justify-center pt-12">
            <ReactLoading type="spin" color="#fff" width={36} height={36} />
          </div>
        )}
        {!isLoading && !data.notifications.length && (
          <div className="text-center p-[16px] text-textColor flex-1 flex justify-center items-center mt-[20px]">
            {t('no_notifications', 'No notifications')}
          </div>
        )}
        {!isLoading &&
          data.notifications.map(
            (
              notification: {
                createdAt: string;
                content: string;
              },
              index: number
            ) => (
              <ShowNotification
                notification={notification}
                lastReadNotification={data.lastReadNotifications}
                key={`notifications_${index}`}
              />
            )
          )}
      </div>
    </div>
  );
};
const NotificationComponent = () => {
  const fetch = useFetch();
  const [show, setShow] = useState(false);
  const loadNotifications = useCallback(async () => {
    return await (await fetch('/notifications')).json();
  }, []);
  const { data, mutate } = useSWR('notifications-list', loadNotifications);
  const changeShow = useCallback(() => {
    mutate(
      {
        ...data,
        total: 0,
      },
      {
        revalidate: false,
      }
    );
    setShow(!show);
  }, [show, data]);
  const ref = useClickAway<HTMLDivElement>(() => setShow(false));
  return (
    <div className="relative cursor-pointer select-none flex items-center justify-center w-[38px] h-[38px] rounded-[14px] transition-colors text-textItemBlur hover:text-newTextColor hover:bg-[var(--arc-selected)]" ref={ref}>
      <div className="relative" onClick={changeShow}>
        <HugeIcon name="bell" size={20} />
        {data && data.total > 0 ? (
          <span className="pointer-events-none absolute end-0 top-0 block h-[8px] w-[8px] rounded-full border-2 border-[#1A1919] bg-[#00D9FF]" />
        ) : null}
      </div>
      {show && <NotificationOpenComponent />}
    </div>
  );
};
export default NotificationComponent;
