'use client';

import React from 'react';
import Link from 'next/link';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import dynamic from 'next/dynamic';
import ShortlinkPreferenceComponent from '@gitroom/frontend/components/settings/shortlink-preference.component';

const MetricComponent = dynamic(
  () => import('@gitroom/frontend/components/settings/metric.component'),
  {
    ssr: false,
    loading: () => (
      <div className="my-[16px] h-[140px] animate-pulse rounded-[16px] border border-fifth bg-sixth" />
    ),
  }
);

export const GlobalSettings = () => {
  const t = useT();
  return (
    <>
      <div className="settings-section">
        <div className="settings-head">
          <h1>{t('global_settings', 'Global Settings')}</h1>
        </div>
        <div className="settings-group">
          <div className="settings-row">
            <div className="settings-row-copy">
              <div className="settings-row-title">
                {t('account_settings', 'Account settings')}
              </div>
              <div className="settings-row-sub">
                {t(
                  'account_settings_holds',
                  'Profile, workspace and security'
                )}
              </div>
            </div>
            <Link href="/account" className="account-open">
              {t('open_account_settings', 'Open account settings')}
            </Link>
          </div>
          <MetricComponent />
          <ShortlinkPreferenceComponent />
        </div>
      </div>
    </>
  );
};
