'use client';

import React, { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useCalendar } from '@gitroom/frontend/components/launches/calendar.context';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { Button } from '@gitroom/react/form/button';
import { Textarea } from '@gitroom/react/form/textarea';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { plainToPostHtml } from '@gitroom/nestjs-libraries/database/prisma/posts/idea.posts';

dayjs.extend(utc);

type Draft = {
  integrationId: string;
  provider: string;
  name: string;
  content: string;
  publishAt: string;
  settings: Record<string, string | boolean>;
  error?: string;
  saved?: boolean;
};

function toLocalInput(value: string) {
  const parsed = dayjs.utc(value);
  return parsed.isValid() ? parsed.local().format('YYYY-MM-DDTHH:mm') : '';
}

function toUtc(value: string) {
  return dayjs(value).utc().format('YYYY-MM-DDTHH:mm:ss');
}

async function readMessage(response: Response) {
  const data = await response.clone().json().catch(() => ({}));
  const message = data?.message;
  if (typeof message === 'string' && message) {
    return message;
  }
  if (Array.isArray(message) && message.length) {
    return message
      .map((item) => (typeof item === 'string' ? item : item?.message))
      .filter(Boolean)
      .join(' ');
  }
  return '';
}

const IdeaPostsPanel = ({
  customer,
  reload,
}: {
  customer?: string | null;
  reload: () => void;
}) => {
  const fetch = useFetch();
  const t = useT();
  const toaster = useToaster();
  const { closeCurrent } = useModals();
  const [idea, setIdea] = useState('');
  const [used, setUsed] = useState<number | null>(null);
  const [limit, setLimit] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [upgrade, setUpgrade] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await fetch('/idea-posts');
      const data = await response.json().catch(() => ({}));
      if (cancelled) {
        return;
      }
      if (!response.ok) {
        setError(
          (typeof data?.message === 'string' && data.message) ||
            t('idea_not_available', 'Not available')
        );
        return;
      }
      setUsed(data.used ?? 0);
      setLimit(data.limit ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetch, t]);

  const draft = useCallback(async () => {
    setError('');
    setUpgrade('');
    setLoading(true);
    try {
      const response = await fetch('/idea-posts', {
        method: 'POST',
        body: JSON.stringify({
          idea,
          ...(customer ? { customer } : {}),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          (typeof data?.message === 'string' && data.message) ||
            t(
              'idea_draft_failed',
              'Could not draft posts. Try again. Scheduling still works.'
            )
        );
        return;
      }
      if (typeof data.used === 'number') {
        setUsed(data.used);
      }
      if (typeof data.limit === 'number') {
        setLimit(data.limit);
      }
      if (data.limited) {
        setUpgrade(
          data.message ||
            t(
              'idea_upgrade',
              "You've used this month's AI posts. Upgrade crea8.one to draft more."
            )
        );
        setDrafts([]);
        return;
      }
      if (data.error) {
        setError(data.error);
        return;
      }
      setDrafts(
        (data.drafts || []).map((item: Draft) => ({
          ...item,
          publishAt: toLocalInput(item.publishAt),
          settings: item.settings || {},
        }))
      );
    } catch {
      setError(
        t(
          'idea_draft_failed',
          'Could not draft posts. Try again. Scheduling still works.'
        )
      );
    } finally {
      setLoading(false);
    }
  }, [customer, fetch, idea, t]);

  const addAll = useCallback(async () => {
    setSaving(true);
    let saved = 0;
    const next = [...drafts];
    for (let index = 0; index < next.length; index++) {
      const item = next[index];
      if (item.saved) {
        saved += 1;
        continue;
      }
      try {
        const date = toUtc(item.publishAt);
        const response = await fetch('/posts', {
          method: 'POST',
          body: JSON.stringify({
            type: 'schedule',
            shortLink: false,
            tags: [],
            date,
            posts: [
              {
                integration: { id: item.integrationId },
                group: makeId(10),
                date,
                settings: item.settings || {},
                value: [
                  {
                    content: plainToPostHtml(item.content),
                    delay: 0,
                    image: [],
                  },
                ],
              },
            ],
          }),
        });
        if (!response.ok) {
          next[index] = {
            ...item,
            error:
              (await readMessage(response)) ||
              t(
                'idea_schedule_failed',
                'Could not add this one. The rest of the calendar still works.'
              ),
          };
          continue;
        }
        next[index] = { ...item, saved: true, error: '' };
        saved += 1;
      } catch {
        next[index] = {
          ...item,
          error: t(
            'idea_schedule_failed',
            'Could not add this one. The rest of the calendar still works.'
          ),
        };
      }
    }
    setDrafts(next);
    setSaving(false);
    if (saved) {
      reload();
      toaster.show(t('added_successfully', 'Added successfully'));
    }
    if (saved && next.every((item) => item.saved)) {
      closeCurrent();
    }
  }, [closeCurrent, drafts, fetch, reload, t, toaster]);

  return (
    <div className="flex flex-col gap-[12px] font-c8-body text-c8-ink">
      <p className="text-c8-body text-c8-muted">
        {t(
          'one_idea_help',
          'Type one idea, or paste one link. You get a draft for each connected channel.'
        )}
      </p>
      {used !== null && limit !== null && (
        <p className="text-c8-caption text-c8-muted">
          {t('ai_posts_used', 'AI posts used: {{used}} of {{limit}}', {
            used,
            limit,
          })}
        </p>
      )}
      <Textarea
        label={t('your_idea', 'Your idea')}
        name="idea"
        disableForm
        value={idea}
        onChange={(event) => setIdea(event.target.value)}
      />
      {!!upgrade && <p className="text-c8-body text-c8-warn">{upgrade}</p>}
      {!!error && <p className="text-c8-body text-c8-danger">{error}</p>}
      <div>
        <Button
          type="button"
          loading={loading}
          disabled={loading || idea.trim().length < 3}
          onClick={draft}
        >
          {t('draft_for_each_channel', 'Draft for each channel')}
        </Button>
      </div>
      {drafts.map((item, index) => (
        <div
          key={item.integrationId}
          className="flex flex-col gap-[8px] rounded-[18px] border border-c8-line bg-c8-surface p-[12px]"
        >
          <div className="text-c8-label">
            {item.name}
            <span className="text-c8-muted font-normal"> · {item.provider}</span>
          </div>
          <Textarea
            label={t('draft', 'Draft')}
            name={`draft-${item.integrationId}`}
            disableForm
            className="!min-h-[88px]"
            value={item.content}
            onChange={(event) => {
              const value = event.target.value;
              setDrafts((current) =>
                current.map((row, rowIndex) =>
                  rowIndex === index ? { ...row, content: value, saved: false } : row
                )
              );
            }}
          />
          <label className="flex flex-col gap-[6px] text-[14px]">
            {t('posting_time', 'Posting time')}
            <input
              type="datetime-local"
              value={item.publishAt}
              onChange={(event) => {
                const value = event.target.value;
                setDrafts((current) =>
                  current.map((row, rowIndex) =>
                    rowIndex === index
                      ? { ...row, publishAt: value, saved: false }
                      : row
                  )
                );
              }}
              className="bg-newBgColorInner border border-newBorder rounded-[18px] px-[12px] py-[10px] text-textColor"
            />
          </label>
          {!!item.error && <p className="text-c8-caption text-c8-danger">{item.error}</p>}
          {!!item.saved && (
            <p className="text-c8-caption text-c8-positive">
              {t('added_successfully', 'Added successfully')}
            </p>
          )}
        </div>
      ))}
      {!!drafts.length && (
        <div>
          <Button
            type="button"
            secondary
            loading={saving}
            disabled={saving || drafts.every((item) => item.saved)}
            onClick={addAll}
          >
            {t('add_all_to_calendar', 'Add all to calendar')}
          </Button>
        </div>
      )}
    </div>
  );
};

export const IdeaPostsButton = ({
  presentation = 'inline',
}: {
  presentation?: 'inline' | 'floating';
}) => {
  const user = useUser();
  const modal = useModals();
  const { customer, reloadCalendarView } = useCalendar();
  const t = useT();

  const open = useCallback(() => {
    modal.openModal({
      title: t('one_idea_every_platform', 'One idea, every platform'),
      closeOnClickOutside: false,
      closeOnEscape: true,
      withCloseButton: true,
      size: 'lg',
      classNames: {
        modal: 'text-textColor max-w-[720px]',
      },
      children: (
        <IdeaPostsPanel customer={customer} reload={reloadCalendarView} />
      ),
    });
  }, [customer, modal, reloadCalendarView, t]);

  if (!user?.aiDrafts) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={open}
      className={clsx(
        'text-c8-ink flex-1 pt-[12px] pb-[14px] ps-[16px] pe-[20px] min-h-[44px] max-h-[44px] rounded-[18px] bg-c8-btn-secondary border border-c8-btn-secondary-stroke flex justify-center items-center gap-[8px] outline-none',
        presentation === 'floating' && 'phone-create-btn'
      )}
    >
      <HugeIcon name="agent" size={20} className="min-w-[20px]" />
      <div className="flex-1 text-start text-[14px] font-c8-body group-[.sidebar]:hidden">
        {t('one_idea', 'One idea')}
      </div>
    </button>
  );
};
