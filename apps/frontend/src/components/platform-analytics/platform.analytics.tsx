'use client';

import useSWR from 'swr';
import { useCallback, useMemo, useState } from 'react';
import { capitalize, orderBy } from 'lodash';
import clsx from 'clsx';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import SafeImage from '@gitroom/react/helpers/safe.image';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { RenderAnalytics } from '@gitroom/frontend/components/platform-analytics/render.analytics';
import { Button } from '@gitroom/react/form/button';
import { useRouter } from 'next/navigation';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { ScheduleLoading } from '@gitroom/frontend/components/layout/loading';
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
        <div className="analytics-main analytics-state">
          <p>
            {error instanceof Error
              ? error.message
              : t(
                  'analytics_load_error',
                  'Could not load analytics. Refresh the page and try again.'
                )}
          </p>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="analytics-screen">
        <div className="analytics-main analytics-state">
          <ScheduleLoading />
        </div>
      </div>
    );
  }

  if (!sortedIntegrations.length) {
    return (
      <div className="analytics-screen">
        <div className="analytics-main analytics-state">
          <img src="/peoplemarketplace.svg" alt="" />
          <h1>
            {t('can_t_show_analytics_yet', "Can't show analytics yet")}
          </h1>
          <p>
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
          <Button onClick={() => router.push('/launches')}>
            {t(
              'go_to_the_calendar_to_add_channels',
              'Go to the calendar to add channels'
            )}
          </Button>
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
        <div className="analytics-head">
          <h1>{t('analytics', 'Analytics')}</h1>
          <div className="analytics-head-row">
            <p className="analytics-sub">
              {currentIntegration.name} · {platformLabel}
            </p>
            {!!options.length && (
              <div className="analytics-range" role="group">
                {options.map((option) => (
                  <button
                    type="button"
                    key={option.key}
                    className={keys === option.key ? 'is-selected' : ''}
                    onClick={() => setKey(option.key)}
                  >
                    {option.value}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="analytics-strip">
          {sortedIntegrations.map((integration, index) => (
            <button
              type="button"
              key={integration.id}
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
        {!!keys && !!currentIntegration && !refresh && (
          <RenderAnalytics integration={currentIntegration} date={keys} />
        )}
      </div>
    </div>
  );
};
