'use client';

import { TopTitle } from '@gitroom/frontend/components/launches/helpers/top.title.component';
import React, { FC, FormEventHandler, useCallback, useState } from 'react';
import { Integrations } from '@gitroom/frontend/components/launches/calendar.context';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { Input } from '@gitroom/react/form/input';
import { Button } from '@gitroom/react/form/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { showMediaBox } from '@gitroom/frontend/components/media/media.component';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
export const BotPicture: FC<{
  integration: Integrations;
  canChangeProfilePicture: boolean;
  canChangeNickName: boolean;
  mutate: () => void;
}> = (props) => {
  const t = useT();
  const modal = useModals();
  const toast = useToaster();
  const [nick, setNickname] = useState(props.integration.name);
  const [picture, setPicture] = useState(
    props.integration.picture || '/no-picture.jpg'
  );
  const fetch = useFetch();
  const submitForm: FormEventHandler<HTMLFormElement> = useCallback(
    async (e) => {
      e.preventDefault();
      await fetch(`/integrations/${props.integration.id}/nickname`, {
        method: 'POST',
        body: JSON.stringify({
          name: nick,
          picture,
        }),
      });
      props.mutate();
      toast.show(t('updated', 'Updated'), 'success');
      modal.closeAll();
    },
    [nick, picture, props.mutate]
  );
  const openMedia = useCallback(() => {
    showMediaBox((values) => {
      setPicture(values.path);
    });
  }, []);
  return (
    <div className="rounded-[4px] border border-customColor6 bg-sixth px-[16px] pb-[16px] relative w-full">
      <TopTitle title={t('change_bot_picture_title', 'Change Bot Picture')} />
      <button
        className="outline-none absolute end-[20px] top-[20px] mantine-UnstyledButton-root mantine-ActionIcon-root hover:bg-tableBorder cursor-pointer mantine-Modal-close mantine-1dcetaa"
        type="button"
        onClick={() => modal.closeAll()}
      >
        <HugeIcon name="close" size={16} />
      </button>

      <div className="mt-[16px]">
        <form onSubmit={submitForm} className="gap-[50px] flex flex-col">
          {props.canChangeProfilePicture && (
            <div className="flex items-center gap-[20px]">
              <img
                src={picture}
                alt="Bot Picture"
                className="w-[100px] h-[100px] rounded-full"
              />
              <Button type="button" onClick={openMedia}>
                {t('upload', 'Upload')}
              </Button>
            </div>
          )}
          {props.canChangeNickName && (
            <Input
              value={nick}
              onChange={(e) => setNickname(e.target.value)}
              name="Nickname"
              label={t('label_nickname', 'Nickname')}
              placeholder=""
              disableForm={true}
            />
          )}

          <div className="mt-[50px]">
            <Button type="submit">{t('save', 'Save')}</Button>
          </div>
        </form>
      </div>
    </div>
  );
};
