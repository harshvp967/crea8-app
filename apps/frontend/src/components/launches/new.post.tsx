import React, { useCallback, useEffect, useRef } from 'react';
import clsx from 'clsx';
import dynamic from 'next/dynamic';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import {
  Integrations,
  useCalendar,
} from '@gitroom/frontend/components/launches/calendar.context';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { SetSelectionModal } from '@gitroom/frontend/components/launches/calendar';
import { ComposerModal } from '@gitroom/frontend/components/new-launch/composer.modal';
import { composerChannels } from '@gitroom/frontend/components/launches/customer.filter';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
const IdeaPostsButton = dynamic(
  () =>
    import('@gitroom/frontend/components/launches/idea.posts').then(
      (mod) => mod.IdeaPostsButton
    ),
  { ssr: false }
);
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
      <ComposerModal
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
      />
    ),
    size: '80%',
    title: ``,
  });
};

const SidebarComposer = ({
  customer,
  onReady,
}: {
  customer: string | null;
  onReady: (integrations: Integrations[], sets: any[]) => void;
}) => {
  const fetch = useFetch();
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [listResponse, setsResponse] = await Promise.all([
        fetch('/integrations/list'),
        fetch('/sets'),
      ]);
      const list = await listResponse.json();
      const sets = await setsResponse.json();
      if (cancelled) {
        return;
      }
      readyRef.current(
        (Array.isArray(list) ? list : list?.integrations || []) as Integrations[],
        Array.isArray(sets) ? sets : []
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [fetch]);
  return (
    <div className="min-h-[160px] rounded-[20px] bg-newBgColorInner animate-pulse" role="status">
      <span className="sr-only">Loading</span>
    </div>
  );
};

export const useOpenComposer = () => {
  const fetch = useFetch();
  const modal = useModals();
  const t = useT();

  return useCallback(() => {
    const customer =
      typeof window === 'undefined'
        ? null
        : new URLSearchParams(window.location.search).get('customer');
    modal.openModal({
      id: 'composer-boot',
      title: '',
      withCloseButton: false,
      closeOnClickOutside: false,
      closeOnEscape: true,
      size: '420px',
      classNames: {
        modal: 'text-textColor',
      },
      children: (
        <SidebarComposer
          customer={customer}
          onReady={(integrations, sets) => {
            modal.closeById('composer-boot');
            return openCreatePost({
              fetch,
              modal,
              t,
              integrations,
              customer,
              sets,
              reload: () => {
                mutate(
                  (key) =>
                    typeof key === 'string' &&
                    (key.startsWith('/posts') || key === 'sets')
                );
              },
            });
          }}
        />
      ),
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
