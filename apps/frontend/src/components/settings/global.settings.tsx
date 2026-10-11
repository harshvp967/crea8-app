'use client';

import React from 'react';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import dynamic from 'next/dynamic';
import EmailNotificationsComponent from '@gitroom/frontend/components/settings/email-notifications.component';
import ShortlinkPreferenceComponent from '@gitroom/frontend/components/settings/shortlink-preference.component';
import DeleteAccountComponent from '@gitroom/frontend/components/settings/delete-account.component';

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
    <div className="settings-section">
      <div className="settings-head">
        <h1>{t('global_settings', 'Global Settings')}</h1>
      </div>
      <div className="settings-group">
        <MetricComponent />
        <EmailNotificationsComponent />
        <ShortlinkPreferenceComponent />
      </div>
      <DeleteAccountComponent />
    </div>
  );
};
