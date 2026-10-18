'use client';

import { FC, Fragment, useCallback } from 'react';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

const useApprovedApps = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return (await fetch('/user/approved-apps')).json();
  }, []);
  return useSWR('approved-apps', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
  });
};

export const ApprovedAppsComponent: FC = () => {
  const fetch = useFetch();
  const toaster = useToaster();
  const t = useT();
  const { data: apps, mutate } = useApprovedApps();

  const revokeApp = useCallback(
    (app: any) => async () => {
      if (
        await deleteDialog(
          t(
            'are_you_sure_revoke_access',
            `Are you sure you want to revoke access for ${app.oauthApp?.name}?`,
            { name: app.oauthApp?.name }
          )
        )
      ) {
        try {
          await fetch(`/user/approved-apps/${app.id}`, {
            method: 'DELETE',
          });
          toaster.show(
            t('access_revoked', 'Access revoked successfully'),
            'success'
          );
          mutate();
        } catch {
          toaster.show(t('failed_to_revoke', 'Failed to revoke access'), 'warning');
        }
      }
    },
    []
  );

  if (apps === undefined) {
    return null;
  }

  return (
    <div className="settings-section">
      <div className="settings-head">
        <div>
          <h1>{t('approved_apps', 'Approved Apps')}</h1>
          <p>
            {t(
              'apps_you_have_authorized',
              'Applications you have authorized to access your Crea8one account.'
            )}
          </p>
        </div>
      </div>

      <div className="settings-list">
        {!apps?.length ? (
          <div className="settings-empty">
            <span className="settings-empty-mark" aria-hidden>
              <HugeIcon name="check" size={25} />
            </span>
            <h2>{t('no_approved_apps', 'No approved apps yet.')}</h2>
          </div>
        ) : (
          <div className="flex flex-col gap-[16px]">
            {apps.map((app: any) => (
              <div
                key={app.id}
                className="settings-app flex items-center justify-between p-[12px] border border-fifth rounded-[4px]"
              >
                <div className="flex items-center gap-[12px]">
                  {app.oauthApp?.picture?.path ? (
                    <img
                      src={app.oauthApp.picture.path}
                      alt={app.oauthApp.name}
                      className="w-[40px] h-[40px] rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-[40px] h-[40px] rounded-full bg-fifth flex items-center justify-center text-customColor18">
                      {app.oauthApp?.name?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div>
                    <div className="text-[14px] font-bold">
                      {app.oauthApp?.name}
                    </div>
                    {app.oauthApp?.description && (
                      <div className="text-customColor18 text-[12px]">
                        {app.oauthApp.description}
                      </div>
                    )}
                    <div className="text-customColor18 text-[12px]">
                      {t('authorized_on', 'Authorized on')}{' '}
                      {new Date(app.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <Button secondary className="settings-danger" onClick={revokeApp(app)}>
                  {t('revoke', 'Revoke')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
