import { FC, useCallback, useMemo } from 'react';
import { Integration } from '@prisma/client';
import useSWR from 'swr';
import dayjs from 'dayjs';
import useCookie from 'react-use-cookie';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { ChartLine } from '@gitroom/frontend/components/analytics/chart-line';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

interface AnalyticsDataItem {
  label: string;
  data: Array<{ total: number; date: string }>;
  average?: boolean;
  percentageChange?: number;
}

function formatOverviewDate(date: string) {
  if (date.includes(' - ')) {
    return date;
  }
  const parsed = dayjs(date);
  return parsed.isValid() ? parsed.format('MMM D') : date;
}

function buildOverview(items: AnalyticsDataItem[]) {
  const withPoints = items.filter((item) => item.data?.length);
  const lined = withPoints.filter(
    (item) => item.data.length >= 2 && !item.average
  );
  const picked = (lined.length ? lined : withPoints).slice(0, 2);
  if (!picked.length) {
    return null;
  }

  const dateSets = picked.map(
    (item) => new Set(item.data.map((point) => point.date))
  );
  let dates = [...dateSets[0]];
  if (dateSets[1]) {
    const shared = dates.filter((date) => dateSets[1].has(date));
    dates = (
      shared.length >= 2 ? shared : [...new Set([...dates, ...dateSets[1]])]
    ).sort();
  } else {
    dates.sort();
  }

  const rows = dates.map((date) => {
    const row: Record<string, string | number> = {
      date: formatOverviewDate(date),
    };
    picked.forEach((item, index) => {
      const match = item.data.find((point) => point.date === date);
      row[`s${index}`] = match ? Number(match.total) || 0 : 0;
    });
    return row;
  });

  return {
    rows: rows.length === 1 ? [rows[0], { ...rows[0] }] : rows,
    series: picked.map((item, index) => ({
      key: `s${index}`,
      label: item.label,
    })),
    title:
      picked.length > 1
        ? `${picked[0].label} and ${picked[1].label}`
        : picked[0].label,
  };
}

const TrendIndicator: FC<{ value: number; average?: boolean }> = ({
  value,
  average,
}) => {
  if (value === 0) return null;

  const isPositive = value > 0;
  const displayValue = Math.abs(value).toFixed(1);

  return (
    <div
      className={`analytics-stat-delta ${
        isPositive ? 'is-up' : 'is-down'
      }`}
    >
      {isPositive ? '+' : '−'}
      {displayValue}
      {average ? 'pp' : '%'}
    </div>
  );
};

const AnalyticsCard: FC<{
  item: AnalyticsDataItem;
  total: string | number;
}> = ({ item, total }) => {

  return (
    <div className="analytics-stat">
      <span className="analytics-stat-label">{item.label}</span>
      <div className="analytics-stat-value">{total}</div>
      {item.percentageChange !== undefined && (
        <TrendIndicator value={item.percentageChange} average={item.average} />
      )}
    </div>
  );
};

export const AnalyticsSkeleton: FC<{ toolbar?: boolean }> = ({ toolbar }) => (
  <div className="analytics-skeleton" role="status">
    <span className="sr-only">Loading</span>
    {toolbar && (
      <div className="analytics-skel-toolbar">
        <span className="analytics-skel-bar is-tool-a" />
        <span className="analytics-skel-bar is-tool-b" />
      </div>
    )}
    {[0, 1, 2].map((i) => (
      <div key={i} className="analytics-skel-card">
        <div className="analytics-skel-row">
          <span className="analytics-skel-dot" />
          <div className="analytics-skel-lines">
            <span className="analytics-skel-bar is-a" />
            <span className="analytics-skel-bar is-b" />
          </div>
        </div>
        <span className={`analytics-skel-bar is-full is-${i}`} />
      </div>
    ))}
  </div>
);

