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
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';

export const IntegrationsSkeleton = () => (
  <div className="integrations-skeleton" role="status">
    <span className="sr-only">Loading</span>
    <div className="integrations-skel-card">
      <span className="integrations-skel-row" />
      <span className="integrations-skel-row" />
      <span className="integrations-skel-row" />
    </div>
  </div>
);

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
      <HugeIcon name="more-v" size={20} />
      {show && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="integrations-menu-pop absolute top-[100%] end-0 z-[100] mt-[6px] rounded-[18px] border border-newBorder bg-newBgColorInner p-[8px] text-nowrap shadow-[var(--arc-shadow-floating)]"
        >
          <div
            className="flex items-center gap-[10px] rounded-[12px] px-[10px] py-[8px] text-[13px]"
            onClick={deleteChannel(tParty.id)}
          >
            <HugeIcon name="trash" size={16} />
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
    return <IntegrationsSkeleton />;
  }

  if (!cards.length) {
    return (
      <div className="integrations-empty">
        <span className="integrations-state-tile" aria-hidden="true">
          <HugeIcon name="puzzle" size={25} />
        </span>
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
            </div>
            {card.description ? <p>{card.description}</p> : null}
            <div className="integrations-actions">
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
              {card.canAdd && (
                <Button
                  secondary
                  className="integrations-add"
                  onClick={addApiKey(card.title, card.identifier)}
                >
                  <span className="integrations-add-label">
                    <HugeIcon name="plus" size={18} />
                    {t('connect', 'Connect')}
                  </span>
                </Button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
};
