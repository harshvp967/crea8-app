'use client';

import React, {
  FC,
  MouseEventHandler,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { TimeTable } from '@gitroom/frontend/components/launches/time.table';
import {
  Integrations,
  useCalendar,
} from '@gitroom/frontend/components/launches/calendar.context';
import { BotPicture } from '@gitroom/frontend/components/launches/bot.picture';
import { CustomerModal } from '@gitroom/frontend/components/launches/customer.modal';
import { Integration } from '@prisma/client';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { SettingsModal } from '@gitroom/frontend/components/launches/settings.modal';
import { CustomVariables } from '@gitroom/frontend/components/launches/add.provider.component';
import { useRouter } from 'next/navigation';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { AddEditModal } from '@gitroom/frontend/components/new-launch/add.edit.modal';
import dayjs from 'dayjs';
import { ModalWrapperComponent } from '@gitroom/frontend/components/new-launch/modal.wrapper.component';
import copy from 'copy-to-clipboard';

export const Menu: FC<{
  canEnable: boolean;
  canDisable: boolean;
  canChangeProfilePicture: boolean;
  canChangeNickName: boolean;
  refreshChannel: (
    integration: Integration & {
      identifier: string;
    }
  ) => () => void;
  id: string;
  mutate: () => void;
  onChange: (shouldReload: boolean) => void;
}> = (props) => {
  const {
    canEnable,
    canDisable,
    id,
    onChange,
    mutate,
    canChangeProfilePicture,
    canChangeNickName,
    refreshChannel,
  } = props;
  const t = useT();

  const fetch = useFetch();
  const router = useRouter();
  const { extensionId } = useVariables();
  const { integrations, reloadCalendarView } = useCalendar();
  const toast = useToaster();
  const modal = useModals();
  const [show, setShow] = useState<false | { x: number; y: number }>(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const showRef = useRef(undefined);
  const menuGap = 6;
  const menuPad = 10;

  const menuPlace = useCallback(() => {
    const trigger = ref.current?.getBoundingClientRect();
    const row =
      ref.current?.closest('.channel-row, .channel-chip')?.getBoundingClientRect() ||
      trigger;
    if (!trigger || !row) {
      return null;
    }
    return {
      x: trigger.right + menuGap,
      y: row.top,
    };
  }, [ref]);

  // Sit beside the three-dots, top-aligned with the row. If that runs off
  // the viewport, shift the card up (and in from the right) until it fits.
  // Open, close, and item actions stay put.
  useLayoutEffect(() => {
    if (!show || !menuRef.current) {
      return;
    }
    const menuRect = menuRef.current.getBoundingClientRect();
    let x = show.x;
    let y = show.y;
    if (menuRect.bottom > window.innerHeight - menuPad) {
      y = Math.max(menuPad, window.innerHeight - menuPad - menuRect.height);
    }
    if (y < menuPad) {
      y = menuPad;
    }
    if (menuRect.right > window.innerWidth - menuPad) {
      x = Math.max(menuPad, window.innerWidth - menuPad - menuRect.width);
    }
    if (Math.abs(show.x - x) > 1 || Math.abs(show.y - y) > 1) {
      setShow({ x, y });
    }
  }, [show]);
  useEffect(() => {
    const onOutside = (event: Event) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (ref.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setShow(false);
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('touchstart', onOutside);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('touchstart', onOutside);
    };
  }, []);
  useEffect(() => {
    if (!show) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShow(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [show]);
  // The menu is portaled, so keep it on its row while the rail or window
  // moves. Escape and a click outside are still the only ways to close it.
  useEffect(() => {
    if (!show) {
      return;
    }
    const place = () => {
      const next = menuPlace();
      const menu = menuRef.current;
      if (!next || !menu) {
        return;
      }
      let x = next.x;
      let y = next.y;
      const width = menu.offsetWidth;
      const height = menu.offsetHeight;
      if (y + height > window.innerHeight - menuPad) {
        y = Math.max(menuPad, window.innerHeight - menuPad - height);
      }
      if (y < menuPad) {
        y = menuPad;
      }
      if (x + width > window.innerWidth - menuPad) {
        x = Math.max(menuPad, window.innerWidth - menuPad - width);
      }
      setShow((current) => {
        if (!current) {
          return current;
        }
        if (Math.abs(current.x - x) <= 1 && Math.abs(current.y - y) <= 1) {
          return current;
        }
        return { x, y };
      });
    };
    const onScroll = (event: Event) => {
      const target = event.target as Node | null;
      if (target && menuRef.current?.contains(target)) {
        return;
      }
      place();
    };
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', place, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', place);
    };
  }, [show, menuPlace]);
  const findIntegration: any = useMemo(() => {
    return integrations.find((integration) => integration.id === id);
  }, [integrations, id]);
  const changeShow: MouseEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      e.stopPropagation();
      if (show) {
        setShow(false);
        return;
      }
      const next = menuPlace();
      if (next) {
        setShow(next);
      }
    },
    [show, menuPlace]
  );
  const disableChannel = useCallback(async () => {
    if (
      !(await deleteDialog(
        t('are_you_sure_disable_channel', 'Are you sure you want to disable this channel?'),
        t('disable_channel_title', 'Disable Channel'),
        t('disable_channel_title', 'Disable Channel'),
        t('no_cancel', 'No, cancel!'),
        'danger'
      ))
    ) {
      return;
    }
    await fetch('/integrations/disable', {
      method: 'POST',
      body: JSON.stringify({
        id,
      }),
    });
    toast.show(t('channel_disabled', 'Channel Disabled'), 'success');
    setShow(false);
    onChange(false);
  }, [t]);
  const deleteChannel = useCallback(async () => {
    if (
      !(await deleteDialog(
        t('are_you_sure_delete_channel', 'Are you sure you want to delete this channel?'),
        t('delete_channel_title', 'Delete Channel'),
        t('delete_channel_title', 'Delete Channel'),
        t('no_cancel', 'No, cancel!'),
        'danger'
      ))
    ) {
      return;
    }
    const deleteIntegration = await fetch('/integrations', {
      method: 'DELETE',
      body: JSON.stringify({
        id,
      }),
    });
    if (deleteIntegration.status === 406) {
      toast.show(
        t('delete_posts_before_channel', 'You have to delete all the posts associated with this channel before deleting it'),
        'warning'
      );
      return;
    }
    // Clean up extension refresh token if applicable
    if (
      extensionId &&
      typeof chrome !== 'undefined' &&
      chrome?.runtime?.sendMessage
    ) {
      try {
        chrome.runtime.sendMessage(
          extensionId,
          { type: 'REMOVE_REFRESH_TOKEN', integrationId: id },
          () => {}
        );
      } catch {
        // Silently ignore
      }
    }
    toast.show(t('channel_deleted', 'Channel Deleted'), 'success');
    setShow(false);
    onChange(true);
  }, [t, extensionId, id]);

  const enableChannel = useCallback(async () => {
    await fetch('/integrations/enable', {
      method: 'POST',
      body: JSON.stringify({
        id,
      }),
    });
    toast.show(t('channel_enabled', 'Channel Enabled'), 'success');
    setShow(false);
    onChange(false);
  }, [t]);

  const editTimeTable = useCallback(() => {
    const findIntegration = integrations.find(
      (integration) => integration.id === id
    );
    modal.openModal({
      withCloseButton: true,
      closeOnEscape: false,
      closeOnClickOutside: false,
      askClose: true,
      title: t('time_table_slots', 'Time Table Slots'),
      children: <TimeTable integration={findIntegration!} mutate={mutate} />,
    });
    setShow(false);
  }, [integrations, t]);

  const copyChannelId = useCallback(
    (integration: Integrations) => async () => {
      setShow(false);
      const channelId = integration.id;
      copy(channelId);
      toast.show(t('channel_id_copied', 'Channel ID copied to clipboard'), 'success');
    },
    [t]
  );

  const createPost = useCallback(
    (integration: Integrations) => async () => {
      setShow(false);

      const { date } = await (
        await fetch(`/posts/find-slot/${integration.id}`)
      ).json();

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
            allIntegrations={integrations.map((p) => ({
              ...p,
            }))}
            reopenModal={createPost(integration)}
            mutate={reloadCalendarView}
            integrations={integrations}
            selectedChannels={[integration.id]}
            // focusedChannel={integration.id}
            date={dayjs.utc(date).local()}
          />
        ),
        size: '80%',
        title: ``,
      });
    },
    [integrations]
  );

  const changeBotPicture = useCallback(() => {
    const findIntegration = integrations.find(
      (integration) => integration.id === id
    );
    modal.openModal({
      classNames: {
        modal: 'w-[100%] max-w-[600px] bg-transparent text-textColor',
      },
      size: '100%',
      withCloseButton: false,
      closeOnEscape: true,
      closeOnClickOutside: true,
      children: (
        <BotPicture
          canChangeProfilePicture={canChangeProfilePicture}
          canChangeNickName={canChangeNickName}
          integration={findIntegration!}
          mutate={mutate}
        />
      ),
    });
    setShow(false);
  }, [integrations]);
  const additionalSettings = useCallback(() => {
    const findIntegration = integrations.find(
      (integration) => integration.id === id
    );
    modal.openModal({
      title: t('additional_settings', 'Additional Settings'),
      children: (
        <SettingsModal
          // @ts-ignore
          integration={findIntegration}
          onClose={() => {
            mutate();
            toast.show(t('settings_updated', 'Settings Updated'), 'success');
          }}
        />
      ),
    });
    setShow(false);
  }, [integrations, t]);
  const addToCustomer = useCallback(() => {
    const findIntegration = integrations.find(
      (integration) => integration.id === id
    );
    modal.openModal({
      classNames: {
        modal: 'md',
      },
      title: t('move_add_to_group', 'Move / Add to group'),
      withCloseButton: false,
      closeOnEscape: true,
      closeOnClickOutside: true,
      children: (
        <CustomerModal
          // @ts-ignore
          integration={findIntegration}
          onClose={() => {
            mutate();
            toast.show(t('customer_updated', 'Customer Updated'), 'success');
          }}
        />
      ),
    });
    setShow(false);
  }, [integrations, t]);
  const updateCredentials = useCallback(() => {
    modal.openModal({
      title: t('custom_url', 'Custom URL'),
      withCloseButton: false,
      classNames: {
        modal: 'md',
      },
      children: (
        <CustomVariables
          identifier={findIntegration.identifier}
          gotoUrl={(url: string) => router.push(url)}
          variables={findIntegration.customFields}
        />
      ),
    });
  }, [t]);

  return (
    <div
      className="cursor-pointer relative select-none flex"
      onClick={changeShow}
      ref={ref}
    >
      <HugeIcon name="more-v" size={20} className="text-menuDots group-hover/profile:text-menuDotsHover" />
      <div>
        <div ref={showRef} />
      </div>
      {show &&
        createPortal(
        <div
          ref={menuRef}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{ left: show.x, top: show.y }}
          className="channel-menu-pop fixed p-[8px] bg-newBgColorInner shadow-menu flex flex-col gap-[2px] z-[100] rounded-[22px] border border-newBorder text-nowrap"
        >
          {canDisable && !findIntegration?.refreshNeeded && (
            <div
              className="channel-menu-item flex gap-[12px] items-center py-[8px] px-[10px]"
              onClick={createPost(findIntegration!)}
            >
              <div>
                <HugeIcon name="plus" size={18} />
              </div>
              <div className="text-[14px]">
                {t('create_new_post', 'Create a new post')}
              </div>
            </div>
          )}
          <div
            className="channel-menu-item flex gap-[12px] items-center py-[8px] px-[10px]"
            onClick={copyChannelId(findIntegration)}
          >
            <div>
              <HugeIcon name="copy" size={18} />
            </div>
            <div className="text-[14px]">{t('copy_id', 'Copy Channel ID')}</div>
          </div>
          {canDisable &&
            findIntegration?.refreshNeeded &&
            !findIntegration.customFields && (
              <div
                className="channel-menu-item flex gap-[12px] items-center py-[8px] px-[10px]"
                onClick={refreshChannel(findIntegration!)}
              >
                <div>
                  <HugeIcon name="refresh" size={18} />
                </div>
                <div className="text-[14px]">
                  {t('reconnect_channel', 'Reconnect channel')}
                </div>
              </div>
            )}
          {!!findIntegration?.isCustomFields && (
            <div
              className="channel-menu-item flex gap-[12px] items-center py-[8px] px-[10px]"
              onClick={updateCredentials}
            >
              <div>
                <HugeIcon name="refresh" size={18} />
              </div>
              <div className="text-[14px]">
                {t('update_credentials', 'Update Credentials')}
              </div>
            </div>
          )}
          {findIntegration?.additionalSettings !== '[]' && (
            <div
              className="channel-menu-item flex gap-[12px] items-center py-[8px] px-[10px]"
              onClick={additionalSettings}
            >
              <div>
                <HugeIcon name="settings" size={18} />
              </div>
              <div className="text-[14px]">
                {t('additional_settings', 'Additional Settings')}
              </div>
            </div>
          )}
          {(canChangeProfilePicture || canChangeNickName) && (
            <div
              className="channel-menu-item flex gap-[12px] items-center py-[8px] px-[10px]"
              onClick={changeBotPicture}
            >
              <div>
                <HugeIcon name="image" size={18} />
              </div>
              <div className="text-[14px]">
                {t('change_bot', 'Change Bot')}{' '}
                {[
                  canChangeProfilePicture && t('picture', 'Picture'),
                  canChangeNickName && t('label_nickname', 'Nickname'),
                ]
                  .filter((f) => f)
                  .join(' / ')}
              </div>
            </div>
          )}
          <div
            className="channel-menu-item flex gap-[12px] items-center py-[8px] px-[10px]"
            onClick={addToCustomer}
          >
            <div>
              <HugeIcon name="user-add" size={18} />
            </div>
            <div className="text-[14px]">
              {t('move_add_to_group', 'Move / add to group')}
            </div>
          </div>
          <div
            className="channel-menu-item flex gap-[12px] items-center py-[8px] px-[10px]"
            onClick={editTimeTable}
          >
            <div>
              <HugeIcon name="clock" size={18} />
            </div>
            <div className="text-[14px]">
              {t('edit_time_slots', 'Edit Time Slots')}
            </div>
          </div>
          {canEnable && (
            <div
              className="channel-menu-item flex gap-[12px] items-center py-[8px] px-[10px]"
              onClick={enableChannel}
            >
              <div>
                <HugeIcon name="check-badge" size={16} />
              </div>
              <div className="text-[14px]">
                {t('enable_channel', 'Enable Channel')}
              </div>
            </div>
          )}

          {canDisable && (
            <div
              className="channel-menu-item flex gap-[12px] items-center py-[8px] px-[10px]"
              onClick={disableChannel}
            >
              <div>
                <HugeIcon name="unavailable" size={16} />
              </div>
              <div className="text-[14px]">
                {t('disable_channel', 'Disable Channel')}
              </div>
            </div>
          )}

          <div
            className="channel-menu-item is-danger flex gap-[12px] items-center py-[8px] px-[10px]"
            onClick={deleteChannel}
          >
            <div>
              <HugeIcon name="trash" size={16} />
            </div>
            <div className="text-[14px]">{t('delete', 'Delete')}</div>
          </div>
        </div>,
          document.body
        )}
    </div>
  );
};
