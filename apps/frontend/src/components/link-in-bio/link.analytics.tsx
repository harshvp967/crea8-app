'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import useCookie from 'react-use-cookie';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { formatRate } from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.rules';
import { LinkRequestError, linkLocked, useLinkAnalytics, useLinkPage } from '@gitroom/frontend/components/link-in-bio/link.api';
import { ChartLine } from '@gitroom/frontend/components/analytics/chart-line';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { linkPrimary, linkSecondary } from '@gitroom/frontend/components/link-in-bio/link.chrome';
import { SegmentedControl } from '@gitroom/frontend/components/ui/segmented-control';
import { ChartCardSkeleton, MetricCardsSkeleton } from '@gitroom/frontend/components/ui/skeleton';
import { stkCard, stkIconTile, stkSub, stkTitle } from '@gitroom/frontend/components/stalker/stalker.chrome';

const ranges: Array<{ id: string; label: string }> = [
  { id: '7d', label: '7 days' },
  { id: '28d', label: '28 days' },
  { id: '90d', label: '90 days' },
  { id: '365d', label: '365 days' },
];

const SOURCE_LOGO: Record<string, string> = {
  instagram: '/icons/platforms/instagram.png',
  x: '/icons/platforms/x.png',
  youtube: '/icons/platforms/youtube.png',
  linkedin: '/icons/platforms/linkedin.png',
  tiktok: '/icons/platforms/tiktok.png',
  facebook: '/icons/platforms/facebook.png',
  reddit: '/icons/platforms/reddit.png',
  pinterest: '/icons/platforms/pinterest.png',
  threads: '/icons/platforms/threads.png',
  bluesky: '/icons/platforms/bluesky.png',
  twitch: '/icons/platforms/twitch.png',
};

const deltaText = (kind: 'pct' | 'pt', value: number | null) => {
  if (value === null) {
    return '';
  }
  const sign = value > 0 ? '+' : '';
  return kind === 'pt' ? `${sign}${value} pt` : `${sign}${value}%`;
};

const deltaTone = (value: number | null) => {
  if (value === null || value === 0) {
    return 'is-flat';
  }
  return value > 0 ? 'is-up' : 'is-down';
};

const dayLabel = (iso: string) => {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
};

const pickedLabel = (iso: string, empty: string) => {
  if (!iso) {
    return empty;
  }
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return empty;
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const RangeField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <label className={value ? 'lib-range-field' : 'lib-range-field is-empty'}>
    <HugeIcon name="calendar" size={16} />
    <span>{pickedLabel(value, label)}</span>
    <input type="date" aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />
  </label>
);

const ViewsChart = ({ series }: { series: Array<{ day: string; views: number; clicks: number }> }) => {
  const [mode] = useCookie('mode', 'dark');
  const light = mode === 'light';
  const rows = useMemo(() => {
    const points = series.map((point) => ({
      date: dayLabel(point.day),
      views: Number(point.views) || 0,
      clicks: Number(point.clicks) || 0,
    }));
    if (points.length === 1) {
      return [points[0], { ...points[0] }];
    }
    return points;
  }, [series]);
  if (!rows.length) {
    return null;
  }
  return (
    <ChartLine
      bare
      className="lib-chart"
      surface={light ? 'light' : 'dark'}
      accent="#00D9FF"
      title="Views and clicks"
      data={rows}
      index="date"
      series={[
        { key: 'views', label: 'Views', color: '#00D9FF', texture: 'solid' },
        { key: 'clicks', label: 'Clicks', color: light ? '#B4B4BC' : '#8B8B93', texture: 'solid' },
      ]}
      curve="smooth"
      fill="gradient"
      height={220}
      strokeWidth={2}
      showLegend
      showPoints="none"
      showTooltip
      showGrid
      showXAxis
      showYAxis
      total="none"
      animate
      valueFormat="compact"
    />
  );
};

const SourceMark = ({ label }: { label: string }) => {
  const logo = SOURCE_LOGO[label.trim().toLowerCase()];
  if (logo) {
    return <img src={logo} alt="" className="h-[16px] w-[16px] shrink-0 rounded-[4px] object-cover" />;
  }
  return <HugeIcon name="globe" size={16} className="shrink-0 text-textItemBlur" />;
};