const PanelMessage: FC<{
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'empty' | 'error';
  heading?: string;
}> = ({ title, actionLabel, onAction, tone = 'empty', heading }) => {
  return (
    <div className={`analytics-note analytics-state-card is-${tone}`}>
      <span className={`analytics-state-tile is-${tone}`} aria-hidden="true">
        <HugeIcon name={tone === 'error' ? 'alert' : 'analytics-bars'} size={25} />
      </span>
      <div className="analytics-state-text">
        {heading ? <h2 className="analytics-state-title">{heading}</h2> : null}
        <p className="analytics-state-body">{title}</p>
      </div>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export const RenderAnalytics: FC<{
  integration: Integration;
  date: number;
}> = (props) => {
  const { integration, date } = props;
  const fetch = useFetch();

  const load = useCallback(async () => {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(
        `/analytics/${integration.id}?date=${date}`,
        { signal: controller.signal }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(body)) {
        const rawMessage = body?.message || body?.error;
        const message = Array.isArray(rawMessage)
          ? rawMessage.join(', ')
          : rawMessage;
        throw new Error(
          message || 'Could not load analytics for this channel.'
        );
      }
      return body as AnalyticsDataItem[];
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(
          'Analytics took too long to load for this channel. Try again, or pick another channel.'
        );
      }
      throw error;
    } finally {
      clearTimeout(timerId);
    }
  }, [integration, date]);

  const { data, error, isLoading, mutate } = useSWR(
    `/analytics-${integration?.id}-${date}`,
    load,
    {
      refreshInterval: 0,
      refreshWhenHidden: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      refreshWhenOffline: false,
      revalidateOnMount: true,
      shouldRetryOnError: false,
      errorRetryCount: 0,
    }
  );

  const refreshChannel = useCallback(
    (
        integrationData: Integration & {
          identifier: string;
        }
      ) =>
      async () => {
        const { url } = await (
          await fetch(
            `/integrations/social/${integrationData.identifier}?refresh=${integrationData.internalId}`,
            {
              method: 'GET',
            }
          )
        ).json();
        window.location.href = url;
      },
    []
  );

  const t = useT();
  const [mode] = useCookie('mode', 'dark');

  const totals = useMemo(() => {
    return data?.map((p: AnalyticsDataItem) => {
      const value =
        (p?.data.reduce(
          (acc: number, curr: { total: number }) =>
            acc + (Number(curr.total) || 0),
          0
        ) || 0) / (p.average ? p.data.length : 1);
      if (p.average) {
        return value.toFixed(2) + '%';
      }
      return new Intl.NumberFormat().format(Math.round(value));
    });
  }, [data]);

  const overview = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }
    return buildOverview(data);
  }, [data]);

  if (isLoading) {
    return <AnalyticsSkeleton />;
  }

  if (error) {
    return (
      <PanelMessage
        tone="error"
        heading={t('analytics_load_error_title', "Couldn't load analytics")}
        title={
          error instanceof Error
            ? error.message
            : t(
                'analytics_channel_error',
                'Could not load analytics for this channel.'
              )
        }
        actionLabel={t('try_again', 'Try again')}
        onAction={() => mutate()}
      />
    );
  }

  return (
    <div className="analytics-body">
      <div className="analytics-stats">
        {data?.length === 0 && (
          <PanelMessage
            tone="empty"
            title={t(
              'analytics_empty_period',
              'No analytics for this channel in the selected period.'
            )}
            actionLabel={
              (integration as { refreshNeeded?: boolean }).refreshNeeded
                ? t('refresh_channel', 'Refresh Channel')
                : undefined
            }
            onAction={
              (integration as { refreshNeeded?: boolean }).refreshNeeded
                ? refreshChannel(integration as any)
                : undefined
            }
          />
        )}
        {data?.map((item: AnalyticsDataItem, index: number) => (
          <AnalyticsCard
            key={`analytics-${index}`}
            item={item}
            total={totals[index]}
          />
        ))}
      </div>
      {overview && (
        <ChartLine
          className="analytics-chart"
          surface={mode === 'light' ? 'light' : 'dark'}
          accent="#00D9FF"
          radius={20}
          icon={null}
          title={overview.title}
          description={t('last_n_days', `Last ${date} days`)}
          data={overview.rows}
          index="date"
          series={overview.series.map((item, index) => ({
            ...item,
            texture: 'solid' as const,
            color:
              index === 0
                ? '#00D9FF'
                : mode === 'light'
                ? '#B4B4BC'
                : '#8B8B93',
          }))}
          fill="gradient"
          height={220}
          strokeWidth={2}
          showLegend={overview.series.length > 1}
          showPoints="none"
          total="none"
          animate
          valueFormat="compact"
        />
      )}
    </div>
  );
};
