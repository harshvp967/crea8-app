'use client';

import useSWR from 'swr';
import { FC, useCallback, useMemo, useState } from 'react';
import { capitalize, orderBy } from 'lodash';
import clsx from 'clsx';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import SafeImage from '@gitroom/react/helpers/safe.image';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import {
  AnalyticsSkeleton,
  RenderAnalytics,
} from '@gitroom/frontend/components/platform-analytics/render.analytics';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { Button } from '@gitroom/react/form/button';
import { useRouter } from 'next/navigation';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { SegmentedControl } from '@gitroom/frontend/components/ui/segmented-control';

const AnalyticsPageHead: FC<{ period?: number; sub?: string }> = ({
  period,
  sub,
}) => {
  const t = useT();
  return (
    <header className="analytics-head">
      <div className="analytics-head-text">
        <div className="analytics-kicker">
          <span className="analytics-sticker">{t('schedule', 'Schedule')}</span>
          {period ? (
            <span className="analytics-period">
              {t('last_n_days', `Last ${period} days`)}
            </span>
          ) : null}
        </div>
        <h1>{t('analytics', 'Analytics')}</h1>
        {sub ? <p className="analytics-sub">{sub}</p> : null}
      </div>
    </header>
  );
};

const allowedIntegrations = [
  'facebook',
  'instagram',
  'instagram-standalone',
  'linkedin-page',
  'tiktok',
  'tiktok-business',
  'youtube',
  'gmb',
  'pinterest',
  'threads',
  'x',
];
export const PlatformAnalytics = () => {
  const fetch = useFetch();
  const t = useT();
  const router = useRouter();
  const { disableXAnalytics } = useVariables();

  const [current, setCurrent] = useState(0);
  const [key, setKey] = useState(7);
  const [refresh, setRefresh] = useState(false);
  const toaster = useToaster();
  const load = useCallback(async () => {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch('/integrations/list', {
        signal: controller.signal,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(body?.integrations)) {
        throw new Error(
          'Could not load channels for analytics. Refresh the page and try again.'
        );
      }
      return body.integrations.filter((f: any) => {
        if (f.identifier === 'x' && disableXAnalytics) {
          return false;
        }
        return allowedIntegrations.includes(f.identifier);
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(
          'Loading channels took too long. Refresh the page and try again.'
        );
      }
      throw error;
    } finally {
      clearTimeout(timerId);
    }
  }, [disableXAnalytics]);
  const { data, error, isLoading } = useSWR('analytics-list', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    shouldRetryOnError: false,
    errorRetryCount: 0,
  });
  const sortedIntegrations = useMemo(() => {
    return orderBy(
      data || [],
      ['type', 'disabled', 'identifier'],
      ['desc', 'asc', 'asc']
    );
  }, [data]);
  const currentIntegration = useMemo(() => {
    return sortedIntegrations[current];
  }, [current, sortedIntegrations]);
  const options = useMemo(() => {
    if (!currentIntegration) {
      return [];
    }
    const arr = [];
    if (
      [
        'facebook',
        'instagram',
        'instagram-standalone',
        'linkedin-page',
        'pinterest',
        'youtube',
        'threads',
        'gmb',
        'x',
        'tiktok',
        'tiktok-business',
      ].indexOf(currentIntegration.identifier) !== -1
    ) {
      arr.push({
        key: 7,
        value: t('7_days', '7 Days'),
      });
    }
    if (
      [
        'facebook',
        'instagram',
        'instagram-standalone',
        'linkedin-page',
        'pinterest',
        'youtube',
        'threads',
        'gmb',
        'x',
        'tiktok',
        'tiktok-business',
      ].indexOf(currentIntegration.identifier) !== -1
    ) {
      arr.push({
        key: 30,
        value: t('30_days', '30 Days'),
      });
    }
    if (
      ['facebook', 'linkedin-page', 'pinterest', 'youtube', 'x', 'gmb'].indexOf(
        currentIntegration.identifier
      ) !== -1
    ) {
      arr.push({
        key: 90,
        value: t('90_days', '90 Days'),
      });
    }
    return arr;
  }, [currentIntegration]);
  const keys = useMemo(() => {
    if (!currentIntegration) {
      return 7;
    }
    if (options.find((p) => p.key === key)) {
      return key;
    }
    return options[0]?.key;
  }, [key, currentIntegration]);

  const pickChannel = (integration: (typeof sortedIntegrations)[number], index: number) => {
    if (integration.refreshNeeded) {
      toaster.show(
        'Please refresh the integration from the calendar',
        'warning'
      );
      return;
    }
    setRefresh(true);
    setTimeout(() => {
      setRefresh(false);
    }, 10);
    setCurrent(index);
  };

  const channelMark = (integration: (typeof sortedIntegrations)[number]) => (
    <span
      className={clsx(
        'analytics-channel-mark',
        integration.disabled && 'is-disabled'
      )}
    >
      {(integration.inBetweenSteps || integration.refreshNeeded) && (
        <span className="analytics-channel-warn">!</span>
      )}
      <ImageWithFallback
        fallbackSrc={`/icons/platforms/${integration.identifier}.png`}
        src={integration.picture}
        className="avatar"
        alt={integration.identifier}
        width={36}
        height={36}
      />
      <SafeImage
        src={`/icons/platforms/${integration.identifier}.png`}
        className="badge"
        alt=""
        width={14}
        height={14}
      />
    </span>
  );

  if (error) {
    return (
      <div className="analytics-screen">
        <div className="analytics-main">
          <AnalyticsPageHead period={keys} />
          <div className="analytics-state-card is-error" role="alert">
            <span className="analytics-state-tile is-error" aria-hidden="true">
              <HugeIcon name="alert" size={25} />
            </span>
            <div className="analytics-state-text">
              <h2 className="analytics-state-title">
                {t('analytics_load_error_title', "Couldn't load analytics")}
              </h2>
              <p className="analytics-state-body">
                {error instanceof Error
                  ? error.message
                  : t(
                      'analytics_load_error',
                      'Could not load analytics. Refresh the page and try again.'
                    )}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="analytics-screen">
        <div className="analytics-main">
          <AnalyticsPageHead period={keys} />
          <AnalyticsSkeleton toolbar />
        </div>
      </div>
    );
  }

  if (!sortedIntegrations.length) {
    return (
      <div className="analytics-screen">
        <div className="analytics-main">
          <AnalyticsPageHead period={keys} />
          <div className="analytics-state-card is-empty">
            <span className="analytics-state-tile is-empty" aria-hidden="true">
              <HugeIcon name="analytics-bars" size={25} />
            </span>
            <div className="analytics-state-text">
              <h2 className="analytics-state-title">
                {t('can_t_show_analytics_yet', "Can't show analytics yet")}
              </h2>
              <p className="analytics-state-body">
                {t(
                  'you_have_to_add_social_media_channels',
                  'You have to add Social Media channels'
                )}
              </p>
              <p className="analytics-support">
                {t('supported', 'Supported:')}{' '}
                {allowedIntegrations.map((p) => capitalize(p)).join(', ')}. Bluesky
                and Mastodon do not provide account analytics here.
              </p>
            </div>
            <Button onClick={() => router.push('/launches')}>
              {t(
                'go_to_the_calendar_to_add_channels',
                'Go to the calendar to add channels'
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentIntegration) {
    return null;
  }

  const platformLabel = currentIntegration.identifier
    .split('-')
    .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return (
    <div className="analytics-screen">
      <div className="analytics-channels">
        <h2>{t('channels')}</h2>
        <div className="analytics-channel-list">
          {sortedIntegrations.map((integration, index) => (
            <button
              type="button"
              key={integration.id}
              onClick={() => pickChannel(integration, index)}
              className={clsx(
                'analytics-channel',
                currentIntegration.id === integration.id && 'is-selected',
                integration.disabled && 'is-disabled'
              )}
            >
              {channelMark(integration)}
              <span className="analytics-channel-name">{integration.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="analytics-main">
        <AnalyticsPageHead
          period={keys}
          sub={`${currentIntegration.name} · ${platformLabel}`}
        />
        <div className="analytics-toolbar">
          <div className="analytics-strip">
            {sortedIntegrations.map((integration, index) => (
              <button
                type="button"
                key={integration.id}
                title={integration.name}
                aria-label={integration.name}
                onClick={() => pickChannel(integration, index)}
                className={clsx(
                  currentIntegration.id === integration.id && 'is-selected',
                  integration.disabled && 'is-disabled'
                )}
              >
                {channelMark(integration)}
              </button>
            ))}
          </div>
          {!!options.length && (
            <SegmentedControl
              variant="pill"
              className="analytics-range"
              aria-label={t('analytics_range', 'Date range')}
              value={String(keys)}
              onValueChange={(value) => setKey(Number(value))}
              options={options.map((option) => ({
                value: String(option.key),
                label: option.value,
              }))}
            />
          )}
        </div>
        {!!keys && !!currentIntegration && !refresh && (
          <RenderAnalytics integration={currentIntegration} date={keys} />
        )}
      </div>
    </div>
  );
};
