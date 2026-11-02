'use client';

import { FC, Fragment, useCallback } from 'react';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import {
  OauthClientLogo,
  OauthClientTile,
  resolveOauthClientBrand,
} from '@gitroom/frontend/components/oauth/client-brand';
import { SettingsListSkeleton } from '@gitroom/frontend/components/ui/skeleton';

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
          t('cant_be_undone', "This can't be undone."),
          t('revoke_access', 'Revoke'),
          t('revoke_access_title', 'Revoke access for {{name}}?', {
            name: app.oauthApp?.name,
          }),
          t('cancel', 'Cancel')
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
    return (
      <div className="settings-section">
        <SettingsListSkeleton />
      </div>
    );
  }

  return (
    <div className="settings-section">
      <div className="settings-head">
        <div>
          <h1>{t('approved_apps', 'Approved Apps')}</h1>
          <p>
            {t(
              'apps_you_have_authorized',
              'Applications you have authorized to access your crea8.one account.'
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
            {apps.map((app: any) => {
              const brand = app.oauthApp?.picture?.path
                ? null
                : resolveOauthClientBrand(app.oauthApp?.name);
              return (
              <div
                key={app.id}
                className="settings-app flex items-center justify-between p-[12px] border border-fifth rounded-[4px]"
              >
                <div className="flex items-center gap-[12px]">
                  {app.oauthApp?.picture?.path ? (
                    <OauthClientTile>
                      <img
                        src={app.oauthApp.picture.path}
                        alt={app.oauthApp.name}
                        className="h-full w-full object-cover"
                      />
                    </OauthClientTile>
                  ) : brand ? (
                    <OauthClientLogo client={brand} tile />
                  ) : (
                    <OauthClientTile>
                      {app.oauthApp?.name?.[0]?.toUpperCase() || '?'}
                    </OauthClientTile>
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
