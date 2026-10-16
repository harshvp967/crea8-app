'use client';

import React, {
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AddEditModalProps } from '@gitroom/frontend/components/new-launch/add.edit.modal';
import clsx from 'clsx';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { PicksSocialsComponent } from '@gitroom/frontend/components/new-launch/picks.socials.component';
import { EditorWrapper } from '@gitroom/frontend/components/new-launch/editor';
import { SelectCurrent } from '@gitroom/frontend/components/new-launch/select.current';
import { ShowAllProviders } from '@gitroom/frontend/components/new-launch/providers/show.all.providers';
import { useExistingData } from '@gitroom/frontend/components/launches/helpers/use.existing.data';
import { useLaunchStore } from '@gitroom/frontend/components/new-launch/store';
import { DatePicker } from '@gitroom/frontend/components/launches/helpers/date.picker';
import { useShallow } from 'zustand/react/shallow';
import { RepeatComponent } from '@gitroom/frontend/components/launches/repeat.component';
import { TagsComponent } from '@gitroom/frontend/components/launches/tags.component';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { capitalize } from 'lodash';
import { SelectCustomer } from '@gitroom/frontend/components/launches/select.customer';
import { CopilotPopup } from '@copilotkit/react-ui';
import { DummyCodeComponent } from '@gitroom/frontend/components/new-launch/dummy.code.component';
import { CreationMethodBadge } from '@gitroom/frontend/components/launches/creation.method.badge';
import {
  SettingsIcon,
  ChevronDownIcon,
  CloseIcon,
  TrashIcon,
  DropdownArrowSmallIcon,
  CalendarIcon,
  CheckmarkIcon,
} from '@gitroom/frontend/components/ui/icons';
import { useHasScroll } from '@gitroom/frontend/components/ui/is.scroll.hook';
import { useShortlinkPreference } from '@gitroom/frontend/components/settings/shortlink-preference.component';
import dayjs from 'dayjs';
import { Button } from '@gitroom/react/form/button';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { useGrabToClose } from '@gitroom/frontend/components/launches/helpers/grab.to.close';
import { clearComposerLayoutRemount } from '@gitroom/frontend/components/new-launch/composer.draft';
import { persistedThreadValues } from '@gitroom/frontend/components/new-launch/preview.thread';

const finePointer = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(hover: hover) and (pointer: fine)').matches;

