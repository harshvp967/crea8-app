'use client';

import React, { FC, useCallback, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { Button } from '@gitroom/react/form/button';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { Input } from '@gitroom/react/form/input';
import { Checkbox } from '@gitroom/react/form/checkbox';
import { FormProvider, useForm } from 'react-hook-form';
import { array, object, string } from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { Select } from '@gitroom/react/form/select';
import { PickPlatforms } from '@gitroom/frontend/components/launches/helpers/pick.platform.component';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import {
  SCHEDULE_WEBHOOK_EVENTS,
  WEBHOOK_EVENTS,
  WebhookEventName,
} from '@gitroom/nestjs-libraries/database/prisma/webhooks/webhook.events';
import { webhookQuota } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';

const EVENT_COPY: Record<WebhookEventName, { key: string; label: string }> = {
  'post.published': {
    key: 'webhook_event_post_published',
    label: 'Schedule post published',
  },
  'post.failed': {
    key: 'webhook_event_post_failed',
    label: 'Schedule post failed',
  },
  'stalker.match': {
    key: 'webhook_event_stalker_match',
    label: 'Stalker new match',
  },
  'link.click': {
    key: 'webhook_event_link_click',
    label: 'Link in Bio link click',
  },
  'link.submission': {
    key: 'webhook_event_link_submission',
    label: 'Link in Bio form submission',
  },
};

const knownEvents = (events: readonly string[] | null | undefined) => {
  if (events == null) return [...SCHEDULE_WEBHOOK_EVENTS];
  return WEBHOOK_EVENTS.filter((event) => events.includes(event));
};

export const Webhooks: FC = () => {
  const fetch = useFetch();
  const user = useUser();
  const modal = useModals();
  const toaster = useToaster();
  const t = useT();
  const list = useCallback(async () => {
    return (await fetch('/webhooks')).json();
  }, []);
  const { data, mutate } = useSWR('webhooks', list);
  const addWebhook = useCallback(
    (data?: any) => () => {
      modal.openModal({
        title: data ? t('update_webhook', 'Update webhook') : t('add_webhook', 'Add webhook'),
        withCloseButton: true,
        size: '500px',
        children: <AddOrEditWebhook data={data} reload={mutate} />,
      });
    },
    [t]
  );
  const deleteHook = useCallback(
    (data: any) => async () => {
      if (
        await deleteDialog(
          t('cant_be_undone', "This can't be undone."),
          t('delete', 'Delete'),
          t('delete_named', 'Delete {{name}}?', { name: data.name }),
          t('cancel', 'Cancel')
        )
      ) {
        await fetch(`/webhooks/${data.id}`, {
          method: 'DELETE',
        });
        mutate();
        toaster.show(t('webhook_deleted_successfully', 'Webhook deleted successfully'), 'success');
      }
    },
    []
  );

  return (
    <div className="settings-section">
      <div className="settings-head">
        <div>
          <h1>
            {t('webhooks', 'Webhooks')} ({webhookQuota(data?.length || 0, user?.tier?.webhooks)})
          </h1>
        </div>
        <Button onClick={addWebhook()}>
          + {t('add_a_webhook', 'Add a webhook')}
        </Button>
      </div>
      {!!data?.length && (
        <div className="settings-list">
          <div className="settings-cols cols-hook">
            <span>{t('name', 'Name')}</span>
            <span>{t('url', 'URL')}</span>
            <span />
          </div>
          {data.map((p: any) => {
            const summary = knownEvents(p.events)
              .map((event) => t(EVENT_COPY[event].key, EVENT_COPY[event].label))
              .join(' · ');
            return (
              <article key={p.id} className="settings-item cols-hook">
                <span className="settings-tile" aria-hidden="true">
                  <HugeIcon name="send" size={18} />
                </span>
                <div className="settings-copy">
                  <b>{p.name}</b>
                  <span className="settings-muted" data-label={t('url', 'URL')}>
                    {p.url}
                    {summary ? (
                      <span className="block webhook-events">{summary}</span>
                    ) : null}
                    {p.signingSecret ? (
                      <span className="block">
                        {t('signing_secret', 'Signing secret')}: {p.signingSecret}
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="settings-item-actions">
                  <Button secondary className="settings-mini" onClick={addWebhook(p)}>
                    {t('edit', 'Edit')}
                  </Button>
                  <Button secondary className="settings-mini settings-danger" onClick={deleteHook(p)}>
                    {t('delete', 'Delete')}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
const details = object().shape({
  name: string().required(),
  url: string().url().required(),
  integrations: array(),
});
const getWebhookOptions = (t: (key: string, fallback: string) => string) => [
  {
    label: t('all_integrations', 'All integrations'),
    value: 'all',
  },
  {
    label: t('specific_integrations', 'Specific integrations'),
    value: 'specific',
  },
];
export const AddOrEditWebhook: FC<{
  data?: any;
  reload: () => void;
}> = (props) => {
  const { data, reload } = props;
  const fetch = useFetch();
  const t = useT();
  const options = getWebhookOptions(t);
  const [allIntegrations, setAllIntegrations] = useState(
    (data?.integrations?.length || 0) > 0 ? options[1] : options[0]
  );
  const modal = useModals();
  const toast = useToaster();
  const [events, setEvents] = useState<WebhookEventName[]>(() =>
    knownEvents(data?.events)
  );
  const toggleEvent = useCallback(
    (event: { target: { name?: string; value: boolean } }) => {
      const name = event.target.name;
      if (!name || !WEBHOOK_EVENTS.includes(name as WebhookEventName)) return;
      setEvents((current) => {
        const next = new Set(current);
        if (event.target.value) next.add(name as WebhookEventName);
        else next.delete(name as WebhookEventName);
        return WEBHOOK_EVENTS.filter((item) => next.has(item));
      });
    },
    []
  );
  const form = useForm({
    resolver: yupResolver(details),
    values: {
      name: data?.name || '',
      url: data?.url || '',
      integrations: data?.integrations?.map((p: any) => p.integration) || [],
    },
  });
  const integrations = form.watch('integrations');
  const integration = useCallback(async () => {
    return (await fetch('/integrations/list')).json();
  }, []);
  const changeIntegration = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const findValue = options.find(
        (option) => option.value === e.target.value
      )!;
      setAllIntegrations(findValue);
      if (findValue.value === 'all') {
        form.setValue('integrations', []);
      }
    },
    []
  );
  const { data: dataList, isLoading } = useSWR('integrations', integration, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
  });
  const callBack = useCallback(
    async (values: any) => {
      const body: Record<string, unknown> = {
        ...(data?.id
          ? {
              id: data.id,
            }
          : {}),
        ...values,
      };
      // An empty selection is omitted. Create then keeps the Schedule default
      // and update keeps the stored events.
      if (events.length) {
        body.events = events;
      }
      await fetch('/webhooks', {
        method: data?.id ? 'PUT' : 'POST',
        body: JSON.stringify(body),
      });
      toast.show(
        data?.id
          ? t('webhook_updated_successfully', 'Webhook updated successfully')
          : t('webhook_added_successfully', 'Webhook added successfully'),
        'success'
      );
      modal.closeAll();
      reload();
    },
    [data, integrations, events]
  );
  const sendTest = useCallback(async () => {
    const url = form.getValues('url');
    toast.show(t('webhook_sent', 'Webhook send'), 'success');
    try {
      await fetch(`/webhooks/send?url=${encodeURIComponent(url)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          {
            id: 'cm6tcts4f0005qcwit25cis26',
            content: 'This is the first post to instagram',
            publishDate: '2025-02-06T13:09:00.000Z',
            releaseURL: 'https://facebook.com/release/release',
            state: 'PUBLISHED',
            integration: {
              id: 'cm6s4uyou0001i2r47pxix6z1',
              name: 'test',
              providerIdentifier: 'instagram',
              picture: 'https://uploads.gitroom.com/F6LSCD8wrrQ.jpeg',
              type: 'social',
            },
          },
          {
            id: 'cm6tcts4f0005qcwit25cis26',
            content: 'This is the second post to facebook',
            publishDate: '2025-02-06T13:09:00.000Z',
            releaseURL: 'https://facebook.com/release2/release2',
            state: 'PUBLISHED',
            integration: {
              id: 'cm6s4uyou0001i2r47pxix6z1',
              name: 'test2',
              providerIdentifier: 'facebook',
              picture: 'https://uploads.gitroom.com/F6LSCD8wrrQ.jpeg',
              type: 'social',
            },
          },
        ]),
      });
    } catch (e: any) {
      /** empty **/
    }
  }, []);

  return (
    <FormProvider {...form}>
      <form className="settings-form" onSubmit={form.handleSubmit(callBack)}>
        <div className="relative flex gap-[20px] flex-col flex-1 rounded-[4px] pt-0">
          <div>
            <Input
              label="Name"
              translationKey="label_name"
              {...form.register('name')}
            />
            <Input
              label="URL"
              translationKey="label_url"
              {...form.register('url')}
            />
            <Select
              value={allIntegrations.value}
              name="integrations"
              label="Integrations"
              translationKey="label_integrations"
              disableForm={true}
              onChange={changeIntegration}
            >
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            {allIntegrations.value === 'specific' && dataList && !isLoading && (
              <PickPlatforms
                integrations={dataList.integrations}
                selectedIntegrations={integrations as any[]}
                onChange={(e) => form.setValue('integrations', e)}
                singleSelect={false}
                toolTip={true}
                isMain={true}
              />
            )}
            <div className="flex flex-col gap-[6px] min-w-0">
              <div className="text-[14px]">{t('webhook_events', 'Events')}</div>
              <div
                className="flex flex-col gap-[10px] min-w-0"
                role="group"
                aria-label={t('webhook_events', 'Events')}
              >
                {WEBHOOK_EVENTS.map((event) => (
                  <Checkbox
                    key={event}
                    name={event}
                    disableForm
                    checked={events.includes(event)}
                    label={t(EVENT_COPY[event].key, EVENT_COPY[event].label)}
                    onChange={toggleEvent}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-[10px]">
              <Button
                type="submit"
                className="mt-[24px]"
                disabled={
                  !form.formState.isValid ||
                  (allIntegrations.value === 'specific' &&
                    !integrations?.length)
                }
              >
                {t('save', 'Save')}
              </Button>
              <Button
                type="button"
                secondary={true}
                className="mt-[24px]"
                onClick={sendTest}
                disabled={
                  !form.formState.isValid ||
                  (allIntegrations.value === 'specific' &&
                    !integrations?.length)
                }
              >
                {t('send_test', 'Send Test')}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </FormProvider>
  );
};
