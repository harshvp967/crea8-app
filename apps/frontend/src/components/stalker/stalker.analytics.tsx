'use client';

import { useStalkerAnalytics } from '@gitroom/frontend/components/stalker/stalker.hooks';
import { useStalkerProject } from '@gitroom/frontend/components/stalker/stalker.project';

const labelOf = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const Bars = ({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; count: number }>;
}) => {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <section className="rounded-[16px] border border-newBorder bg-newBgColorInner p-[16px]">
      <h2 className="mb-[12px] text-[16px] font-[600]">{title}</h2>
      {!rows.length ? (
        <p className="text-[13px] text-textItemBlur">No mentions in this view.</p>
      ) : (
        <ul className="flex flex-col gap-[8px]">
          {rows.map((row) => (
            <li key={row.label} className="grid grid-cols-[140px_1fr_32px] items-center gap-[8px] text-[13px]">
              <span className="truncate text-textItemBlur">{row.label}</span>
              <span className="h-[8px] overflow-hidden rounded-full bg-[#1c1c1c]">
                <span
                  className="block h-full rounded-full bg-[#00D9FF]"
                  style={{ width: `${Math.round((row.count / max) * 100)}%` }}
                />
              </span>
              <span className="text-right">{row.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export const StalkerAnalytics = () => {
  const { projectId } = useStalkerProject();
  const { data, isLoading } = useStalkerAnalytics(projectId);
  const bySource = Array.isArray(data?.bySource) ? data.bySource : [];
  const byCategory = Array.isArray(data?.byCategory) ? data.byCategory : [];
  const bySentiment = Array.isArray(data?.bySentiment) ? data.bySentiment : [];
  const overTime = Array.isArray(data?.overTime) ? data.overTime : [];

  return (
    <div className="flex flex-col gap-[16px]">
      <div>
        <h1 className="text-[28px] font-[600]">Analytics</h1>
        <p className="mt-[6px] text-[14px] text-textItemBlur">
          Counts for this project, grouped by source, category, and sentiment. The timeline is the last 14 days.
        </p>
      </div>
      {isLoading ? (
        <p className="text-[14px] text-textItemBlur">Loading analytics…</p>
      ) : null}
      <div className="grid gap-[12px] xl:grid-cols-2">
        <Bars
          title="By source"
          rows={bySource.map((row: { source: string; count: number }) => ({
            label: labelOf(row.source),
            count: row.count,
          }))}
        />
        <Bars
          title="By category"
          rows={byCategory.map((row: { name: string; count: number }) => ({
            label: row.name,
            count: row.count,
          }))}
        />
        <Bars
          title="By sentiment"
          rows={bySentiment.map((row: { sentiment: string; count: number }) => ({
            label: labelOf(row.sentiment),
            count: row.count,
          }))}
        />
        <Bars
          title="Over time"
          rows={overTime.map((row: { date: string; count: number }) => ({
            label: row.date,
            count: row.count,
          }))}
        />
      </div>
    </div>
  );
};
