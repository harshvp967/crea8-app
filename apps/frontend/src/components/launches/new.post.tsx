import React, { useCallback } from 'react';
import clsx from 'clsx';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import dayjs from 'dayjs';
import {
  Integrations,
  useCalendar,
} from '@gitroom/frontend/components/launches/calendar.context';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { SetSelectionModal } from '@gitroom/frontend/components/launches/calendar';
import { AddEditModal } from '@gitroom/frontend/components/new-launch/add.edit.modal';
import { composerChannels } from '@gitroom/frontend/components/launches/customer.filter';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { IdeaPostsButton } from '@gitroom/frontend/components/launches/idea.posts';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { mutate } from 'swr';

export const openCreatePost = async ({
  fetch,
  modal,
  t,
  integrations,
  sets,
  reload,
  customer,
}: {
  fetch: ReturnType<typeof useFetch>;
  modal: ReturnType<typeof useModals>;
  t: ReturnType<typeof useT>;
  integrations: Integrations[];
  sets: any[];
  reload: () => void;
  customer?: string | null;
}) => {
  const date = (await (await fetch('/posts/find-slot')).json()).date;
  const again = () =>
    openCreatePost({ fetch, modal, t, integrations, sets, reload, customer });
  const channels = composerChannels({
    catalog: integrations,
    customer,
  });

  const set: any = !sets.length
    ? undefined
    : await new Promise((resolve) => {
        modal.openModal({
          title: t('select_set', 'Select a Set'),
          closeOnClickOutside: true,
          closeOnEscape: true,
          withCloseButton: false,
          onClose: () => resolve('exit'),
          classNames: {
            modal: 'po-set-modal text-textColor',
          },
          children: (
            <SetSelectionModal
              sets={sets}
              onSelect={(selectedSet) => {
                resolve(selectedSet);
                modal.closeAll();
              }}
              onContinueWithoutSet={() => {
                resolve(undefined);
                modal.closeAll();
              }}
            />
          ),
        });
      });

  if (set === 'exit') return;

  modal.openModal({
    id: 'add-edit-modal',
    closeOnClickOutside: false,
    removeLayout: true,
    closeOnEscape: false,
    withCloseButton: false,
    askClose: true,
    fullScreen: true,
    classNames: {
      modal: 'w-[100%] max-w-[1400px] text-textColor',
    },
    children: (
      <AddEditModal
        allIntegrations={channels.allIntegrations.map((p) => ({
          ...p,
        }))}
        {...(set?.content ? { set: JSON.parse(set.content) } : {})}
        {...(channels.selectedChannels && !set
          ? { selectedChannels: channels.selectedChannels }
          : {})}
        customer={customer || undefined}
        reopenModal={again}
        mutate={reload}
        integrations={channels.allIntegrations}
        date={dayjs.utc(date).local()}
      />
    ),
    size: '80%',
    title: ``,
  });
};

export const useOpenComposer = () => {
  const fetch = useFetch();
  const modal = useModals();
  const t = useT();

  return useCallback(async () => {
    const [listResponse, setsResponse] = await Promise.all([
      fetch('/integrations/list'),
      fetch('/sets'),
    ]);
    const list = await listResponse.json();
    const sets = await setsResponse.json();
    const integrations = (
      Array.isArray(list) ? list : list?.integrations || []
    ) as Integrations[];
    const customer =
      typeof window === 'undefined'
        ? null
        : new URLSearchParams(window.location.search).get('customer');
    await openCreatePost({
      fetch,
      modal,
      t,
      integrations,
      customer,
      sets: Array.isArray(sets) ? sets : [],
      reload: () => {
        mutate(
          (key) =>
            typeof key === 'string' &&
            (key.startsWith('/posts') || key === 'sets')
        );
      },
    });
  }, [fetch, modal, t]);
};

export const NewPost = ({ presentation = 'inline' }: { presentation?: 'inline' | 'floating' }) => {
  const fetch = useFetch();
  const modal = useModals();
  const user = useUser();
  const { allIntegrations, customer, reloadCalendarView, sets } = useCalendar();
  const t = useT();

  const createAPost = useCallback(
    () =>
      openCreatePost({
        fetch,
        modal,
        t,
        integrations: allIntegrations,
        customer,
        sets,
        reload: reloadCalendarView,
      }),
    [fetch, modal, t, allIntegrations, customer, sets, reloadCalendarView]
  );
  return (
    <div className={clsx('c8-create', user?.aiDrafts && 'is-split')}>
      <button
        onClick={createAPost}
        className={clsx(
          'text-[#0A0A0A] flex-1 pt-[12px] pb-[14px] ps-[16px] pe-[20px] group-[.sidebar]:p-0 min-h-[44px] max-h-[44px] rounded-[18px] bg-btnPrimary flex justify-center items-center gap-[5px] outline-none',
          presentation === 'floating' && 'phone-create-btn'
        )}
      >
        <HugeIcon name="plus" size={20} className="min-w-[21px] min-h-[20px]" />
        <div className="flex-1 text-start text-[14px] group-[.sidebar]:hidden">
          {t('create_new_post', 'Create post')}
        </div>
      </button>
      <IdeaPostsButton customer={customer} reload={reloadCalendarView} />
    </div>
  );
};
