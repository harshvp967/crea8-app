import React, { FC, Fragment, useCallback } from 'react';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { Button } from '@gitroom/react/form/button';
import clsx from 'clsx';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { TopTitle } from '@gitroom/frontend/components/launches/helpers/top.title.component';
import { array, boolean, object, string } from 'yup';
import { FormProvider, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { CopilotTextarea } from '@copilotkit/react-textarea';
import { Select } from '@gitroom/react/form/select';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
export const SignaturesComponent: FC<{
  appendSignature?: (value: string) => void;
}> = (props) => {
  const { appendSignature } = props;
  const fetch = useFetch();
  const modal = useModals();
  const toaster = useToaster();
  const load = useCallback(async () => {
    return (await fetch('/signatures')).json();
  }, []);
  const { data, mutate } = useSWR('signatures', load);
  const addSignature = useCallback(
    (data?: any) => () => {
      modal.openModal({
        title: data ? 'Edit Signature' : 'Add Signature',
        withCloseButton: true,
        size: '500px',
        children: <AddOrRemoveSignature data={data} reload={mutate} />,
      });
    },
    [mutate]
  );

  const deleteSignature = useCallback(
    (data: any) => async () => {
      if (
        await deleteDialog(
          t(
            'are_you_sure_you_want_to_delete',
            `Are you sure you want to delete?`,
            { name: data.content.slice(0, 15) + '...' }
          )
        )
      ) {
        await fetch(`/signatures/${data.id}`, {
          method: 'DELETE',
        });
        mutate();
        toaster.show('Signature deleted successfully', 'success');
      }
    },
    []
  );

  const t = useT();

  return (
    <div className="settings-section">
      <div className="settings-head">
        <div>
          <h1>{t('signatures', 'Signatures')}</h1>
          <p>
            {t(
              'you_can_add_signatures_to_your_account_to_be_used_in_your_posts',
              'You can add signatures to your account to be used in your posts.'
            )}
          </p>
        </div>
        <Button onClick={addSignature()}>
          + {t('add_a_signature', 'Add a signature')}
        </Button>
      </div>
      {!!data?.length && (
        <div className="settings-list">
          <div className="settings-cols cols-sig">
            <span>{t('content', 'Content')}</span>
            <span>{t('auto_add', 'Auto Add?')}</span>
            <span>{t('actions', 'Actions')}</span>
          </div>
          {data.map((p: any) => (
            <article key={p.id} className="settings-item cols-sig">
              <b className="settings-ellipsis">{p.content}</b>
              <span
                className={clsx('settings-pill', p.autoAdd && 'is-on')}
                data-label={t('auto_add', 'Auto Add?')}
              >
                {p.autoAdd ? t('yes', 'Yes') : t('no', 'No')}
              </span>
              <div className="settings-item-actions" data-label={t('actions', 'Actions')}>
                {!!appendSignature && (
                  <Button secondary className="settings-mini" onClick={() => appendSignature(p.content)}>
                    {t('use_signature', 'Use Signature')}
                  </Button>
                )}
                <Button secondary className="settings-mini" onClick={addSignature(p)}>
                  {t('edit', 'Edit')}
                </Button>
                <Button secondary className="settings-mini settings-danger" onClick={deleteSignature(p)}>
                  {t('delete', 'Delete')}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
const details = object().shape({
  content: string().required(),
  autoAdd: boolean().required(),
});
const AddOrRemoveSignature: FC<{
  data?: any;
  reload: () => void;
}> = (props) => {
  const { data, reload } = props;
  const toast = useToaster();
  const fetch = useFetch();
  const form = useForm({
    resolver: yupResolver(details),
    values: {
      content: data?.content || '',
      autoAdd: data?.autoAdd || false,
    },
  });
  const text = form.watch('content');
  const autoAdd = form.watch('autoAdd');
  const modal = useModals();
  const callBack = useCallback(
    async (values: any) => {
      await fetch(data?.id ? `/signatures/${data.id}` : '/signatures', {
        method: data?.id ? 'PUT' : 'POST',
        body: JSON.stringify(values),
      });
      toast.show(
        data?.id
          ? 'Signature updated successfully'
          : 'Signature added successfully',
        'success'
      );
      modal.closeCurrent();
      reload();
    },
    [data, modal]
  );

  const t = useT();

  return (
    <FormProvider {...form}>
      <form className="settings-form" onSubmit={form.handleSubmit(callBack)}>
        <div className="relative flex gap-[20px] flex-col flex-1 rounded-[4px] pt-0">
          <button
            className="outline-none absolute end-[20px] top-[15px] mantine-UnstyledButton-root mantine-ActionIcon-root hover:bg-tableBorder cursor-pointer mantine-Modal-close mantine-1dcetaa"
            type="button"
            onClick={() => modal.closeCurrent()}
          >
            <HugeIcon name="close" size={16} />
          </button>

          <div className="relative bg-customColor2">
            <CopilotTextarea
              disableBranding={true}
              className={clsx(
                '!min-h-40 !max-h-80 p-2 overflow-x-hidden scrollbar scrollbar-thumb-[#00D9FF] bg-bigStrip outline-none'
              )}
              value={text}
              onChange={(e) => {
                form.setValue('content', e.target.value);
              }}
              placeholder="Write your signature..."
              autosuggestionsConfig={{
                textareaPurpose: `Assist me in writing social media signature`,
                chatApiConfigs: {},
              }}
            />
          </div>

          <Select
            label="Auto add signature?"
            translationKey="label_auto_add_signature"
            {...form.register('autoAdd', {
              setValueAs: (value) => value === 'true',
            })}
          >
            <option value="false">
              {t('no', 'No')}
            </option>
            <option value="true">
              {t('yes', 'Yes')}
            </option>
          </Select>

          <Button type="submit">{t('save', 'Save')}</Button>
        </div>
      </form>
    </FormProvider>
  );
};
