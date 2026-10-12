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

export const ManageModal: FC<AddEditModalProps> = (props) => {
  const t = useT();
  const fetch = useFetch();
  const ref = useRef(null);
  const existingData = useExistingData();
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<null | 'draft' | 'submit'>(null);
  const toaster = useToaster();
  const modal = useModals();
  const [showSettings, setShowSettings] = useState(false);
  const [phonePane, setPhonePane] = useState<'editor' | 'preview'>('editor');
  const [issue, setIssue] = useState<{ title: string; body: string } | null>(null);
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
  } = useLaunchStore(
    useShallow((state) => ({
      hide: state.hide,
      setHide: state.setHide,
      date: state.date,
      setDate: state.setDate,
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

  const currentIntegrationText = useMemo(() => {
    if (current === 'global') {
      return (
        <div className="flex items-center gap-[10px]">
          <div className="relative">
            <SettingsIcon size={15} className="text-white" />
          </div>
          <div>Settings</div>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-[8px]">
        <SettingsIcon size={16} className="text-textItemBlur" />
        <div>{t('settings', 'Settings')}</div>
      </div>
    );
  }, [current]);

  const changeCustomer = useCallback(
    (customer: string) => {
      const neededIntegrations = integrations.filter(
        (p) => p?.customer?.id === customer
      );
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
    if (!activateExitButton || dummy) {
      return;
    }

    if (
      await deleteDialog(
        t(
          'are_you_sure_you_want_to_close_this_modal_all_data_will_be_lost',
          'Are you sure you want to close this modal? (all data will be lost)'
        ),
        t('yes_close_it', 'Yes, close it!'),
        undefined,
        undefined,
        'danger'
      )
    ) {
      if (customClose) {
        customClose();
        return;
      }
      modal.closeAll();
    }
  }, [activateExitButton, dummy]);

  const deletePost = useCallback(async () => {
    setLoading(true);
    if (
      !(await deleteDialog(
        t(
          'are_you_sure_you_want_to_delete_post',
          'Are you sure you want to delete this post?'
        ),
        t('yes_delete_it', 'Yes, delete it!')
      ))
    ) {
      setLoading(false);
      return;
    }
    await fetch(`/posts/${existingData.group}`, {
      method: 'DELETE',
    });
    mutate();
    modal.closeAll();
    return;
  }, [existingData, mutate, modal]);

  const schedule = useCallback(
    (type: 'draft' | 'now' | 'schedule' | 'update') => async () => {
      let republish = false;
      if (
        (type === 'now' || type === 'schedule') &&
        (existingData?.posts?.[0]?.state === 'PUBLISHED' ||
          (existingData?.posts?.[0]?.state === 'QUEUE' &&
            dayjs().isAfter(date.utc())))
      ) {
        const channels = selectedIntegrations
          .map((p) => p.integration.name)
          .join(', ');
        const isRecurring =
          !!repeater || !!existingData?.posts?.[0]?.intervalInDays;

        const whatToDo = await new Promise((resolve) => {
          modal.openModal({
            title: t('what_do_you_want_to_do', 'What do you want to do?'),
            classNames: { modal: 'po-edit-modal' },
            size: '500px',
            children: (
              <div className="po-edit">
                <p className="po-edit-copy">
                  {t(
                    'post_already_published_republish_warning',
                    'This post was already published. Republishing will publish it again to'
                  )}{' '}
                  {channels} {t('republish_at', 'at')}{' '}
                  {date.format('DD/MM/YYYY HH:mm')}.
                </p>
                {isRecurring && (
                  <div className="po-edit-note">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M20 4v4h-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M20 12a8 8 0 0 1-13.7 5.6L4 16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M4 20v-4h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
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
                    onClick={() => resolve('update')}
                  >
                    {t(
                      'just_update_post_details',
                      'Just update the post details'
                    )}
                  </Button>
                  <Button
                    type="button"
                    className="po-edit-republish"
                    onClick={() => resolve('republish')}
                  >
                    {t('republish_the_post', 'Republish the post')}
                  </Button>
                </div>
              </div>
            ),
          });
        });

        if (whatToDo === 'update') {
          type = 'update';
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
        group,
        settings: { ...(post.settings || {}) },
        value: post.values.map((value: any) => ({
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

        if (type !== 'draft') {
          for (const item of checkAllValid) {
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
              const message = `${item.name} (${item.identifier}) ${t(
                'post_is_too_long',
                'post is too long, please fix it'
              )}`;
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
                'Do you want to shortlink the URLs? it will let you get statistics over clicks'
              ),
              t('yes_shortlink_it', 'Yes, shortlink it!'),
              undefined,
              t('no_original_urls', 'No, original URLs')
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
        addEditSets
          ? addEditSets(data)
          : await fetch('/posts', {
              method: 'POST',
              body: JSON.stringify(data),
            });

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
          modal.closeAll();
        }
      }
    },
    [ref, repeater, tags, date, addEditSets, dummy, shortlinkPreferenceData]
  );

  return (
    <div className={clsx('composer w-full h-full flex-1 p-[40px] flex relative', phonePane === 'preview' && 'composer-show-preview', issue && 'composer-invalid')}>
      <div className="composer-frame flex flex-1 bg-newBgColorInner rounded-[20px] flex-col min-h-0">
        <div className="arc-grab composer-grab" aria-hidden />
        <div className="composer-tabs" role="tablist">
          <span className="composer-tabs-title">{t('create_post_title', 'Create Post')}</span>
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
              {t('create_post_title', 'Create Post')}
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
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex flex-1 gap-[6px] flex-col">
                    <div>{!existingData.integration && <SelectCurrent />}</div>
                    {issue && (
                      <div className="po-valid" role="alert">
                        <div className="po-valid-copy">
                          <div className="po-valid-title">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                              <path d="M12 3.5 21.5 20.5H2.5L12 3.5Z" stroke="#F04438" strokeWidth="1.6" strokeLinejoin="round" />
                              <path d="M12 10v4.5" stroke="#F04438" strokeWidth="1.6" strokeLinecap="round" />
                              <circle cx="12" cy="17.2" r="0.8" fill="#F04438" />
                            </svg>
                            <span>{issue.title}</span>
                          </div>
                          <div className="po-valid-body">{issue.body}</div>
                        </div>
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
                  <div
                    onClick={() => setShowSettings(!showSettings)}
                    className="flex items-center gap-[8px] cursor-pointer px-[14px] py-[12px]"
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
                  </div>
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
            <div className="bg-newBgColor h-[65px] rounded-e-[26px] !rounded-b-[0] flex items-center px-[20px] text-[20px] font-[600]">
              <div className="flex-1">{t('post_preview', 'Post Preview')}</div>
              <div className="cursor-pointer">
                <CloseIcon onClick={askClose} className="text-[#A3A3A3]" />
              </div>
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
                className="cursor-pointer flex text-[#FF3F3F] gap-[8px] items-center text-[15px] font-[600]"
              >
                <div>
                  <TrashIcon />
                </div>
                <div>{t('delete_post', 'Delete Post')}</div>
              </button>
            )}
            <DatePicker onChange={setDate} date={date} />
            {!addEditSets && (
              <button
                disabled={
                  selectedIntegrations.length === 0 || loading || locked
                }
                onClick={schedule('draft')}
                className="relative cursor-pointer disabled:cursor-not-allowed px-[20px] h-[44px] bg-btnSimple border border-newBorder justify-center items-center flex rounded-[18px] text-[15px] font-[500]"
              >
                {loading && busy === 'draft' && (
                  <div className="absolute left-[50%] top-[50%] -translate-y-[50%] -translate-x-[50%]">
                    <div className="po-spin" />
                  </div>
                )}
                <div className={clsx(loading && busy === 'draft' && 'invisible')}>
                  {t('save_as_draft', 'Save as Draft')}
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
                Save Set
              </button>
            )}
            {!addEditSets && (
              <div className="group po-split cursor-pointer relative">
                <button
                  disabled={
                    selectedIntegrations.length === 0 || loading || locked
                  }
                  onClick={schedule('schedule')}
                  className="po-split-main text-[#0A0A0A] relative btnSub disabled:cursor-not-allowed disabled:opacity-80 outline-none flex justify-center items-center"
                >
                  {loading && busy === 'submit' && (
                    <div className="absolute left-[50%] top-[50%] -translate-y-[50%] -translate-x-[50%] text-[#0A0A0A]">
                      <div className="po-spin" />
                    </div>
                  )}
                  <span className={clsx(loading && busy === 'submit' && 'invisible')}>
                    {selectedIntegrations.length === 0
                      ? t('check_circles_above', 'Check the circles above')
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
                    type="button"
                    className="po-split-chevron"
                    aria-label={t('post_now', 'Post Now')}
                    disabled={loading || locked}
                  >
                    <DropdownArrowSmallIcon className="group-hover:rotate-180 text-[#0A0A0A]" />
                  </button>
                )}

                {!dummy && (
                  <div className="post-now-tray po-post-menu hidden group-hover:flex">
                    <button
                      type="button"
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
                      disabled={
                        selectedIntegrations.length === 0 || loading || locked
                      }
                      onClick={schedule('now')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="M21 3 10.5 13.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                        <path d="M21 3 14.5 21l-4-7.5L3 9.5 21 3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                      </svg>
                      <span>{t('post_now', 'Post Now')}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M21 3 10.5 13.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              <path d="M21 3 14.5 21l-4-7.5L3 9.5 21 3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            </svg>
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
