'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { plainToPostHtml } from '@gitroom/nestjs-libraries/database/prisma/posts/idea.posts';
import { useGrabToClose } from '@gitroom/frontend/components/launches/helpers/grab.to.close';
import { AddEditModal } from '@gitroom/frontend/components/new-launch/add.edit.modal';
import { composerChannels } from '@gitroom/frontend/components/launches/customer.filter';
import { Integrations } from '@gitroom/frontend/components/launches/calendar.context';
import SafeImage from '@gitroom/react/helpers/safe.image';

dayjs.extend(utc);

type Draft = {
  integrationId: string;
  provider: string;
  name: string;
  picture?: string | null;
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

function networkName(provider: string) {
  const name = provider.split('-')[0] || provider;
  if (name === 'x') {
    return 'X';
  }
  return name.charAt(0).toUpperCase() + name.slice(1);
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

export const IdeaPostsButton = ({
  customer,
  reload,
}: {
  customer?: string | null;
  reload?: () => void;
}) => {
  const user = useUser();
  const t = useT();
  const [open, setOpen] = useState(false);
  if (!user?.aiDrafts) {
    return null;
  }
  const tip = t(
    'one_idea_tooltip',
    'Turn one idea into a draft for every platform'
  );
  return (
    <>
      <button
        type="button"
        className="c8-idea-icon"
        aria-label={tip}
        data-tooltip-id="tooltip"
        data-tooltip-content={tip}
        onClick={() => setOpen(true)}
      >
        <HugeIcon name="sparkles" size={18} />
      </button>
      {open && (
        <IdeaPostsPanel
          customer={customer}
          reload={reload}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

const IdeaPostsPanel = ({
  customer,
  reload,
  onClose,
}: {
  customer?: string | null;
  reload?: () => void;
  onClose: () => void;
}) => {
  const fetch = useFetch();
  const t = useT();
  const modal = useModals();
  const sheetRef = useRef<HTMLElement>(null);
  const [phone, setPhone] = useState(false);
  const [idea, setIdea] = useState('');
  const [used, setUsed] = useState(0);
  const [limit, setLimit] = useState(0);
  const [voice, setVoice] = useState(false);
  const [channelCount, setChannelCount] = useState(0);
  const [error, setError] = useState('');
  const [upgrade, setUpgrade] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const apply = () => setPhone(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  useGrabToClose(sheetRef, phone, onClose);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await fetch('/idea-posts');
      const data = await response.json().catch(() => ({}));
      if (cancelled || !response.ok) {
        return;
      }
      setUsed(data.used ?? 0);
      setLimit(data.limit ?? 0);
      setChannelCount(data.channels ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetch]);

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
          "Couldn't write your drafts. Your idea is still here. Nothing was added, and this try did not count."
        );
        return;
      }
      if (typeof data.used === 'number' && data.counted !== false) {
        setUsed(data.used);
      }
      if (typeof data.limit === 'number') {
        setLimit(data.limit);
      }
      setVoice(!!data.voice);
      if (data.limited) {
        setUpgrade(data.message || '');
        setDrafts([]);
        return;
      }
      if (data.error) {
        setError(data.error);
        setDrafts([]);
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
        "Couldn't write your drafts. Your idea is still here. Nothing was added, and this try did not count."
      );
    } finally {
      setLoading(false);
    }
  }, [customer, fetch, idea]);

  const edit = useCallback(
    async (item: Draft) => {
      const listResponse = await fetch('/integrations/list');
      const list = await listResponse.json();
      const catalog = (
        Array.isArray(list) ? list : list?.integrations || []
      ) as Integrations[];
      const channels = composerChannels({ catalog, customer });
      const date = dayjs(item.publishAt);
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
        size: '80%',
        title: '',
        children: (
          <AddEditModal
            allIntegrations={channels.allIntegrations.map((row) => ({ ...row }))}
            integrations={channels.allIntegrations}
            selectedChannels={[item.integrationId]}
            customer={customer || undefined}
            mutate={reload || (() => undefined)}
            date={date}
            reopenModal={() => undefined}
            onlyValues={[
              {
                content: plainToPostHtml(item.content),
              },
            ]}
          />
        ),
      });
      onClose();
    },
    [customer, fetch, modal, onClose, reload]
  );

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
      reload?.();
    }
    if (saved && next.every((item) => item.saved)) {
      onClose();
    }
  }, [drafts, fetch, onClose, reload, t]);

  const meter = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const node = (
    <div className="c8-idea">
      <button type="button" className="c8-idea-scrim" aria-label={t('close', 'Close')} onClick={onClose} />
      <aside ref={sheetRef} className="c8-idea-panel" role="dialog" aria-labelledby="c8-idea-title">
        <div className="arc-grab" aria-hidden />
        <div className="c8-idea-head">
          <div>
            <h2 id="c8-idea-title">{t('one_idea_every_platform', 'One idea, every platform')}</h2>
            <p>
              {t(
                'one_idea_help',
                'Type one idea or paste a link. You get one draft for each connected channel.'
              )}
            </p>
            <div className="c8-idea-meter">
              <HugeIcon name="agent" size={12} />
              <span>
                {t('ai_posts_used', 'AI posts used: {{used}} of {{limit}}', {
                  used,
                  limit,
                })}
              </span>
              <span className="c8-idea-bar" aria-hidden>
                <span style={{ width: `${meter}%` }} />
              </span>
            </div>
          </div>
          <button type="button" className="c8-idea-close" aria-label={t('close', 'Close')} onClick={onClose}>
            <HugeIcon name="close" size={18} />
          </button>
        </div>
        <label className="c8-idea-field">
          <span>{t('your_idea_or_link', 'Your idea or link')}</span>
          <textarea
            value={idea}
            maxLength={4000}
            onChange={(event) => setIdea(event.target.value)}
          />
        </label>
        <div className="c8-idea-generate">
          <p>
            {voice
              ? t(
                  'uses_brand_voice',
                  'Uses your brand voice · {{count}} channels connected',
                  { count: channelCount }
                )
              : t('channels_connected', '{{count}} channels connected', {
                  count: channelCount,
                })}
          </p>
          <button
            type="button"
            className="c8-idea-secondary"
            disabled={loading || idea.trim().length < 3}
            onClick={draft}
          >
            {loading ? t('writing', 'Writing…') : t('generate', 'Generate')}
          </button>
        </div>
        {!!upgrade && <p className="c8-idea-upgrade">{upgrade}</p>}
        {!!error && (
          <div className="c8-idea-error" role="alert">
            <strong>{t('could_not_write', "Couldn't write your drafts")}</strong>
            <p>{error}</p>
            <button type="button" className="c8-idea-secondary" onClick={draft}>
              {t('try_again', 'Try again')}
            </button>
          </div>
        )}
        {!!drafts.length && (
          <p className="c8-idea-count">
            {t('drafts_for_channels', 'Drafts for {{count}} channels', {
              count: drafts.length,
            })}
          </p>
        )}
        {!!drafts.length && (
          <label className="c8-idea-all-time">
            <HugeIcon name="clock" size={14} />
            <span>{t('set_date_time_all', 'Set date and time for all drafts')}</span>
            <input
              type="datetime-local"
              aria-label={t('set_date_time_all', 'Set date and time for all drafts')}
            />
          </label>
        )}
        <div className="c8-idea-list">
          {drafts.map((item, index) => (
            <article key={item.integrationId} className="c8-idea-card">
              <div className="c8-idea-card-head">
                <SafeImage
                  src={item.picture || '/no-picture.jpg'}
                  alt=""
                  width={32}
                  height={32}
                  className="c8-idea-logo"
                />
                <div className="c8-idea-who">
                  <strong>{networkName(item.provider)}</strong>
                  <span>{item.name}</span>
                </div>
                <label className="c8-idea-time">
                  <HugeIcon name="clock" size={14} />
                  <span>{dayjs(item.publishAt).format('ddd h:mm A')}</span>
                  <input
                    type="datetime-local"
                    aria-label={t('posting_time', 'Posting time')}
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
                  />
                </label>
                <button type="button" className="c8-idea-edit" onClick={() => edit(item)}>
                  <HugeIcon name="pencil" size={14} />
                  {t('edit', 'Edit')}
                </button>
                <button
                  type="button"
                  className="c8-idea-remove"
                  aria-label={t('remove_draft', 'Remove {{name}}', {
                    name: networkName(item.provider),
                  })}
                >
                  <HugeIcon name="close" size={14} />
                </button>
              </div>
              <textarea
                className="c8-idea-copy"
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
              {!!item.error && <p className="c8-idea-card-error">{item.error}</p>}
            </article>
          ))}
        </div>
        <div className="c8-idea-foot">
          <button type="button" className="c8-idea-ghost" onClick={onClose}>
            {t('discard', 'Discard')}
          </button>
          <button
            type="button"
            className="c8-idea-primary"
            disabled={saving || !drafts.length || !!error || drafts.every((item) => item.saved)}
            onClick={addAll}
          >
            {t('add_all_to_calendar', 'Add all to calendar')}
          </button>
        </div>
      </aside>
    </div>
  );

  if (typeof document === 'undefined') {
    return null;
  }
  return createPortal(node, document.body);
};
