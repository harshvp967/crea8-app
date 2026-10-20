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
import { IntegrationContext } from '@gitroom/frontend/components/launches/helpers/use.integration';
import { useUppyUploader } from '@gitroom/frontend/components/media/new.uploader';
import SafeImage from '@gitroom/react/helpers/safe.image';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { IsOptional } from 'class-validator';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { Providers } from '@gitroom/frontend/components/new-launch/providers/show.all.providers';
import { getProviderSettingsMeta } from '@gitroom/frontend/components/new-launch/providers/high.order.provider';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';

dayjs.extend(utc);

type DraftMedia = {
  id: string;
  path: string;
  kind: 'image' | 'video';
};

type Draft = {
  integrationId: string;
  provider: string;
  name: string;
  picture?: string | null;
  content: string;
  publishAt: string;
  settings: Record<string, any>;
  media: DraftMedia[];
  error?: string;
  saved?: boolean;
  valid?: boolean;
  warning?: string;
  needs?: 'image' | 'video' | null;
  discord?: boolean;
  badSettings?: boolean;
};

const WEEK = 7 * 24 * 60 * 60 * 1000;

class EmptySettings {
  @IsOptional()
  empty?: string;
}

type StoredPanel = {
  at: number;
  idea: string;
  allWhen: string;
  voice: boolean;
  tray: DraftMedia[];
  drafts: Array<{
    integrationId: string;
    provider: string;
    name: string;
    picture?: string | null;
    content: string;
    publishAt: string;
    settings: Record<string, any>;
    media: DraftMedia[];
    saved?: boolean;
  }>;
};

