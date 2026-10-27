'use client';

import React from 'react';
import Link from 'next/link';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
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

const ACTION_LABELS: Record<string, string> = {
  ai_post: 'AI post',
  x_post: 'X post',
  x_post_with_link: 'X post with link',
  ai_image: 'AI image',
  stalker_search: 'Stalker search',
};

export const CreditUsage = () => {
  const user = useUser();
  const credits = user?.billingEnabled ? user.credits : null;
  if (!credits) {
    return null;
  }
  const plan = user?.tier?.display_name || 'Plan';
  const meter = `${credits.used}/${credits.allowance}`;
  const stats = [
    ['Allowance', credits.allowance],
    ['Used', credits.used],
    ['Left', credits.left],
    ['Pack credits', credits.packCredits],
  ] as const;
  return (
    <section className="settings-group credit-usage" aria-label="Credits">
      <div className="credit-usage-head">
        <h2 className="credit-usage-title">{plan}</h2>
        <p className="credit-usage-meter">{meter}</p>
      </div>
      <dl className="credit-usage-grid">
        {stats.map(([label, value]) => (
          <div className="credit-usage-stat" key={label}>
            <dt className="credit-usage-label">{label}</dt>
            <dd className="credit-usage-value">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="credit-usage-scroll">
        <table className="credit-usage-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Count</th>
              <th>Credits</th>
            </tr>
          </thead>
          <tbody>
            {credits.actions.map((action) => (
              <tr key={action.key}>
                <td>{ACTION_LABELS[action.key] || action.key}</td>
                <td>{action.count}</td>
                <td>{action.credits}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

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
      <CreditUsage />
    </>
  );
};
