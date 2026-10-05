import { FC, useCallback, useMemo } from 'react';
import { Integration } from '@prisma/client';
import useSWR from 'swr';
import dayjs from 'dayjs';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { ChartSocial } from '@gitroom/frontend/components/analytics/chart-social';
import { ChartLine } from '@gitroom/frontend/components/analytics/chart-line';
import { ScheduleLoading } from '@gitroom/frontend/components/layout/loading';
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
      className={`flex items-center gap-[4px] text-[13px] font-medium ${
        isPositive ? 'text-[#32d583]' : 'text-[#f97066]'
      }`}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        className={isPositive ? '' : 'rotate-180'}
      >
        <path d="M6 2.5L10 7.5H2L6 2.5Z" fill="currentColor" />
      </svg>
      <span>
        {displayValue}
        {average ? 'pp' : '%'}
      </span>
    </div>
  );
};

const AnalyticsCard: FC<{
  item: AnalyticsDataItem;
  total: string | number;
  index: number;
}> = ({ item, total, index }) => {
  const colorVariants = ['purple', 'green', 'blue'] as const;
  const color = colorVariants[index % colorVariants.length];

  const hasDataPoints = item.data.length >= 1;

  return (
    <div className="group relative">
      <div
        className={`
          flex flex-col h-full
          bg-newTableHeader
          border border-newTableBorder
          rounded-[12px]
          overflow-hidden
          transition-all duration-200
          hover:border-[#00D9FF]/50
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-[16px] pt-[14px] pb-[8px]">
          <div className="flex items-center gap-[10px]">
            <div
              className="w-[8px] h-[8px] rounded-full"
              style={{
                backgroundColor: 'rgba(0, 217, 255, 0.22)',
                boxShadow: '0 0 0 1.5px #00D9FF',
              }}
            />
            <span className="text-[15px] font-medium text-newTableText">
              {item.label}
            </span>
          </div>
          {item.percentageChange !== undefined && (
            <TrendIndicator
              value={item.percentageChange}
              average={item.average}
            />
          )}
        </div>

        {/* Content */}
        {hasDataPoints ? (
          <>
            {/* Chart */}
            <div className="flex-1 px-[12px] py-[8px]">
              <div className="h-[120px] relative">
                <ChartSocial
                  data={item.data}
                  color={color}
                  label={item.label}
                  key={`chart-${index}`}
                />
              </div>
            </div>

            {/* Value */}
            <div className="px-[16px] pb-[14px]">
              <div className="text-[36px] leading-[42px] font-semibold tracking-tight">
                {total}
              </div>
            </div>
          </>
        ) : (
          /* Single value display */
          <div className="flex-1 flex flex-col items-center justify-center py-[32px] px-[16px]">
            <div className="text-[48px] leading-[56px] font-semibold tracking-tight">
              {total}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const PanelMessage: FC<{
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, actionLabel, onAction }) => {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-[48px] px-[24px] bg-newTableHeader border border-newTableBorder rounded-[12px]">
      <div className="w-[48px] h-[48px] mb-[16px] rounded-full bg-[#00D9FF]/10 flex items-center justify-center">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-[#00D9FF]"
        >
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          <path d="M12 8v4l2 2" />
        </svg>
      </div>
      <p className="text-[15px] text-newTableText text-center mb-[12px] max-w-[420px]">
        {title}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-[6px] px-[16px] py-[8px] text-[14px] font-medium text-[#0a0a0a] bg-[#00D9FF] hover:bg-[#00B8D9] rounded-[8px] transition-colors"
        >
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

  const totals = useMemo(() => {
    return data?.map((p: AnalyticsDataItem) => {
      const value =
        (p?.data.reduce(
          (acc: number, curr: { total: number }) => acc + curr.total,
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
    return (
      <div className="flex items-center justify-center py-[48px]">
        <ScheduleLoading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid grid-cols-1 gap-[16px]">
        <PanelMessage
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
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[16px]">
      {overview && (
        <ChartLine
          surface="dark"
          accent="#00D9FF"
          radius={12}
          icon={null}
          title={overview.title}
          description={t('last_n_days', `Last ${date} days`)}
          data={overview.rows}
          index="date"
          series={overview.series}
          fill="gradient"
          height={220}
          strokeWidth={2.5}
          showLegend={overview.series.length > 1}
          showPoints="last"
          animate
          valueFormat="compact"
        />
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[16px]">
        {data?.length === 0 && (
          <PanelMessage
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
            index={index}
          />
        ))}
      </div>
    </div>
  );
};