export const ManageModal: FC<AddEditModalProps> = (props) => {
  const t = useT();
  const fetch = useFetch();
  const ref = useRef(null);
  const composerFrameRef = useRef<HTMLDivElement>(null);
  const existingData = useExistingData();
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<null | 'draft' | 'submit'>(null);
  const toaster = useToaster();
  const modal = useModals();
  const [showSettings, setShowSettings] = useState(false);
  const [phonePane, setPhonePane] = useState<'editor' | 'preview'>('editor');
  const [issue, setIssue] = useState<{ title: string; body: string } | null>(null);
  const [postMenuPinned, setPostMenuPinned] = useState(false);
  const [postMenuHover, setPostMenuHover] = useState(false);
  const [postMenuFocus, setPostMenuFocus] = useState(0);
  const postMenuOpen = postMenuPinned || postMenuHover;
  const postSplitRef = useRef<HTMLDivElement>(null);
  const postMenuRef = useRef<HTMLDivElement>(null);
  const postChevronRef = useRef<HTMLButtonElement>(null);
  const postMenuKeyboard = useRef(false);
  const hoverSuppressed = useRef(false);
  const { data: shortlinkPreferenceData } = useShortlinkPreference();

  const { addEditSets, mutate, customClose, dummy } = props;

  const {
    selectedIntegrations,
    hide,
    date,
    setDate,
    repeater,
    setRepeater,
    tags,
    setTags,
    integrations,
    setSelectedIntegrations,
    locked,
    current,
    activateExitButton,
    setHide,
    channelDates,
    setChannelDate,
  } = useLaunchStore(
    useShallow((state) => ({
      hide: state.hide,
      setHide: state.setHide,
      date: state.date,
      setDate: state.setDate,
      channelDates: state.channelDates,
      setChannelDate: state.setChannelDate,
      current: state.current,
      repeater: state.repeater,
      setRepeater: state.setRepeater,
      tags: state.tags,
      setTags: state.setTags,
      selectedIntegrations: state.selectedIntegrations,
      integrations: state.integrations,
      setSelectedIntegrations: state.setSelectedIntegrations,
      locked: state.locked,
      activateExitButton: state.activateExitButton,
    }))
  );
  // the other channels of an existing post show and move only their own date
  const channelDate = channelDates[current];
  const pickerDate = channelDate || date;
  const setPickerDate = useCallback(
    (newDate: dayjs.Dayjs) => {
      if (channelDate) {
        return setChannelDate(current, newDate);
      }

      setDate(newDate);
    },
    [channelDate, current, setChannelDate, setDate]
  );

  // the channels the post already has, each with its own post
  const existingPosts = [existingData, ...(existingData.siblings || [])];
  // the channel in view, or the one that was opened
  const channel =
    existingPosts.find((p) => p.integration === current) || existingData;

  useEffect(() => {
    if (hide) {
      setHide(false);
    }
  }, [hide]);

  useEffect(() => {
    document.body.classList.add('composer-open');
    return () => {
      document.body.classList.remove('composer-open');
    };
  }, []);

  const closePostMenu = useCallback((restoreFocus: boolean) => {
    hoverSuppressed.current = true;
    setPostMenuPinned(false);
    setPostMenuHover(false);
    if (restoreFocus) {
      postChevronRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (!postMenuOpen) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!postSplitRef.current?.contains(event.target as Node)) {
        hoverSuppressed.current = true;
        setPostMenuPinned(false);
        setPostMenuHover(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      hoverSuppressed.current = true;
      setPostMenuPinned(false);
      setPostMenuHover(false);
      postChevronRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [postMenuOpen]);

  useEffect(() => {
    if (!postMenuOpen || !postMenuKeyboard.current) {
      return;
    }
    postMenuKeyboard.current = false;
    postMenuRef.current
      ?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
      ?.focus();
  }, [postMenuFocus, postMenuOpen]);

  const togglePostMenu = useCallback(
    (keyboard: boolean) => {
      if (postMenuPinned) {
        hoverSuppressed.current = true;
        setPostMenuPinned(false);
        setPostMenuHover(false);
        if (keyboard) {
          queueMicrotask(() => postChevronRef.current?.focus());
        }
        return;
      }

      // A fine pointer already opened the menu on hover. The click pins it
      // so the same press does not immediately close it.
      if (postMenuHover && !keyboard) {
        setPostMenuPinned(true);
        return;
      }

      hoverSuppressed.current = false;
      postMenuKeyboard.current = keyboard;
      if (keyboard) {
        setPostMenuFocus((tick) => tick + 1);
      }
      setPostMenuPinned(true);
    },
    [postMenuHover, postMenuPinned]
  );

  const onPostMenuKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const items = Array.from(
        postMenuRef.current?.querySelectorAll<HTMLButtonElement>(
          '[role="menuitem"]:not(:disabled)'
        ) || []
      );
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!items.length) {
          return;
        }
        const next =
          event.key === 'ArrowDown'
            ? items[(index + 1 + items.length) % items.length]
            : items[(index - 1 + items.length) % items.length];
        next?.focus();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closePostMenu(true);
      }
    },
    [closePostMenu]
  );

  const currentIntegrationText = useMemo(() => {
    if (current === 'global') {
      return (
        <div className="flex items-center gap-[10px]">
          <div className="relative">
            <SettingsIcon size={18} className="c8-settings-gear" />
          </div>
          <div>Settings</div>
        </div>
      );
    }

    const currentIntegration = integrations.find((p) => p.id === current);

    return (
      <div className="flex items-center gap-[8px]">
        {currentIntegration && (
          <img
            src={`/icons/platforms/${currentIntegration.identifier}.png`}
            className="w-[20px] h-[20px] rounded-[4px]"
            alt={currentIntegration.identifier}
          />
        )}
        <div>
          {currentIntegration
            ? `${currentIntegration.name} ${t('channel_settings', 'Settings')}`
            : t('settings', 'Settings')}
        </div>
      </div>
    );
  }, [current, integrations, t]);

  const changeCustomer = useCallback(
    (customer: string) => {
      const neededIntegrations = customer
        ? integrations.filter((p) => p?.customer?.id === customer)
        : integrations;
      setSelectedIntegrations(
        neededIntegrations.map((p) => ({
          settings: {},
          selectedIntegrations: p,
        }))
      );
    },
    [integrations]
  );

  const askClose = useCallback(async () => {
    clearComposerLayoutRemount();
    if (!activateExitButton || dummy) {
      return false;
    }

    if (
      !(await deleteDialog(
        t(
          'discard_this_post_body',
          'The text and media in this post will be lost.'
        ),
        t('discard', 'Discard'),
        t('discard_this_post', 'Discard this post?'),
        t('keep_editing', 'Keep editing'),
        'danger'
      ))
    ) {
      return false;
    }
    if (customClose) {
      customClose();
      return true;
    }
    modal.closeAll();
    return true;
  }, [activateExitButton, dummy]);

  useGrabToClose(composerFrameRef, true, askClose);
  useGrabToClose(postMenuRef, postMenuOpen, () => closePostMenu(false));

  const deletePost = useCallback(async () => {
    setLoading(true);
    if (existingData.siblings?.length) {
      const groups = await new Promise<string[]>((resolve) => {
        modal.openModal({
          id: 'delete-post-channels',
          title: t('delete_post', 'Delete Post'),
          classNames: { modal: 'po-edit-modal' },
          size: '500px',
          onClose: () => resolve([]),
          children: (
            <div className="po-edit">
              <p className="po-edit-copy">
                {t(
                  'delete_post_from_all_channels_question',
                  'This post was created for more than one channel. Do you want to delete it from all of them?'
                )}
              </p>
              <div className="po-edit-actions">
                <Button
                  type="button"
                  secondary
                  className="po-edit-update"
                  onClick={() => {
                    modal.closeById('delete-post-channels');
                    resolve([channel.group!]);
                  }}
                >
                  {t('delete_only_from', 'Only from')}{' '}
                  {integrations.find((p) => p.id === channel.integration)?.name}
                </Button>
                <Button
                  type="button"
                  className="po-edit-republish"
                  onClick={() => {
                    modal.closeById('delete-post-channels');
                    resolve(existingPosts.map((p) => p.group!));
                  }}
                >
                  {t('delete_from_all_channels', 'Delete from all channels')}
                </Button>
              </div>
            </div>
          ),
        });
      });

      if (!groups.length) {
        setLoading(false);
        return;
      }

      await Promise.all(
        groups.map((group) =>
          fetch(`/posts/${group}`, {
            method: 'DELETE',
          })
        )
      );
      mutate();
      clearComposerLayoutRemount();
      modal.closeAll();
      return;
    }

    if (
      !(await deleteDialog(
        t(
          'are_you_sure_you_want_to_delete_post',
          'Are you sure you want to delete this post?'
        ),
        t('delete', 'Delete'),
        t('are_you_sure', 'Are you sure?'),
        t('cancel', 'Cancel'),
        'danger'
      ))
    ) {
      setLoading(false);
      return;
    }
    await fetch(`/posts/${existingData.group}`, {
      method: 'DELETE',
    });
    mutate();
    clearComposerLayoutRemount();
    modal.closeAll();
    return;
  }, [existingData, existingPosts, channel, integrations, mutate, modal, fetch, t]);

  const schedule = useCallback(
    (type: 'draft' | 'now' | 'schedule' | 'update') => async () => {
      let republish = false;
      // the channels saved as another type, the rest are saved as `type`
      const saveAs: Record<string, 'draft' | 'schedule' | 'update'> = {};
      const saveTypeOf = (id: string) => saveAs[id] || type;
      // the channels that already went out, or are going out right now
      const published = existingPosts.filter(
        (p) =>
          p.posts?.[0]?.state === 'PUBLISHED' ||
          (p.posts?.[0]?.state === 'QUEUE' &&
            dayjs().isAfter((channelDates[p.integration] || date).utc()))
      );
      const others = existingPosts.filter((p) => p !== channel);

      // another channel whose date already passed would go out right away, it
      // only gets its details saved
      const pastDetails: string[] = [];
      if (type === 'schedule') {
        for (const p of others) {
          if (
            !published.includes(p) &&
            dayjs().isAfter((channelDates[p.integration] || date).utc())
          ) {
            saveAs[p.integration] = 'update';
            const name = integrations.find((i) => i.id === p.integration)?.name;
            if (name) {
              pastDetails.push(name);
            }
          }
        }
      }
      if (pastDetails.length) {
        toaster.show(
          t(
            'channel_time_already_passed',
            '{{channels}} already passed its time, so only its details were saved. Pick a new time on its tab to schedule it.',
            { channels: pastDetails.join(', ') }
          ),
          'warning'
        );
      }

      // a draft of a post with other channels leaves the published ones as they are
      if (type === 'draft' && existingData.siblings?.length) {
        for (const p of published) {
          if (p.posts?.[0]?.state === 'PUBLISHED') {
            saveAs[p.integration] = 'update';
          }
        }
      }

      // the save that leaves a channel in its state
      const asItIs = (p: (typeof existingPosts)[number]) =>
        p.posts?.[0]?.state === 'DRAFT'
          ? 'draft'
          : p.posts?.[0]?.state === 'QUEUE' && !published.includes(p)
          ? 'schedule'
          : 'update';

      // a save that changes the state of the other channels can do it only
      // for the channel in view, the others keep their state
      if (
        type !== 'update' &&
        others.some(
          (p) =>
            !saveAs[p.integration] &&
            (type === 'draft' || !published.includes(p)) &&
            asItIs(p) !== type
        )
      ) {
        const question =
          type === 'draft'
            ? t(
                'draft_post_in_all_channels_question',
                'This post was created for more than one channel. Do you want to move all of them to drafts?'
              )
            : type === 'now'
            ? t(
                'post_now_in_all_channels_question',
                'This post was created for more than one channel. Do you want to post all of them now?'
              )
            : t(
                'schedule_post_in_all_channels_question',
                'This post was created for more than one channel. Do you want to schedule all of them?'
              );

        const allChannels =
          type === 'draft'
            ? t('draft_all_channels', 'Move all channels to drafts')
            : type === 'now'
            ? t('post_now_all_channels', 'Post all channels now')
            : t('schedule_all_channels', 'Schedule all channels');

        const whichChannels = await new Promise((resolve) => {
          modal.openModal({
            id: 'change-post-channels',
            title: t('what_do_you_want_to_do', 'What do you want to do?'),
            classNames: { modal: 'po-edit-modal' },
            size: '500px',
            onClose: () => resolve(undefined),
            children: (
              <div className="po-edit">
                <p className="po-edit-copy">{question}</p>
                <div className="po-edit-actions">
                  {!saveAs[channel.integration] && (
                    <Button
                      type="button"
                      secondary
                      className="po-edit-update"
                      onClick={() => {
                        modal.closeById('change-post-channels');
                        resolve('only');
                      }}
                    >
                      {t('only_channel', 'Only')}{' '}
                      {
                        integrations.find((p) => p.id === channel.integration)
                          ?.name
                      }
                    </Button>
                  )}
                  <Button
                    type="button"
                    className="po-edit-republish"
                    onClick={() => {
                      modal.closeById('change-post-channels');
                      resolve('all');
                    }}
                  >
                    {allChannels}
                  </Button>
                </div>
              </div>
            ),
          });
        });

        if (!whichChannels) {
          return;
        }

        if (whichChannels === 'only') {
          for (const p of others) {
            saveAs[p.integration] = asItIs(p);
          }
        }
      }

      // the published channels that would go out again
      const republishing = published.filter((p) => !saveAs[p.integration]);

      if ((type === 'now' || type === 'schedule') && republishing.length) {
        const channels = republishing
          .map(
            (p) =>
              `${integrations.find((i) => i.id === p.integration)?.name} ${t(
                'republish_at',
                'at'
              )} ${(channelDates[p.integration] || date).format(
                'DD/MM/YYYY HH:mm'
              )}`
          )
          .join(', ');
        const isRecurring =
          !!repeater || !!existingData?.posts?.[0]?.intervalInDays;

        const whatToDo = await new Promise((resolve) => {
          modal.openModal({
            id: 'republish-post',
            title: t('what_do_you_want_to_do', 'What do you want to do?'),
            classNames: { modal: 'po-edit-modal' },
            size: '500px',
            onClose: () => resolve(undefined),
            children: (
              <div className="po-edit">
                <p className="po-edit-copy">
                  {t(
                    'post_already_published_republish_warning',
                    'This post was already published. Republishing will publish it again to'
                  )}{' '}
                  {channels}.
                </p>
                {isRecurring && (
                  <div className="po-edit-note">
                    <HugeIcon name="repeat" size={18} />
                    <span>
                      {t(
                        'republish_recurring_note',
                        'This is a recurring post: your changes apply to all future recurrences starting now.'
                      )}
                    </span>
                  </div>
                )}
                <div className="po-edit-actions">
                  <Button
                    type="button"
                    secondary
                    className="po-edit-update"
                    onClick={() => {
                      modal.closeById('republish-post');
                      resolve('update');
                    }}
                  >
                    {t(
                      'just_update_post_details',
                      'Just update the post details'
                    )}
                  </Button>
                  <Button
                    type="button"
                    className="po-edit-republish"
                    onClick={() => {
                      modal.closeById('republish-post');
                      resolve('republish');
                    }}
                  >
                    {t('republish_the_post', 'Republish the post')}
                  </Button>
                </div>
              </div>
            ),
          });
        });

        if (!whatToDo) {
          return;
        }

        if (whatToDo === 'update') {
          for (const p of republishing) {
            saveAs[p.integration] = 'update';
          }
        }

        if (whatToDo === 'republish') {
          republish = true;
        }
      }

      setLoading(true);
      setBusy(type === 'draft' ? 'draft' : 'submit');
      setIssue(null);

      // Pull the local values to build the payload, but rely on the server
      // (`/posts/valid`) for the actual validation — checkValidity now lives
      // server-side so it can't be bypassed.
      const allValues = await ref.current.getAllValues();

      const integrationById = (id: string) =>
        selectedIntegrations.find((p) => p.integration.id === id);

      const group = existingData.group || makeId(10);

      const posts = allValues.map((post: any) => ({
        integration: {
          id: post.id,
        },
        // every channel of an existing post updates its own post
        group:
          existingPosts.find((p) => p.integration === post.id)?.group || group,
        ...(channelDates[post.id]
          ? {
              date: channelDates[post.id].utc().format('YYYY-MM-DDTHH:mm:ss'),
            }
          : {}),
        settings: { ...(post.settings || {}) },
        value: persistedThreadValues(post.values).map((value: any) => ({
          ...(value.id ? { id: value.id } : {}),
          content: value.content,
          delay: value.delay || 0,
          image:
            (value?.media || []).map(
              ({ id, path, alt, thumbnail, thumbnailTimestamp }: any) => ({
                id,
                path,
                alt,
                thumbnail,
                thumbnailTimestamp,
              })
            ) || [],
        })),
      }));

      if (!dummy) {
        const checkAllValid = await (
          await fetch('/posts/valid', {
            method: 'POST',
            body: JSON.stringify({ type, posts }),
          })
        ).json();

        const focus = (id: string, where: 'fix' | 'preview') => {
          integrationById(id)?.ref?.current?.[where]?.();
        };

        const notEnoughChars = checkAllValid.filter((p: any) => p.emptyContent);

        for (const item of notEnoughChars) {
          toaster.show(
            `${capitalize(item.identifier.split('-')[0])} (${item.name}):` +
              ' ' +
              t(
                'post_needs_content_or_image',
                'Your post should have at least one character or one image.'
              ),
            'error'
          );
          setLoading(false);
          focus(item.id, 'preview');
          return;
        }

        // a channel saved as a draft gets these checks once it's scheduled
        const notDrafts = checkAllValid.filter(
          (p: any) => saveTypeOf(p.id) !== 'draft'
        );

        if (type !== 'draft' || notDrafts.length) {
          for (const item of notDrafts) {
            if (item.valid === false) {
              const message = `${capitalize(item.identifier.split('-')[0])} (${item.name}): ${
                item.settingsError ||
                t('please_fix_your_settings', 'Please fix your settings')
              }`;
              toaster.show(message, 'error');
              setIssue({
                title: t('please_fix_your_settings', 'Please fix your settings'),
                body: message,
              });
              focus(item.id, 'fix');
              setLoading(false);
              setShowSettings(true);
              return;
            }

            if (item.errors !== true) {
              const message = `${capitalize(item.identifier.split('-')[0])} (${item.name}): ${
                item.errors
              }`;
              toaster.show(message, 'error');
              setIssue({
                title: t('please_fix_your_settings', 'Please fix your settings'),
                body: message,
              });
              focus(item.id, 'preview');
              setLoading(false);
              setShowSettings(false);
              return;
            }

            if (item.tooLong) {
              const channel = capitalize(item.identifier.split('-')[0]);
              const message = t(
                'post_is_too_long_named',
                '{{name}} is too long. Shorten it.',
                { name: item.name }
              );
              toaster.show(message, 'error');
              setIssue({
                title: t('post_is_too_long', 'post is too long, please fix it'),
                body: item.maximumCharacters
                  ? t(
                      'channel_allows_characters',
                      '{{channel}} allows up to {{count}} characters. Shorten the text or customize it for {{channel}}.',
                      { channel, count: item.maximumCharacters }
                    )
                  : message,
              });
              focus(item.id, 'preview');
              setLoading(false);
              return;
            }
          }
        }
      }

      const shortlinkPreference = shortlinkPreferenceData?.shortlink || 'ASK';

      let shortLink = false;

      if (!dummy && shortlinkPreference !== 'NO') {
        const shortLinkUrl = await (
          await fetch('/posts/should-shortlink', {
            method: 'POST',
            body: JSON.stringify({
              messages: allValues
                // platforms that remove links won't keep shortlinks either
                .filter((p: any) => {
                  const integration = integrationById(p.id)?.integration;
                  if (!integration?.stripLinks) {
                    return true;
                  }
                  const settings = p.settings || {};
                  return (
                    settings.post_type === 'article' ||
                    settings.include_links === true
                  );
                })
                .flatMap((p: any) => p.values.flatMap((a: any) => a.content)),
            }),
          })
        ).json();

        if (shortLinkUrl.ask) {
          if (shortlinkPreference === 'YES') {
            // Automatically shortlink without asking
            shortLink = true;
          } else {
            // ASK: Show the dialog
            shortLink = await deleteDialog(
              t(
                'shortlink_urls_question',
                'Shorten the links in this post so you can see how many people click them?'
              ),
              t('yes_shortlink_it', 'Shorten links'),
              undefined,
              t('no_original_urls', 'Keep the links')
            );
          }
        }
      }

      const data = {
        type,
        ...(republish ? { republish } : {}),
        ...(repeater ? { inter: repeater } : {}),
        tags,
        shortLink,
        date: date.utc().format('YYYY-MM-DDTHH:mm:ss'),
        posts,
      };

      if (dummy) {
        modal.openModal({
          title: '',
          children: <DummyCodeComponent code={data} />,
          classNames: {
            modal: 'w-[100%] bg-transparent text-textColor',
          },
          size: '100%',
          withCloseButton: false,
          closeOnEscape: true,
          closeOnClickOutside: true,
        });

        setLoading(false);
      }

      if (!dummy) {
        if (addEditSets) {
          addEditSets(data);
        } else {
          // every type of save is its own request, the drafts last, since a
          // draft save skips the checks the others still run
          let saved = false;
          for (const requestType of ['update', 'schedule', 'now', 'draft']) {
            const request = {
              type: requestType,
              posts: posts.filter(
                (p: any) => saveTypeOf(p.integration.id) === requestType
              ),
            };
            if (!request.posts.length) {
              continue;
            }

            const response = await fetch('/posts', {
              method: 'POST',
              body: JSON.stringify({ ...data, ...request }),
            });

            if (!response.ok) {
              if (response.status !== 402) {
                const { message } = await response.json().catch(() => ({}));
                toaster.show(
                  typeof message === 'string'
                    ? message
                    : t('post_save_failed', 'Could not save the post'),
                  'warning'
                );
              }
              if (saved) {
                mutate();
              }
              setLoading(false);
              setBusy(null);
              return;
            }
            saved = true;
          }
        }

        if (!addEditSets) {
          mutate();
          toaster.show(
            !existingData.integration
              ? t('added_successfully', 'Added successfully')
              : t('updated_successfully', 'Updated successfully')
          );
        }
        if (customClose) {
          setTimeout(() => {
            customClose();
          }, 2000);
        }

        if (!addEditSets) {
          clearComposerLayoutRemount();
          modal.closeAll();
        }
      }
    },
    [
      ref,
      repeater,
      tags,
      date,
      channelDates,
      current,
      integrations,
      existingData,
      existingPosts,
      channel,
      selectedIntegrations,
      addEditSets,
      dummy,
      shortlinkPreferenceData,
      modal,
      toaster,
      t,
      fetch,
      mutate,
    ]
  );

  return (
    <div className={clsx('composer c8-composer w-full h-full flex-1 p-[40px] flex relative', phonePane === 'preview' && 'composer-show-preview', issue && 'composer-invalid')}>
      <div ref={composerFrameRef} className="composer-frame flex flex-1 bg-newBgColorInner rounded-[20px] flex-col min-h-0">
        <div className="arc-grab composer-grab" aria-hidden />
        <div className="composer-tabs" role="tablist">
          <span className="composer-tabs-title">
            {existingData?.integration
              ? t('edit_post_title', 'Edit post')
              : t('create_post_title', 'Create Post')}
          </span>
          <div className="composer-seg">
            <button type="button" role="tab" aria-selected={phonePane === 'editor'} className={phonePane === 'editor' ? 'on' : ''} onClick={() => setPhonePane('editor')}>
              {t('editor', 'Editor')}
            </button>
            <button type="button" role="tab" aria-selected={phonePane === 'preview'} className={phonePane === 'preview' ? 'on' : ''} onClick={() => setPhonePane('preview')}>
              {t('post_preview', 'Post Preview')}
            </button>
          </div>
          <button type="button" className="composer-close-phone" aria-label={t('close', 'Close')} onClick={askClose}>
            <CloseIcon className="text-[#A3A3A3]" />
          </button>
        </div>
        <div className="composer-split flex-1 flex min-h-0">
          <div className="composer-editor flex flex-col flex-1 border-e border-newBorder min-w-0">
            <div className="bg-newBgColor h-[65px] rounded-s-[20px] !rounded-b-[0] flex items-center gap-[12px] px-[20px] text-[20px] font-[600]">
              {existingData?.integration
                ? t('edit_post_title', 'Edit post')
                : t('create_post_title', 'Create Post')}
              <CreationMethodBadge
                creationMethod={existingData?.posts?.[0]?.creationMethod}
                size="sm"
              />
            </div>
            <div className="flex-1 flex flex-col gap-[16px]">
              <div
                className="flex-1 relative min-w-0"
              >
                <div
                  id="social-content"
                  className="gap-[32px] flex flex-col pe-[8px] pt-[20px] ps-[20px] absolute top-0 left-0 w-full h-full overflow-x-hidden overflow-y-scroll scrollbar scrollbar-thumb-newColColor scrollbar-track-newBgColorInner"
                >
                  <div className="flex w-full">
                    <div className="flex flex-1">
                      <PicksSocialsComponent toolTip={true} />
                    </div>
                    <div>
                      {!dummy && (
                        <SelectCustomer
                          onChange={changeCustomer}
                          integrations={integrations}
                          customer={props.customer}
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex flex-1 gap-[6px] flex-col">
                    <div>
                      {(!existingData.integration ||
                        !!existingData.siblings?.length) && <SelectCurrent />}
                    </div>
                    {issue && (
                      <div className="po-valid" role="alert">
                        <div className="po-valid-copy">
                          <div className="po-valid-title">
                            <HugeIcon name="alert" size={16} className="text-[#F04438]" />
                            <span>{issue.title}</span>
                          </div>
                          <div className="po-valid-body">{issue.body}</div>
                        </div>
                        <button
                          type="button"
                          className="c8-valid-close"
                          aria-label={t('close', 'Close')}
                          onClick={() => setIssue(null)}
                        >
                          <CloseIcon />
                        </button>
                      </div>
                    )}
                    <div className="flex-1 flex">
                      {!hide && <EditorWrapper totalPosts={1} value="" />}
                    </div>
                    <div
                      id="social-empty"
                      className={clsx(
                        'pb-[16px]'
                        // current !== 'global' && 'hidden'
                      )}
                    />
                  </div>
                </div>
              </div>
              <div
                id="wrapper-settings"
                className={clsx(
                  'px-[20px] pb-[16px] select-none min-w-0',
                  current === 'global' && 'hidden'
                )}
              >
                <div className="po-settings flex flex-col rounded-[18px] border border-newBorder overflow-hidden bg-newBgColorInner">
                  <button
                    type="button"
                    onClick={() => setShowSettings(!showSettings)}
                    className="po-settings-toggle flex items-center gap-[8px] cursor-pointer px-[14px] py-[12px]"
                  >
                    <div className="flex-1 text-[14px] font-[600] min-w-0">
                      {currentIntegrationText}
                    </div>
                    <div>
                      <ChevronDownIcon
                        rotated={showSettings}
                        className="text-textItemBlur"
                      />
                    </div>
                  </button>
                  <div
                    className={clsx(
                      !showSettings && 'hidden',
                      'text-[14px] text-textColor font-[500] border-t border-newBorder'
                    )}
                  >
                    <div className="max-h-[280px] overflow-x-hidden overflow-y-auto scrollbar scrollbar-thumb-newBgColorInner scrollbar-track-newColColor">
                      <div
                        id="social-settings"
                        className="flex flex-col gap-[20px]"
                      />
                    </div>
                  </div>
                  <style>
                    {`#social-settings [data-id="${current}"] {display: block !important;}`}
                  </style>
                </div>
              </div>
            </div>
          </div>
          <div className="composer-preview w-[580px] flex flex-col min-w-0">
            <div className="c8-preview-label">{t('preview', 'Preview')}</div>
            <div className="bg-newBgColor h-[65px] rounded-e-[26px] !rounded-b-[0] flex items-center px-[20px] text-[20px] font-[600]">
              <div className="flex-1">{t('post_preview', 'Post Preview')}</div>
              <button type="button" className="composer-close-phone" aria-label={t('close', 'Close')} onClick={askClose}>
                <CloseIcon className="text-[#A3A3A3]" />
              </button>
            </div>
            <div className="flex-1 relative">
              <Scrollable
                scrollClasses="!pe-[20px]"
                className="absolute top-0 p-[20px] pe-[8px] left-0 w-full h-full overflow-x-hidden overflow-y-scroll scrollbar scrollbar-thumb-newColColor scrollbar-track-newBgColorInner"
              >
                <ShowAllProviders ref={ref} />
              </Scrollable>
            </div>
          </div>
        </div>
        <div className="composer-foot select-none h-[84px] py-[20px] border-t border-newBorder flex items-center">
          <div className="flex-1 flex ps-[20px] gap-[8px]">
            {!dummy && (
              <TagsComponent
                name="tags"
                label={t('tags', 'Tags')}
                initial={tags}
                onChange={(e) => {
                  setTags(e.target.value);
                }}
              />
            )}

            {!dummy && (
              <RepeatComponent repeat={repeater} onChange={setRepeater} />
            )}
          </div>
          <div className="composer-actions pe-[20px] flex items-center justify-end gap-[8px]">
            {existingData?.integration && (
              <button
                onClick={deletePost}
                className="c8-delete cursor-pointer flex text-[#FF3F3F] gap-[8px] items-center text-[15px] font-[600]"
              >
                <div>
                  <TrashIcon />
                </div>
                <span>{t('delete_post', 'Delete post')}</span>
              </button>
            )}
            <DatePicker onChange={setPickerDate} date={pickerDate} />
            {!addEditSets && (
              <button
                disabled={
                  selectedIntegrations.length === 0 || loading || locked
                }
                onClick={schedule('draft')}
                className="c8-draft relative cursor-pointer disabled:cursor-not-allowed px-[20px] h-[44px] bg-btnSimple border border-newBorder justify-center items-center flex rounded-[18px] text-[15px] font-[500]"
                aria-busy={loading && busy === 'draft'}
              >
                {loading && busy === 'draft' && (
                  <div className="absolute left-[50%] top-[50%] -translate-y-[50%] -translate-x-[50%]">
                    <div className="po-spin" role="status" />
                  </div>
                )}
                <div className={clsx(loading && busy === 'draft' && 'invisible')}>
                  <span className="c8-draft-long">{t('save_as_draft', 'Save as draft')}</span>
                  <span className="c8-draft-short">{t('draft', 'Draft')}</span>
                </div>
              </button>
            )}
            {addEditSets && (
              <button
                className="text-[#0A0A0A] text-[15px] font-[500] min-w-[180px] btnSub disabled:cursor-not-allowed disabled:opacity-80 outline-none gap-[8px] flex justify-center items-center h-[44px] rounded-[18px] bg-[#00D9FF] ps-[20px] pe-[16px]"
                disabled={
                  selectedIntegrations.length === 0 || loading || locked
                }
                onClick={schedule('draft')}
              >
                {t('save_set', 'Save set')}
              </button>
            )}
            {!addEditSets && (
              <div
                ref={postSplitRef}
                className={clsx(
                  'group po-split cursor-pointer relative',
                  postMenuOpen && 'is-open'
                )}
                onBlur={(event) => {
                  if (!postMenuOpen) {
                    return;
                  }
                  const next = event.relatedTarget as Node | null;
                  const stillInside = (node: Node | null) =>
                    !!node &&
                    (postChevronRef.current?.contains(node) ||
                      postMenuRef.current?.contains(node));
                  if (stillInside(next)) {
                    return;
                  }
                  // A click on an item blurs before the click event. Hiding the
                  // menu in that gap drops the click, so wait until it runs.
                  if (!next) {
                    window.setTimeout(() => {
                      if (stillInside(document.activeElement)) {
                        return;
                      }
                      closePostMenu(false);
                    }, 0);
                    return;
                  }
                  closePostMenu(false);
                }}
                onMouseEnter={() => {
                  if (
                    !finePointer() ||
                    loading ||
                    locked ||
                    hoverSuppressed.current
                  ) {
                    return;
                  }
                  setPostMenuHover(true);
                }}
                onMouseLeave={() => {
                  hoverSuppressed.current = false;
                  if (postMenuRef.current?.contains(document.activeElement)) {
                    return;
                  }
                  setPostMenuHover(false);
                }}
              >
                <button
                  disabled={
                    selectedIntegrations.length === 0 || loading || locked
                  }
                  onClick={schedule('schedule')}
                  className="po-split-main text-[#0A0A0A] relative btnSub disabled:cursor-not-allowed disabled:opacity-80 outline-none flex justify-center items-center"
                  aria-busy={loading && busy === 'submit'}
                >
                  {loading && busy === 'submit' && (
                    <div className="absolute left-[50%] top-[50%] -translate-y-[50%] -translate-x-[50%] text-[#0A0A0A]">
                      <div className="po-spin" />
                    </div>
                  )}
                  <span className={clsx(loading && busy === 'submit' && 'invisible')}>
                    {selectedIntegrations.length === 0
                      ? t('select_channel_first', 'Select a channel first')
                      : dummy
                      ? t('create_output', 'Create output')
                      : !existingData?.integration
                      ? t('add_to_calendar', 'Add to calendar')
                      : existingData?.posts?.[0]?.state === 'DRAFT'
                      ? t('schedule', 'Schedule')
                      : t('update', 'Update')}
                  </span>
                </button>
                {!dummy && (
                  <button
                    ref={postChevronRef}
                    type="button"
                    className="po-split-chevron"
                    aria-label={t('post_now', 'Post Now')}
                    aria-haspopup="menu"
                    aria-expanded={postMenuOpen}
                    aria-controls="post-now-menu"
                    disabled={loading || locked}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      togglePostMenu(event.detail === 0);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        postMenuKeyboard.current = true;
                        setPostMenuFocus((tick) => tick + 1);
                        setPostMenuPinned(true);
                      }
                    }}
                  >
                    <DropdownArrowSmallIcon
                      className={clsx(
                        'text-[#0A0A0A]',
                        postMenuOpen && 'rotate-180'
                      )}
                    />
                  </button>
                )}

                {!dummy && (
                  <div
                    id="post-now-menu"
                    ref={postMenuRef}
                    role="menu"
                    aria-label={t('post_now', 'Post Now')}
                    onKeyDown={onPostMenuKeyDown}
                    onClick={(event) => {
                      if (
                        !(event.target as HTMLElement).closest?.(
                          '[role="menuitem"]'
                        )
                      ) {
                        return;
                      }
                      closePostMenu(event.detail === 0);
                    }}
                    className={clsx(
                      'post-now-tray po-post-menu',
                      postMenuOpen ? 'flex' : 'hidden'
                    )}
                  >
                    <div className="arc-grab" aria-hidden />
                    <button
                      type="button"
                      role="menuitem"
                      disabled={
                        selectedIntegrations.length === 0 || loading || locked
                      }
                      onClick={schedule('schedule')}
                    >
                      <CalendarIcon />
                      <span>{t('add_to_calendar', 'Add to calendar')}</span>
                      <CheckmarkIcon />
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={
                        selectedIntegrations.length === 0 || loading || locked
                      }
                      onClick={schedule('now')}
                    >
                      <HugeIcon name="send" size={16} />
                      <span>{t('post_now', 'Post Now')}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="c8-copilot" aria-hidden="true" inert>
      <CopilotPopup
        className="po-assist"
        hitEscapeToClose={false}
        clickOutsideToClose={true}
        instructions={`
You are an assistant that help the user to schedule their social media posts,
Here are the things you can do:
- Add a new comment / post to the list of posts
- Delete a comment / post from the list of posts
- Add content to the comment / post
- Activate or deactivate the comment / post

Post content can be added using the addPostContentFor{num} function.
After using the addPostFor{num} it will create a new addPostContentFor{num+ 1} function.
`}
        icons={{
          sendIcon: (
            <HugeIcon name="send" size={16} />
          ),
        }}
        labels={{
          title: t('composer_assistant_title', 'Your Assistant'),
          initial: t(
            'assistant_initial_message',
            'Hi! I can help you to refine your social media posts.'
          ),
          placeholder: t('ask_the_assistant', 'Ask the assistant…'),
        }}
      />
      </div>
    </div>
  );
};

const Scrollable: FC<{
  className: string;
  scrollClasses: string;
  children: ReactNode;
}> = ({ className, scrollClasses, children }) => {
  const ref = useRef(undefined);
  const hasScroll = useHasScroll(ref);
  return (
    <div className={clsx(className, hasScroll && scrollClasses)} ref={ref}>
      {children}
    </div>
  );
};
