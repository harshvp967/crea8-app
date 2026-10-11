'use client';

import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import React, { FC, useCallback, useMemo, useState } from 'react';
import { Button } from '@gitroom/react/form/button';
import { useRouter } from 'next/navigation';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { FieldValues, FormProvider, useForm } from 'react-hook-form';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Input } from '@gitroom/react/form/input';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import clsx from 'clsx';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';

const ThirdPartyMenuComponent: FC<{
  reload: () => void;
  tParty: { id: string; name?: string };
}> = (props) => {
  const { tParty, reload } = props;
  const fetch = useFetch();
  const [show, setShow] = useState(false);
  const t = useT();
  const toaster = useToaster();

  const deleteChannel = (id: string) => async () => {
    setShow(false);
    if (
      !(await deleteDialog('Are you sure you want to delete this integration?'))
    ) {
      return;
    }

    const res = await fetch(`/third-party/${id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      toaster.show('Integration deleted successfully', 'success');
      reload();
    } else {
      const error = await res.json();
      console.error('Error deleting integration:', error);
    }
  };

  return (
    <div
      className="integrations-menu cursor-pointer relative select-none"
      onClick={() => setShow((prev) => !prev)}
      title={tParty.name || undefined}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M13.125 12C13.125 12.2225 13.059 12.44 12.9354 12.625C12.8118 12.81 12.6361 12.9542 12.4305 13.0394C12.225 13.1245 11.9988 13.1468 11.7805 13.1034C11.5623 13.06 11.3618 12.9528 11.2045 12.7955C11.0472 12.6382 10.94 12.4377 10.8966 12.2195C10.8532 12.0012 10.8755 11.775 10.9606 11.5695C11.0458 11.3639 11.19 11.1882 11.375 11.0646C11.56 10.941 11.7775 10.875 12 10.875C12.2984 10.875 12.5845 10.9935 12.7955 11.2045C13.0065 11.4155 13.125 11.7016 13.125 12ZM12 6.75C12.2225 6.75 12.44 6.68402 12.625 6.5604C12.81 6.43679 12.9542 6.26109 13.0394 6.05552C13.1245 5.84995 13.1468 5.62375 13.1034 5.40552C13.06 5.1873 12.9528 4.98684 12.7955 4.82951C12.6382 4.67217 12.4377 4.56503 12.2195 4.52162C12.0012 4.47821 11.775 4.50049 11.5695 4.58564C11.3639 4.67078 11.1882 4.81498 11.0646 4.99998C10.941 5.18499 10.875 5.4025 10.875 5.625C10.875 5.92337 10.9935 6.20952 11.2045 6.4205C11.4155 6.63147 11.7016 6.75 12 6.75ZM12 17.25C11.7775 17.25 11.56 17.316 11.375 17.4396C11.19 17.5632 11.0458 17.7389 10.9606 17.9445C10.8755 18.15 10.8532 18.3762 10.8966 18.5945C10.94 18.8127 11.0472 19.0132 11.2045 19.1705C11.3618 19.3278 11.5623 19.435 11.7805 19.4784C11.9988 19.5218 12.225 19.4995 12.4305 19.4144C12.6361 19.3292 12.8118 19.185 12.9354 19C13.059 18.815 13.125 18.5975 13.125 18.375C13.125 18.0766 13.0065 17.7905 12.7955 17.5795C12.5845 17.3685 12.2984 17.25 12 17.25Z"
          fill="currentColor"
        />
      </svg>
      {show && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="integrations-menu-pop absolute top-[100%] end-0 z-[100] mt-[6px] rounded-[18px] border border-newBorder bg-newBgColorInner p-[8px] text-nowrap shadow-[var(--arc-shadow-floating)]"
        >
          <div
            className="flex items-center gap-[10px] rounded-[12px] px-[10px] py-[8px] text-[13px]"
            onClick={deleteChannel(tParty.id)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path
                d="M13.5 3H11V2.5C11 2.10218 10.842 1.72064 10.5607 1.43934C10.2794 1.15804 9.89782 1 9.5 1H6.5C6.10218 1 5.72064 1.15804 5.43934 1.43934C5.15804 1.72064 5 2.10218 5 2.5V3H2.5C2.36739 3 2.24021 3.05268 2.14645 3.14645C2.05268 3.24021 2 3.36739 2 3.5C2 3.63261 2.05268 3.75979 2.14645 3.85355C2.24021 3.94732 2.36739 4 2.5 4H3V13C3 13.2652 3.10536 13.5196 3.29289 13.7071C3.48043 13.8946 3.73478 14 4 14H12C12.2652 14 12.5196 13.8946 12.7071 13.7071C12.8946 13.5196 13 13.2652 13 13V4H13.5C13.6326 4 13.7598 3.94732 13.8536 3.85355C13.9473 3.75979 14 3.63261 14 3.5C14 3.36739 13.9473 3.24021 13.8536 3.14645C13.7598 3.05268 13.6326 3 13.5 3ZM6 2.5C6 2.36739 6.05268 2.24021 6.14645 2.14645C6.24021 2.05268 6.36739 2 6.5 2H9.5C9.63261 2 9.75979 2.05268 9.85355 2.14645C9.94732 2.24021 10 2.36739 10 2.5V3H6V2.5ZM12 13H4V4H12V13ZM7 6.5V10.5C7 10.6326 6.94732 10.7598 6.85355 10.8536C6.75979 10.9473 6.63261 11 6.5 11C6.36739 11 6.24021 10.9473 6.14645 10.8536C6.05268 10.7598 6 10.6326 6 10.5V6.5C6 6.36739 6.05268 6.24021 6.14645 6.14645C6.24021 6.05268 6.36739 6 6.5 6C6.63261 6 6.75979 6.05268 6.85355 6.14645C6.94732 6.24021 7 6.36739 7 6.5ZM10 6.5V10.5C10 10.6326 9.94732 10.7598 9.85355 10.8536C9.75979 10.9473 9.63261 11 9.5 11C9.36739 11 9.24021 10.9473 9.14645 10.8536C9.05268 10.7598 9 10.6326 9 10.5V6.5C9 6.36739 9.05268 6.24021 9.14645 6.14645C9.24021 6.05268 9.36739 6 9.5 6C9.63261 6 9.75979 6.05268 9.85355 6.14645C9.94732 6.24021 10 6.36739 10 6.5Z"
                fill="currentColor"
              />
            </svg>
            <span>{t('delete_integration', 'Delete Integration')}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export const ApiModal: FC<{
  identifier: string;
  title: string;
  update: () => void;
}> = (props) => {
  const { identifier, update } = props;
  const fetch = useFetch();
  const router = useRouter();
  const modal = useModals();
  const toaster = useToaster();
  const [loading, setLoading] = useState(false);
  const closePopup = useCallback(() => {
    modal.closeAll();
  }, []);

  const methods = useForm({
    mode: 'onChange',
  });

  const submit = useCallback(
    async (data: FieldValues) => {
      setLoading(true);
      const add = await fetch(`/third-party/${identifier}`, {
        method: 'POST',
        body: JSON.stringify({
          api: data.api,
        }),
      });

      if (add.ok) {
        toaster.show('Integration added successfully', 'success');
        if (closePopup) {
          closePopup();
        } else {
          modal.closeAll();
        }
        router.refresh();
        if (update) update();
        return;
      }

      const { message } = await add.json();

      methods.setError('api', {
        message,
      });

      setLoading(false);
    },
    [props]
  );

  const t = useT();

  return (
    <div className="relative">
      <FormProvider {...methods}>
        <form
          className="integrations-form gap-[8px] flex flex-col"
          onSubmit={methods.handleSubmit(submit)}
        >
          <div className="pt-[10px]">
            <Input label="API Key" name="api" />
          </div>
          <div className="integrations-submit">
            <Button loading={loading} type="submit">
              {t('add_integration', 'Add Integration')}
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
};

const IntegrationMark: FC<{ identifier: string; title: string }> = ({
  identifier,
  title,
}) => {
  const [failed, setFailed] = useState(false);
  const letter = (title || identifier || '?').trim().charAt(0).toUpperCase();
  if (failed || !identifier) {
    return <span className="integrations-letter">{letter}</span>;
  }
  return (
    <img
      className="integrations-icon"
      alt=""
      src={`/icons/third-party/${identifier}.png`}
      onError={() => setFailed(true)}
    />
  );
};

export const ThirdPartyListComponent: FC<{
  reload: () => void;
  saved: any[];
}> = (props) => {
  const fetch = useFetch();
  const modals = useModals();
  const t = useT();
  const { reload, saved } = props;

  const integrationsList = useCallback(async () => {
    return (await fetch('/third-party/list')).json();
  }, []);

  const { data, isLoading } = useSWR('third-party-list', integrationsList, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
  });

  const addApiKey = useCallback(
    (title: string, identifier: string) => () => {
      modals.openModal({
        title: `Add API key for ${title}`,
        size: '500px',
        children: (
          <ApiModal identifier={identifier} title={title} update={reload} />
        ),
      });
    },
    []
  );

  const connectedLabel = t('connected', 'Connected:').replace(/:\s*$/, '');

  const cards = useMemo(() => {
    const catalog = Array.isArray(data) ? data : [];
    const savedList = Array.isArray(saved) ? saved : [];
    const known = new Set(catalog.map((item: any) => item.identifier));
    const extras = savedList.filter((item) => !known.has(item.identifier));
    return [
      ...catalog.map((item: any) => ({
        key: item.identifier,
        identifier: item.identifier,
        title: item.title,
        description: item.description,
        canAdd: true,
        saved: savedList.filter((row) => row.identifier === item.identifier),
      })),
      ...extras.map((item) => ({
        key: item.id,
        identifier: item.identifier,
        title: item.title || item.name,
        description: item.description || '',
        canAdd: false,
        saved: [item],
      })),
    ];
  }, [data, saved]);

  if (isLoading && !data) {
    return <LoadingComponent />;
  }

  if (!cards.length) {
    return (
      <div className="integrations-empty">
        <h2>No Integrations Yet</h2>
      </div>
    );
  }

  return (
    <div className="integrations-grid">
      {cards.map((card) => {
        const connected = card.saved.length > 0;
        return (
          <article
            key={card.key}
            className={clsx('integrations-card', connected && 'is-on')}
          >
            <div className="integrations-card-head">
              <span className="integrations-mark">
                <IntegrationMark identifier={card.identifier} title={card.title} />
              </span>
              <h3>{card.title}</h3>
              {connected && (
                <span className="integrations-badge">
                  <i />
                  {connectedLabel}
                </span>
              )}
              {card.saved.map((row: any) => (
                <ThirdPartyMenuComponent
                  key={row.id}
                  reload={reload}
                  tParty={row}
                />
              ))}
            </div>
            {card.description ? <p>{card.description}</p> : null}
            {card.canAdd && (
              <Button
                secondary
                className="integrations-add"
                onClick={addApiKey(card.title, card.identifier)}
              >
                <span className="integrations-add-label">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M7 1.75v10.5M1.75 7h10.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                  {t('add', 'Add')}
                </span>
              </Button>
            )}
          </article>
        );
      })}
    </div>
  );
};