type ValidRow = {
  id: string;
  identifier?: string;
  valid?: boolean;
  settingsError?: string;
  errors?: string | true;
  emptyContent?: boolean;
  tooLong?: boolean;
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

function mediaKind(path: string): 'image' | 'video' {
  return path.toLowerCase().indexOf('mp4') > -1 ? 'video' : 'image';
}

function channelAccepts(provider: string, kind: 'image' | 'video') {
  if (provider.toLowerCase().startsWith('youtube')) {
    return kind === 'video';
  }
  return true;
}

function panelKey(orgId: string, userId: string, customer?: string | null) {
  return `c8-idea:${orgId}:${userId}:${customer || ''}`;
}

function readPanel(key: string): StoredPanel | null {
  if (!key || typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const data = JSON.parse(raw) as StoredPanel;
    if (!data || typeof data.at !== 'number' || Date.now() - data.at > WEEK) {
      window.localStorage.removeItem(key);
      return null;
    }
    if (!Array.isArray(data.drafts) || !Array.isArray(data.tray) || typeof data.idea !== 'string') {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function writePanel(key: string, data: StoredPanel) {
  if (!key) {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch {
    return;
  }
}

function clearPanel(key: string) {
  if (!key) {
    return;
  }
  try {
    window.localStorage.removeItem(key);
  } catch {
    return;
  }
}

function htmlToPlain(html: string) {
  const text = String(html || '');
  if (!/<[a-z][\s\S]*>/i.test(text)) {
    return text;
  }
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function settingsMeta(provider: string) {
  const row = Providers.find((item) => item.identifier === provider);
  return getProviderSettingsMeta(row?.component);
}

function integrationFor(catalog: Integrations[], item: Draft): Integrations {
  const found = catalog.find((row) => row.id === item.integrationId);
  if (found) {
    return found;
  }
  return {
    id: item.integrationId,
    name: item.name,
    identifier: item.provider,
    display: item.name,
    editor: 'normal',
    picture: item.picture || '',
    inBetweenSteps: false,
    type: 'social',
    additionalSettings: '[]',
    changeProfilePicture: false,
    changeNickName: false,
    time: [],
  } as Integrations;
}

function readUploaded(result: unknown): DraftMedia[] {
  const rows = Array.isArray(result) ? result : [];
  return rows.flatMap((file) => {
    const row = file?.saved || file;
    const path = String(row?.path || '');
    const id = String(row?.id || '');
    if (!id || !path) {
      return [];
    }
    return [{ id, path, kind: mediaKind(path) }];
  });
}

function cardIssue(draft: Draft, result: ValidRow | undefined, tray: DraftMedia[]) {
  if (!result) {
    return {
      valid: false,
      warning: 'Could not check this draft.',
      needs: null as 'image' | 'video' | null,
      discord: false,
      badSettings: false,
    };
  }
  const error = result.errors === true ? '' : String(result.errors || '');
  const settings = result.settingsError || '';
  const provider = draft.provider.toLowerCase();
  if (provider.startsWith('discord') && /channel/i.test(settings)) {
    return { valid: false, warning: '', needs: null, discord: true, badSettings: true };
  }
  const imagesOnly =
    tray.some((file) => file.kind === 'image') &&
    !tray.some((file) => file.kind === 'video') &&
    !draft.media.some((file) => file.kind === 'video');
  const videoOnly = provider.startsWith('youtube') || /must be a video/i.test(error);
  const missingMedia =
    /at least one media|one media|no video \/ images|requires at least one media/i.test(
      error
    );
  if (videoOnly && (missingMedia || imagesOnly || /must be a video/i.test(error))) {
    return { valid: false, warning: 'Needs a video', needs: 'video' as const, discord: false, badSettings: false };
  }
  if (missingMedia) {
    return { valid: false, warning: 'Needs an image', needs: 'image' as const, discord: false, badSettings: false };
  }
  if (result.emptyContent) {
    return {
      valid: false,
      warning: 'Your post should have at least one character or one image.',
      needs: null,
      discord: false,
      badSettings: false,
    };
  }
  if (result.tooLong) {
    return { valid: false, warning: 'This draft is too long.', needs: null, discord: false, badSettings: false };
  }
  if (result.valid === false && settings) {
    return { valid: false, warning: settings, needs: null, discord: false, badSettings: true };
  }
  if (error) {
    return { valid: false, warning: error, needs: null, discord: false, badSettings: false };
  }
  return { valid: true, warning: '', needs: null, discord: false, badSettings: false };
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
      {open && user?.id && user.orgId && (
        <IdeaPostsPanel
          customer={customer}
          reload={reload}
          orgId={user.orgId}
          userId={user.id}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

const ChannelSettingsForm = ({
  provider,
  integration,
  settings,
  onChange,
}: {
  provider: string;
  integration: Integrations;
  settings: Record<string, any>;
  onChange: (settings: Record<string, any>) => void;
}) => {
  const meta = settingsMeta(provider);
  const Settings = meta?.SettingsComponent;
  const form = useForm({
    resolver: classValidatorResolver(meta?.dto || EmptySettings),
    defaultValues: settings || {},
    mode: 'onChange',
  });
  const watched = useWatch({ control: form.control });
  const onChangeRef = useRef(onChange);
  const settingsRef = useRef(settings);
  const last = useRef(JSON.stringify(settings || {}));
  const fromForm = useRef(false);
  onChangeRef.current = onChange;
  settingsRef.current = settings;

  useEffect(() => {
    const next = (watched || {}) as Record<string, any>;
    const serial = JSON.stringify(next);
    if (serial === last.current) {
      return;
    }
    if (!Object.keys(next).length && Object.keys(settingsRef.current || {}).length) {
      return;
    }
    last.current = serial;
    fromForm.current = true;
    onChangeRef.current(next);
  }, [watched]);

  useEffect(() => {
    if (fromForm.current) {
      fromForm.current = false;
      last.current = JSON.stringify(settings || {});
      return;
    }
    const serial = JSON.stringify(settings || {});
    if (serial === last.current) {
      return;
    }
    last.current = serial;
    form.reset(settings || {});
  }, [settings]);

  if (!Settings) {
    return null;
  }
  return (
    <IntegrationContext.Provider
      value={{
        date: dayjs(),
        integration,
        allIntegrations: [integration],
        value: [],
      }}
    >
      <FormProvider {...form}>
        <Settings />
      </FormProvider>
    </IntegrationContext.Provider>
  );
};

const IdeaPostsPanel = ({
  customer,
  reload,
  orgId,
  userId,
  onClose,
}: {
  customer?: string | null;
  reload?: () => void;
  orgId: string;
  userId: string;
  onClose: () => void;
}) => {
  const fetch = useFetch();
  const t = useT();
  const modal = useModals();
  const sheetRef = useRef<HTMLElement>(null);
  const key = panelKey(orgId, userId, customer);
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
  const [checking, setChecking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [restored, setRestored] = useState(false);
  const [allWhen, setAllWhen] = useState('');
  const [tray, setTray] = useState<DraftMedia[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [catalog, setCatalog] = useState<Integrations[]>([]);
  const [settingsOpen, setSettingsOpen] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const catalogRef = useRef<Integrations[]>([]);
  const closeRef = useRef<() => void>(() => undefined);
  const seenInvalid = useRef<Record<string, boolean>>({});
  const addTarget = useRef<number | 'all'>('all');
  const trayRef = useRef<DraftMedia[]>([]);
  const receiveFiles = useRef<(files: DraftMedia[]) => void>(() => undefined);
  trayRef.current = tray;
  const uppy = useUppyUploader({
    allowedFileTypes: 'image/*,video/mp4',
    onStart: () => setUploading(true),
    onEnd: () => setUploading(false),
    onUploadSuccess: (result) => {
      receiveFiles.current(readUploaded(result));
      uppy.clear();
    },
  });

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const apply = () => setPhone(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  useGrabToClose(sheetRef, phone, () => closeRef.current());

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await fetch('/integrations/list');
      const list = await response.json().catch(() => []);
      if (cancelled) {
        return;
      }
      const rows = (Array.isArray(list) ? list : list?.integrations || []) as Integrations[];
      catalogRef.current = rows;
      setCatalog(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetch]);

  useEffect(() => {
    const saved = readPanel(key);
    if (!saved) {
      return;
    }
    setIdea(saved.idea);
    setAllWhen(saved.allWhen || '');
    setVoice(!!saved.voice);
    setTray(saved.tray || []);
    setDrafts(
      saved.drafts.map((item) => ({
        ...item,
        settings: item.settings || {},
        media: item.media || [],
        saved: !!item.saved,
        valid: undefined,
      }))
    );
    setRestored(true);
  }, [key]);

  const draft = useCallback(async () => {
    setRestored(false);
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
          media: trayRef.current.filter((file) =>
            channelAccepts(item.provider, file.kind)
          ),
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
      const rows = (
        Array.isArray(list) ? list : list?.integrations || []
      ) as Integrations[];
      catalogRef.current = rows;
      setCatalog(rows);
      const channels = composerChannels({ catalog: rows, customer });
      const openedId = item.integrationId;
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
            channelSettings={item.settings || {}}
            customer={customer || undefined}
            mutate={reload || (() => undefined)}
            date={date}
            reopenModal={() => undefined}
            saveToDraft={(data) => {
              const post =
                (data.posts || []).find((row) => row.integration?.id === openedId) ||
                data.posts?.[0];
              if (!post) {
                return;
              }
              const nextId = post.integration?.id || openedId;
              const integration = catalogRef.current.find((row) => row.id === nextId);
              setDrafts((current) => {
                const taken = current.some(
                  (row) => row.integrationId === nextId && row.integrationId !== openedId
                );
                return current.map((row) => {
                  if (row.integrationId !== openedId) {
                    return row;
                  }
                  const images = (post.value || []).flatMap((value) => value.image || []);
                  return {
                    ...row,
                    integrationId: taken ? openedId : nextId,
                    provider: taken ? row.provider : integration?.identifier || row.provider,
                    name: taken ? row.name : integration?.name || row.name,
                    picture: taken ? row.picture : integration?.picture ?? row.picture,
                    content: (post.value || [])
                      .map((value) => htmlToPlain(String(value.content || '')))
                      .join('\n\n'),
                    media: images.flatMap((file) => {
                      const path = String(file?.path || '');
                      const id = String(file?.id || '');
                      if (!id || !path) {
                        return [];
                      }
                      return [{ id, path, kind: mediaKind(path) }];
                    }),
                    settings: (post.settings || {}) as Record<string, any>,
                    publishAt: toLocalInput(post.date || data.date) || row.publishAt,
                    saved: false,
                    valid: undefined,
                    error: '',
                    warning: '',
                  };
                });
              });
            }}
            onlyValues={[
              {
                content: plainToPostHtml(item.content),
                image: (item.media || []).map((file) => ({
                  id: file.id,
                  path: file.path,
                })),
              },
            ]}
          />
        ),
      });
    },
    [customer, fetch, modal, reload]
  );

  const addAll = useCallback(async () => {
    if (drafts.some((item) => !item.saved && item.valid !== true)) {
      return;
    }
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
                    image: (item.media || []).map((file) => ({
                      id: file.id,
                      path: file.path,
                    })),
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
      clearPanel(key);
      onClose();
    }
  }, [drafts, fetch, key, onClose, reload, t]);

  receiveFiles.current = (files) => {
    if (!files.length) {
      return;
    }
    const target = addTarget.current;
    setTray((current) => {
      const next = [...current];
      for (const file of files) {
        if (!next.some((row) => row.id === file.id)) {
          next.push(file);
        }
      }
      return next;
    });
    setDrafts((current) =>
      current.map((row, index) => {
        if (target !== 'all' && index !== target) {
          return row;
        }
        const extra = files.filter(
          (file) =>
            channelAccepts(row.provider, file.kind) &&
            !row.media.some((have) => have.id === file.id)
        );
        if (!extra.length) {
          return row;
        }
        return {
          ...row,
          media: [...row.media, ...extra],
          saved: false,
          valid: undefined,
        };
      })
    );
    addTarget.current = 'all';
  };

  const draftSignature = drafts
    .map(
      (item) =>
        `${item.integrationId}\t${item.content}\t${item.publishAt}\t${JSON.stringify(item.settings || {})}\t${item.media.map((file) => file.id).join(',')}`
    )
    .join('\n');
  const traySignature = tray.map((file) => `${file.kind}:${file.id}`).join(',');

  useEffect(() => {
    if (!drafts.length) {
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setChecking(true);
      try {
        const response = await fetch('/posts/valid', {
          method: 'POST',
          body: JSON.stringify({
            type: 'schedule',
            posts: drafts.map((item) => ({
              integration: { id: item.integrationId },
              settings: item.settings || {},
              value: [
                {
                  content: plainToPostHtml(item.content),
                  image: item.media.map((file) => ({
                    id: file.id,
                    path: file.path,
                  })),
                },
              ],
            })),
          }),
        });
        const data = await response.json().catch(() => []);
        if (cancelled) {
          return;
        }
        const rows = (Array.isArray(data) ? data : []) as ValidRow[];
        setDrafts((current) => {
          let changed = false;
          const next = current.map((item) => {
            const issue = cardIssue(
              item,
              rows.find((row) => row.id === item.integrationId),
              trayRef.current
            );
            if (
              item.valid === issue.valid &&
              item.warning === issue.warning &&
              item.needs === issue.needs &&
              item.discord === issue.discord &&
              item.badSettings === issue.badSettings
            ) {
              return item;
            }
            changed = true;
            return { ...item, ...issue };
          });
          return changed ? next : current;
        });
      } catch {
        if (!cancelled) {
          setDrafts((current) =>
            current.map((item) =>
              item.valid === false && item.warning
                ? item
                : {
                    ...item,
                    valid: false,
                    warning: 'Could not check this draft.',
                    badSettings: false,
                  }
            )
          );
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [draftSignature, traySignature, fetch]);

  const invalidSig = drafts
    .map((item) => `${item.integrationId}:${item.valid === false ? '1' : '0'}`)
    .join('|');
  useEffect(() => {
    setSettingsOpen((current) => {
      let changed = false;
      const next = { ...current };
      for (const item of drafts) {
        const bad = item.valid === false;
        if (bad && !seenInvalid.current[item.integrationId] && settingsMeta(item.provider)?.SettingsComponent) {
          next[item.integrationId] = true;
          changed = true;
        }
        seenInvalid.current[item.integrationId] = bad;
      }
      return changed ? next : current;
    });
  }, [invalidSig, drafts]);

  const packPanel = useCallback((): StoredPanel => {
    return {
      at: Date.now(),
      idea,
      allWhen,
      voice,
      tray,
      drafts: drafts.map((item) => ({
        integrationId: item.integrationId,
        provider: item.provider,
        name: item.name,
        picture: item.picture,
        content: item.content,
        publishAt: item.publishAt,
        settings: item.settings || {},
        media: item.media || [],
        saved: !!item.saved,
      })),
    };
  }, [allWhen, drafts, idea, tray, voice]);

  const persistClose = useCallback(() => {
    const payload = packPanel();
    const empty = !payload.idea.trim() && !payload.drafts.length && !payload.tray.length;
    if (empty) {
      clearPanel(key);
    } else {
      writePanel(key, payload);
    }
    onClose();
  }, [key, onClose, packPanel]);
  closeRef.current = persistClose;

  const startFresh = useCallback(() => {
    clearPanel(key);
    setIdea('');
    setDrafts([]);
    setTray([]);
    setAllWhen('');
    setError('');
    setUpgrade('');
    setVoice(false);
    setRestored(false);
    setSettingsOpen({});
    seenInvalid.current = {};
  }, [key]);

  const discard = useCallback(async () => {
    if (!drafts.length && !idea.trim() && !tray.length) {
      clearPanel(key);
      onClose();
      return;
    }
    const keep = !(await deleteDialog(
      t(
        'discard_all_drafts_body',
        'This removes the idea and these drafts from the panel.'
      ),
      t('discard', 'Discard'),
      t('discard_all_drafts', 'Discard all {{count}} drafts?', {
        count: drafts.length,
      }),
      t('keep', 'Keep')
    ));
    if (keep) {
      return;
    }
    clearPanel(key);
    onClose();
  }, [drafts.length, idea, key, onClose, t, tray.length]);

  const pickFiles = (target: number | 'all') => {
    addTarget.current = target;
    fileRef.current?.click();
  };

  const meter = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const ready =
    !!drafts.length && drafts.every((item) => item.saved || item.valid === true);
  const node = (
    <div className="c8-idea">
      <button type="button" className="c8-idea-scrim" aria-label={t('close', 'Close')} onClick={persistClose} />
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
          <button type="button" className="c8-idea-close" aria-label={t('close', 'Close')} onClick={persistClose}>
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
        <div className="c8-idea-tray">
          <input
            ref={fileRef}
            className="c8-idea-file"
            type="file"
            accept="image/*,video/mp4"
            multiple
            onChange={(event) => {
              const files = Array.from(event.target.files || []);
              event.target.value = '';
              for (const file of files) {
                uppy.addFile(file);
              }
            }}
          />
          <button type="button" className="c8-idea-add" onClick={() => pickFiles('all')}>
            <HugeIcon name="plus" size={14} />
            {uploading
              ? t('uploading', 'Uploading…')
              : t('add_images_or_videos', 'Add images or videos')}
          </button>
          {tray.map((file) => (
            <span key={file.id} className="c8-idea-tray-file">
              {file.kind === 'video' ? (
                <span className="c8-idea-video">{t('video', 'Video')}</span>
              ) : (
                <SafeImage src={file.path} alt="" width={56} height={56} />
              )}
              <button
                type="button"
                aria-label={t('remove_media', 'Remove media')}
                onClick={() => {
                  setTray((current) => current.filter((row) => row.id !== file.id));
                  setDrafts((current) =>
                    current.map((row) => ({
                      ...row,
                      media: row.media.filter((have) => have.id !== file.id),
                      saved: false,
                      valid: undefined,
                    }))
                  );
                }}
              >
                <HugeIcon name="close" size={12} />
              </button>
            </span>
          ))}
        </div>
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
        {restored && (
          <p className="c8-idea-restored">
            <span>{t('restored_last_drafts', 'Restored your last drafts')}</span>
            <button type="button" onClick={startFresh}>
              {t('start_fresh', 'Start fresh')}
            </button>
          </p>
        )}
        {!!drafts.length && (
          <label className="c8-idea-all-time">
            <span className="c8-idea-all-label">
              <HugeIcon name="clock" size={14} />
              <span>{t('set_date_time_all', 'Set date and time for all drafts')}</span>
            </span>
            <input
              type="datetime-local"
              aria-label={t('set_date_time_all', 'Set date and time for all drafts')}
              value={allWhen}
              onChange={(event) => {
                const value = event.target.value;
                setAllWhen(value);
                if (!value) {
                  return;
                }
                setDrafts((current) =>
                  current.map((row) => ({
                    ...row,
                    publishAt: value,
                    saved: false,
                  }))
                );
              }}
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
                <button
                  type="button"
                  className="c8-idea-remove"
                  aria-label={t('remove_draft', 'Remove {{name}}', {
                    name: networkName(item.provider),
                  })}
                  onClick={() =>
                    setDrafts((current) => current.filter((row) => row.integrationId !== item.integrationId))
                  }
                >
                  <HugeIcon name="close" size={14} />
                </button>
                <div className="c8-idea-card-actions">
                  <label className="c8-idea-time">
                    <HugeIcon name="clock" size={14} />
                    <span>{dayjs(item.publishAt).format('MMM D, h:mm A')}</span>
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
                </div>
              </div>
              <textarea
                className="c8-idea-copy"
                value={item.content}
                onChange={(event) => {
                  const value = event.target.value;
                  setDrafts((current) =>
                    current.map((row, rowIndex) =>
                      rowIndex === index
                        ? { ...row, content: value, saved: false, valid: undefined }
                        : row
                    )
                  );
                }}
              />
              {!!item.media.length && (
                <div className="c8-idea-strip">
                  {item.media.map((file) => (
                    <span key={file.id} className="c8-idea-thumb">
                      {file.kind === 'video' ? (
                        <span className="c8-idea-video">{t('video', 'Video')}</span>
                      ) : (
                        <SafeImage src={file.path} alt="" width={56} height={56} />
                      )}
                      <button
                        type="button"
                        aria-label={t('remove_media', 'Remove media')}
                        onClick={() =>
                          setDrafts((current) =>
                            current.map((row, rowIndex) =>
                              rowIndex === index
                                ? {
                                    ...row,
                                    media: row.media.filter((have) => have.id !== file.id),
                                    saved: false,
                                    valid: undefined,
                                  }
                                : row
                            )
                          )
                        }
                      >
                        <HugeIcon name="close" size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {!!settingsMeta(item.provider)?.SettingsComponent && (
                <div className="c8-idea-settings">
                  <button
                    type="button"
                    className="c8-idea-settings-toggle"
                    aria-expanded={!!settingsOpen[item.integrationId]}
                    onClick={() =>
                      setSettingsOpen((current) => ({
                        ...current,
                        [item.integrationId]: !current[item.integrationId],
                      }))
                    }
                  >
                    <HugeIcon name="settings" size={14} />
                    {t('settings', 'Settings')}
                  </button>
                  {!!settingsOpen[item.integrationId] && (
                    <ChannelSettingsForm
                      provider={item.provider}
                      integration={integrationFor(catalog, item)}
                      settings={item.settings || {}}
                      onChange={(value) =>
                        setDrafts((current) =>
                          current.map((row, rowIndex) => {
                            if (rowIndex !== index) {
                              return row;
                            }
                            if (JSON.stringify(row.settings || {}) === JSON.stringify(value || {})) {
                              return row;
                            }
                            return {
                              ...row,
                              settings: value,
                              saved: false,
                              valid: undefined,
                            };
                          })
                        )
                      }
                    />
                  )}
                </div>
              )}
              {!!item.needs && (
                <div className="c8-idea-needs">
                  <span>{item.warning}</span>
                  <button type="button" className="c8-idea-add" onClick={() => pickFiles(index)}>
                    {t('add_media', 'Add')}
                  </button>
                </div>
              )}
              {!item.needs && !!item.warning && <p className="c8-idea-card-error">{item.warning}</p>}
              {!!item.error && <p className="c8-idea-card-error">{item.error}</p>}
            </article>
          ))}
        </div>
        <div className="c8-idea-foot">
          <button type="button" className="c8-idea-ghost" onClick={discard}>
            {t('discard', 'Discard')}
          </button>
          <button
            type="button"
            className="c8-idea-primary"
            disabled={
              saving ||
              checking ||
              uploading ||
              !drafts.length ||
              !!error ||
              !ready ||
              drafts.every((item) => item.saved)
            }
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
