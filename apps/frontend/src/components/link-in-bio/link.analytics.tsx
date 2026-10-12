'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { formatRate } from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.rules';
import { LinkRequestError, useLinkAnalytics, useLinkPage } from '@gitroom/frontend/components/link-in-bio/link.api';
import { linkSecondary } from '@gitroom/frontend/components/link-in-bio/link.chrome';

const ranges = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: '12m', label: '12 months' },
];

const deltaText = (kind: 'pct' | 'pt', value: number | null) => {
  if (value === null) {
    return '';
  }
  const sign = value > 0 ? '+' : '';
  return kind === 'pt' ? `${sign}${value} pt` : `${sign}${value}%`;
};

const Chart = ({ series }: { series: Array<{ views: number }> }) => {
  const width = 640;
  const height = 160;
  const max = Math.max(1, ...series.map((point) => point.views));
  const step = series.length > 1 ? width / (series.length - 1) : width;
  const coords = series.map((point, index) => {
    const x = series.length > 1 ? index * step : width / 2;
    const y = height - (point.views / max) * (height - 12) - 6;
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[180px] w-full" role="img" aria-label="Daily views">
      <polygon points={`0,${height} ${coords.join(' ')} ${width},${height}`} fill="rgba(0,217,255,0.16)" />
      <polyline points={coords.join(' ')} fill="none" stroke="#00D9FF" strokeWidth="2" />
    </svg>
  );
};

export const LinkAnalyticsScreen = () => {
  const fetch = useFetch();
  const toast = useToaster();
  const page = useLinkPage();
  const [range, setRange] = useState('30d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState({ from: '', to: '' });
  const [busy, setBusy] = useState(false);
  const { data, error, isLoading } = useLinkAnalytics(applied.from ? 'custom' : range, applied.from, applied.to);
  const host = page.data ? `${page.data.publicOrigin.replace(/^https?:\/\//, '')}/${page.data.slug}` : '';

  return (
    <div className="flex flex-col gap-[16px] overflow-y-auto pb-[24px]">
      <div className="flex flex-wrap items-start justify-between gap-[12px]">
        <div>
          <h1 className="text-[22px] font-[600]">Analytics</h1>
          <p className="text-[14px] text-textItemBlur">{host}</p>
        </div>
        <div className="flex flex-wrap items-center gap-[6px]">
          {ranges.map((item) => (
            <button
              key={item.id}
              type="button"
              className={
                !applied.from && range === item.id
                  ? 'h-[36px] rounded-[18px] border border-[rgba(0,217,255,.45)] px-[12px] text-[14px] text-[#00D9FF]'
                  : 'h-[36px] rounded-[18px] border border-transparent px-[12px] text-[14px] text-textItemBlur'
              }
              onClick={() => {
                setRange(item.id);
                setApplied({ from: '', to: '' });
              }}
            >
              {item.label}
            </button>
          ))}
          <input className="h-[36px] rounded-[14px] border border-newBorder bg-transparent px-[8px] text-[13px]" type="date" aria-label="From" value={from} onChange={(event) => setFrom(event.target.value)} />
          <input className="h-[36px] rounded-[14px] border border-newBorder bg-transparent px-[8px] text-[13px]" type="date" aria-label="To" value={to} onChange={(event) => setTo(event.target.value)} />
          <button
            type="button"
            className={linkSecondary}
            onClick={() => {
              if (!page.data?.paid) {
                toast.show('A custom date range is on a paid plan', 'warning');
                return;
              }
              if (!from || !to) {
                toast.show('Choose a start and end date', 'warning');
                return;
              }
              setApplied({ from, to });
            }}
          >
            Apply
          </button>
          <button
            type="button"
            className={linkSecondary}
            disabled={busy}
            onClick={async () => {
              if (!page.data?.paid) {
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
            Export CSV
          </button>
        </div>
      </div>

      {error ? <p className="text-[14px] text-textItemBlur">Could not load analytics.</p> : null}
      {isLoading || !data ? (
        <p className="text-[14px] text-textItemBlur">Loading analytics…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Views" value={data.views.toLocaleString('en-US')} delta={deltaText('pct', data.deltas.views)} />
            <Metric label="Link clicks" value={data.clicks.toLocaleString('en-US')} delta={deltaText('pct', data.deltas.clicks)} />
            <Metric label="Click-through rate" value={formatRate(data.ctr)} delta={deltaText('pt', data.deltas.ctr)} />
            <Metric
              label="New subscribers"
              value={data.subscribers.toLocaleString('en-US')}
              delta={deltaText('pct', data.deltas.subscribers)}
            />
          </div>

          <section className="rounded-[20px] border border-newBorder p-[16px]">
            <div className="mb-[8px] flex items-center justify-between">
              <h2 className="text-[16px] font-[600]">Views and clicks</h2>
              <span className="text-[13px] text-textItemBlur">Daily</span>
            </div>
            {data.views === 0 && data.clicks === 0 ? (
              <div className="flex flex-col items-center gap-[6px] py-[48px] text-center">
                <div className="grid h-[36px] w-[36px] place-items-center rounded-[12px] border border-newBorder text-textItemBlur">
                  ▂
                </div>
                <strong>No views yet</strong>
                <p className="text-[14px] text-textItemBlur">Share {host} to start collecting views.</p>
              </div>
            ) : (
              <Chart series={data.series} />
            )}
          </section>

          <div className="grid grid-cols-1 gap-[12px] lg:grid-cols-3">
            <section className="rounded-[20px] border border-newBorder p-[16px]">
              <h2 className="mb-[8px] text-[16px] font-[600]">Top links</h2>
              {data.topLinks.length ? (
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
              ) : (
                <p className="text-[14px] text-textItemBlur">No clicks yet</p>
              )}
            </section>
            <ShareList title="Traffic sources" empty="No data yet" rows={data.sources.map((row) => ({ label: row.source, share: row.share }))} />
            <ShareList title="Countries" empty="No data yet" rows={data.countries.map((row) => ({ label: row.name || row.code, share: row.share }))} />
          </div>

          {data.deep ? (
            <div className="grid grid-cols-1 gap-[12px] lg:grid-cols-2">
              <section className="rounded-[20px] border border-newBorder p-[16px]">
                <h2 className="mb-[8px] text-[16px] font-[600]">Click-through by link</h2>
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
                  <p className="text-[14px] text-textItemBlur">No links yet</p>
                )}
              </section>
              <div className="grid grid-cols-1 gap-[12px]">
                <ShareList title="Devices" empty="No data yet" rows={data.deep.devices} />
                <ShareList title="Browsers" empty="No data yet" rows={data.deep.browsers} />
                <ShareList title="UTM" empty="No UTM visits yet" rows={data.deep.utm} />
              </div>
            </div>
          ) : (
            <section className="rounded-[20px] border border-newBorder p-[16px]">
              <h2 className="text-[16px] font-[600]">Device, browser and UTM</h2>
              <p className="mt-[6px] text-[14px] text-textItemBlur">
                Per-link CTR, device, browser, UTM and CSV export are on a paid plan.{' '}
                <Link href="/billing" className="text-[#00D9FF]">
                  Upgrade
                </Link>
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
};

const Metric = ({ label, value, delta }: { label: string; value: string; delta: string }) => (
  <section className="rounded-[20px] border border-newBorder p-[16px]">
    <p className="text-[13px] text-textItemBlur">{label}</p>
    <p className="mt-[6px] text-[28px] font-[600]">{value}</p>
    {delta ? <p className="text-[13px] text-[#3dd68c]">{delta}</p> : <p className="text-[13px] text-textItemBlur">No data yet</p>}
  </section>
);

const ShareList = ({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: Array<{ label: string; share: number }>;
}) => (
  <section className="rounded-[20px] border border-newBorder p-[16px]">
    <h2 className="mb-[10px] text-[16px] font-[600]">{title}</h2>
    {rows.length ? (
      <div className="flex flex-col gap-[10px]">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-[4px] flex justify-between text-[13px]">
              <span>{row.label}</span>
              <span className="text-textItemBlur">{row.share}%</span>
            </div>
            <div className="lib-bar">
              <i style={{ width: `${Math.max(0, Math.min(100, row.share))}%` }} />
            </div>
          </div>
        ))}
      </div>
    ) : (
      <p className="text-[14px] text-textItemBlur">{empty}</p>
    )}
  </section>
);