export const LinkAnalyticsScreen = () => {
  const fetch = useFetch();
  const toast = useToaster();
  const page = useLinkPage();
  const [range, setRange] = useState('28d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState({ from: '', to: '' });
  const [busy, setBusy] = useState(false);
  const { data, error, isLoading } = useLinkAnalytics(applied.from ? 'custom' : range, applied.from, applied.to);
  const host = page.data ? `${page.data.publicOrigin.replace(/^https?:\/\//, '')}/${page.data.slug}` : '';
  const period = applied.from ? 'Custom range' : `Last ${ranges.find((item) => item.id === range)?.label || '28 days'}`;

  const copyLink = () => {
    if (!page.data?.publicUrl) {
      return;
    }
    navigator.clipboard?.writeText(page.data.publicUrl);
    toast.show('Link copied', 'success');
  };

  return (
    <div className="lib-analytics flex min-w-0 flex-col gap-[16px] pb-[24px]">
      <div className="lib-head flex flex-col gap-[12px] sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="lib-kicker">
            <span className="lib-sticker">Link-in-Bio</span>
            <span className={`${stkSub} lib-period`}>
              {host}
              {page.data && !page.data.paid ? ' — Custom ranges, CSV and device breakdowns are Pro.' : ''}
            </span>
          </div>
          <h1 className={stkTitle}>Analytics</h1>
        </div>
        <div className="lib-head-actions flex flex-wrap items-center justify-start gap-[8px] sm:justify-end">
        <button
          type="button"
          className={linkSecondary}
          disabled={busy}
          onClick={async () => {
            if (linkLocked(page.data)) {
              toast.show('Analytics export is on a paid plan', 'warning');
              return;
            }
            setBusy(true);
            try {
              const response = await fetch(
                `/link-in-bio/analytics.csv?range=${encodeURIComponent(range)}&from=${encodeURIComponent(applied.from)}&to=${encodeURIComponent(applied.to)}`,
                { headers: { Accept: 'text/csv' } }
              );
              if (!response.ok) {
                throw new LinkRequestError('Could not export analytics', response.status);
              }
              const blob = await response.blob();
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = 'crea8-analytics.csv';
              link.click();
              URL.revokeObjectURL(url);
            } catch (err) {
              toast.show(err instanceof Error ? err.message : 'Could not export analytics', 'warning');
            } finally {
              setBusy(false);
            }
          }}
        >
          <HugeIcon name="download" size={16} />
          Export CSV
        </button>
        </div>
      </div>

      <div className="lib-range">
        <div className="lib-range-presets">
          <SegmentedControl
            aria-label="Range"
            variant="pill"
            size="sm"
            className="lib-quiet-seg"
            value={applied.from ? '' : range}
            onValueChange={(id) => {
              setRange(id);
              setFrom('');
              setTo('');
              setApplied({ from: '', to: '' });
            }}
            options={ranges.map((item) => ({ value: item.id, label: item.label }))}
          />
        </div>
        <div className="lib-range-custom">
          <RangeField label="From" value={from} onChange={setFrom} />
          <RangeField label="To" value={to} onChange={setTo} />
          <button
            type="button"
            className={linkSecondary}
            disabled={!from || !to}
            onClick={() => {
              if (linkLocked(page.data)) {
                toast.show('A custom date range is on a paid plan', 'warning');
                return;
              }
              if (!from || !to) {
                return;
              }
              setApplied({ from, to });
            }}
          >
            Apply
          </button>
        </div>
      </div>

      {error ? (
        <section className={`${stkCard} stk-state`}>
          <span className={`${stkIconTile} stk-state-mark`} aria-hidden>
            <HugeIcon name="alert" size={20} />
          </span>
          <p className="text-[14px] font-[500]">Could not load analytics.</p>
        </section>
      ) : isLoading || !data ? (
        <>
          <MetricCardsSkeleton />
          <ChartCardSkeleton />
        </>
      ) : (
        <>
          <div className="lib-metrics grid grid-cols-2 gap-[12px] min-[1200px]:grid-cols-4">
            <Metric label="Views" value={data.views.toLocaleString('en-US')} delta={deltaText('pct', data.deltas.views)} deltaValue={data.deltas.views} period={period} />
            <Metric label="Link clicks" value={data.clicks.toLocaleString('en-US')} delta={deltaText('pct', data.deltas.clicks)} deltaValue={data.deltas.clicks} period={period} />
            <Metric label="Click-through rate" value={formatRate(data.ctr)} delta={deltaText('pt', data.deltas.ctr)} deltaValue={data.deltas.ctr} period={period} />
            <Metric
              label="New subscribers"
              value={data.subscribers.toLocaleString('en-US')}
              delta={deltaText('pct', data.deltas.subscribers)}
              deltaValue={data.deltas.subscribers}
              period={period}
            />
          </div>

          <section className={`${stkCard} lib-chart-card`}>
            <div className="mb-[8px] flex items-center justify-between gap-[12px]">
              <h2 className="text-[16px] font-[600] tracking-[-0.02em]">Views and clicks</h2>
              <span className="text-[13px] font-[500] text-textItemBlur">Daily</span>
            </div>
            {data.views === 0 && data.clicks === 0 ? (
              <div className="lib-analytics-empty stk-state flex flex-col items-center gap-[8px] py-[36px] text-center">
                <span className={`${stkIconTile} stk-state-mark`} aria-hidden>
                  <HugeIcon name="chart-line" size={18} />
                </span>
                <strong className="text-[16px] font-[600] tracking-[-0.02em]">No views yet</strong>
                <p className="text-[14px] font-[500] text-textItemBlur">Share {host} to start collecting views.</p>
                <button type="button" className={`${linkPrimary} mt-[8px]`} onClick={copyLink}>
                  <HugeIcon name="copy" size={16} />
                  Copy link
                </button>
              </div>
            ) : (
              <ViewsChart series={data.series} />
            )}
          </section>

          {data.views === 0 && data.clicks === 0 ? null : (
          <>
          <div className="grid min-w-0 grid-cols-1 gap-[12px] min-[1024px]:grid-cols-3">
            <section className={stkCard}>
              <h2 className="mb-[8px] text-[16px] font-[600] tracking-[-0.02em]">Top links</h2>
              {data.topLinks.length ? (
                <div className="lib-table-wrap">
                  <table className="lib-table">
                    <thead>
                      <tr>
                        <th>Link</th>
                        <th>Clicks</th>
                        <th>CTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topLinks.map((link) => (
                        <tr key={link.id}>
                          <td data-label="Link">{link.title}</td>
                          <td data-label="Clicks">{link.clicks.toLocaleString('en-US')}</td>
                          <td data-label="CTR">{formatRate(link.ctr)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-[14px] font-[500] text-textItemBlur">No clicks yet</p>
              )}
            </section>
            <ShareList title="Traffic sources" empty="No data yet" logos rows={data.sources.map((row) => ({ label: row.source, share: row.share }))} />
            <ShareList title="Countries" empty="No data yet" rows={data.countries.map((row) => ({ label: row.name || row.code, share: row.share }))} />
          </div>

          {data.deep ? (
            <div className="grid grid-cols-1 gap-[12px] md:grid-cols-2">
              <section className={stkCard}>
                <h2 className="mb-[8px] text-[16px] font-[600] tracking-[-0.02em]">Click-through by link</h2>
                {data.deep.links.length ? (
                  <table className="lib-table">
                    <thead>
                      <tr>
                        <th>Link</th>
                        <th>Clicks</th>
                        <th>CTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.deep.links.map((link) => (
                        <tr key={link.id}>
                          <td data-label="Link">{link.title}</td>
                          <td data-label="Clicks">{link.clicks.toLocaleString('en-US')}</td>
                          <td data-label="CTR">{formatRate(link.ctr)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-[14px] font-[500] text-textItemBlur">No links yet</p>
                )}
              </section>
              <div className="grid grid-cols-1 gap-[12px]">
                <ShareList title="Devices" empty="No data yet" rows={data.deep.devices} />
                <ShareList title="Browsers" empty="No data yet" rows={data.deep.browsers} />
                <ShareList title="UTM" empty="No UTM visits yet" rows={data.deep.utm} />
              </div>
            </div>
          ) : (
            <section className={stkCard}>
              <h2 className="text-[16px] font-[600] tracking-[-0.02em]">Device, browser and UTM</h2>
              <p className="mt-[6px] text-[14px] font-[500] text-textItemBlur">
                Per-link CTR, device, browser, UTM and CSV export are on a paid plan.{' '}
                <Link href="/account?section=billing">
                  Upgrade
                </Link>
              </p>
            </section>
          )}
          </>
          )}
        </>
      )}
    </div>
  );
};

const Metric = ({
  label,
  value,
  delta,
  deltaValue,
  period,
}: {
  label: string;
  value: string;
  delta: string;
  deltaValue: number | null;
  period: string;
}) => (
  <section className={`${stkCard} lib-metric`}>
    <p className="lib-metric-label text-[13px] font-[500]">{label}</p>
    <p className="lib-metric-value mt-[6px] text-[28px] font-[600] tracking-[-0.03em]">{value}</p>
    {delta ? (
      <p className={`lib-delta ${deltaTone(deltaValue)}`}>{delta}</p>
    ) : (
      <p className="lib-metric-period text-[13px] font-[500]">{period}</p>
    )}
  </section>
);

const ShareList = ({
  title,
  empty,
  rows,
  logos,
}: {
  title: string;
  empty: string;
  rows: Array<{ label: string; share: number }>;
  logos?: boolean;
}) => (
  <section className={stkCard}>
    <h2 className="mb-[10px] text-[16px] font-[600] tracking-[-0.02em]">{title}</h2>
    {rows.length ? (
      <div className="flex flex-col gap-[10px]">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-[4px] flex items-center justify-between gap-[8px] text-[13px] font-[500]">
              <span className="flex min-w-0 items-center gap-[8px]">
                {logos ? <SourceMark label={row.label} /> : null}
                <span className="truncate">{row.label}</span>
              </span>
              <span className="text-textItemBlur">{row.share}%</span>
            </div>
            <div className="lib-bar">
              <i style={{ width: `${Math.max(0, Math.min(100, row.share))}%` }} />
            </div>
          </div>
        ))}
      </div>
    ) : (
      <p className="text-[14px] font-[500] text-textItemBlur">{empty}</p>
    )}
  </section>
);
