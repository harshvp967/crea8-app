'use client';

import { ReactNode, useMemo, useState } from 'react';
import {
  useStalkerAnalytics,
  useStalkerAuthors,
  useStalkerKeywords,
} from '@gitroom/frontend/components/stalker/stalker.hooks';
import { useStalkerProject } from '@gitroom/frontend/components/stalker/stalker.project';
import {
  emptyFilters,
  filtersToSearch,
  MentionFilters,
  StalkerFilters,
} from '@gitroom/frontend/components/stalker/stalker.filters';
import {
  SAMPLE_ANALYTICS,
  SAMPLE_AUTHORS,
  SAMPLE_KEYWORDS,
} from '@gitroom/frontend/components/stalker/stalker.sample';
import { sourceLabel } from '@gitroom/frontend/components/stalker/stalker.labels';
import { decodeHtmlEntities } from '@gitroom/helpers/utils/stalker.text';
import {
  stkCard,
  stkEmpty,
  stkHead,
  stkPage,
  stkSecondary,
  stkTitle,
} from '@gitroom/frontend/components/stalker/stalker.chrome';


const Card = ({
  title,
  extra,
  children,
}: {
  title: string;
  extra?: string;
  children: ReactNode;
}) => (
  <section className={stkCard}>
    <div className="mb-[12px] flex items-baseline justify-between gap-[8px]">
      <h2 className="text-[16px] font-[600]">{title}</h2>
      {extra ? <span className="text-[13px] text-textItemBlur">{extra}</span> : null}
    </div>
    {children}
  </section>
);

export const StalkerAnalytics = () => {
  const { project, projectId, sample } = useStalkerProject();
  const [filters, setFilters] = useState<MentionFilters>({
    ...emptyFilters(),
    preset: '30d',
  });
  const [window, setWindow] = useState(30);
  const search = filtersToSearch(filters);
  const analytics = useStalkerAnalytics(sample ? null : projectId, search || 'date=30d');
  const keywordsQuery = useStalkerKeywords(sample ? null : projectId);
  const authorsQuery = useStalkerAuthors(sample ? null : projectId);
  const data = sample ? SAMPLE_ANALYTICS : analytics.data;
  const series = Array.isArray(data?.series) ? data.series : [];
  const visible = series.slice(Math.max(0, series.length - window));
  const max = Math.max(
    1,
    ...visible.map(
      (row: { positive: number; negative: number; neutral: number }) =>
        row.positive + row.negative + row.neutral
    )
  );
  const total = data?.totals?.mentions || 0;
  const avg = data?.avgPerDay ?? (visible.length ? Math.round((total / Math.max(1, series.length)) * 10) / 10 : 0);
  const accounts = Array.isArray(data?.accounts) ? data.accounts : [];
  const supporters = Array.isArray(data?.supporters) ? data.supporters : [];
  const critics = Array.isArray(data?.critics) ? data.critics : [];
  const categories = Array.isArray(data?.byCategory) ? data.byCategory : [];
  const sources = Array.isArray(data?.bySource) ? data.bySource : [];
  const keywords = sample
    ? SAMPLE_KEYWORDS
    : Array.isArray(keywordsQuery.data)
      ? keywordsQuery.data
      : [];
  const keywordCounts = Array.isArray(data?.byKeyword) ? data.byKeyword : [];
  const heatmap = useMemo(
    () => (Array.isArray(data?.heatmap) ? (data.heatmap as number[][]) : []),
    [data]
  );
  const peak = useMemo(() => {
    let best = 0;
    heatmap.forEach((row) => row.forEach((value) => {
      if (value > best) best = value;
    }));
    return best;
  }, [heatmap]);

  return (
    <div className={stkPage}>
      <div className={stkHead}>
        <h1 className={stkTitle}>Analytics</h1>
      </div>
      <StalkerFilters
        filters={filters}
        onChange={setFilters}
        keywords={keywords}
        categories={project?.categories || []}
        authors={sample ? SAMPLE_AUTHORS : Array.isArray(authorsQuery.data) ? authorsQuery.data : []}
      />
      {!data ? (
        // Never render zeros while the numbers are still loading (or failed):
        // "0 / day" looked like real data.
        analytics.isLoading || analytics.isValidating || analytics.data === undefined ? (
          <div className="flex flex-col gap-[12px]" aria-busy="true">
            <div className="stk-skel h-[240px] animate-pulse" />
            <div className="grid gap-[16px] lg:grid-cols-3">
              <div className="stk-skel h-[160px] animate-pulse" />
              <div className="stk-skel h-[160px] animate-pulse" />
              <div className="stk-skel h-[160px] animate-pulse" />
            </div>
          </div>
        ) : (
          <Card title="Analytics">
            <div className={stkEmpty}>
              <h3 className="text-[16px] font-[600]">Couldn&apos;t load analytics.</h3>
              <button type="button" className={stkSecondary} onClick={() => analytics.mutate()}>
                Try again
              </button>
            </div>
          </Card>
        )
      ) : (
      <>
      <Card title="Mentions over time" extra={`${avg} / day`}>
        <div className="mb-[8px] flex justify-end gap-[12px] text-[13px]">
          <span className="text-[color:var(--arc-success)]">● Positive</span>
          <span className="text-[color:var(--arc-danger)]">● Negative</span>
          <span className="text-textItemBlur">● Neutral</span>
        </div>
        <div className="flex h-[180px] items-end gap-[3px]">
          {visible.map((row: { date: string; positive: number; negative: number; neutral: number }) => {
            const sum = row.positive + row.negative + row.neutral;
            const height = `${Math.max(2, Math.round((sum / max) * 160))}px`;
            return (
              <div key={row.date} className="flex flex-1 flex-col justify-end" title={`${row.date}: ${sum}`} style={{ height }}>
                <div className="bg-[color:var(--arc-danger)] opacity-70" style={{ height: sum ? `${(row.negative / sum) * 100}%` : 0 }} />
                <div className="bg-[color:var(--arc-success)] opacity-70" style={{ height: sum ? `${(row.positive / sum) * 100}%` : 0 }} />
                <div className="bg-newBorder" style={{ height: sum ? `${(row.neutral / sum) * 100}%` : '100%' }} />
              </div>
            );
          })}
        </div>
        <input
          className="mt-[12px] w-full"
          type="range"
          min={7}
          max={Math.max(7, series.length || 30)}
          value={Math.min(window, Math.max(7, series.length || 30))}
          onChange={(event) => setWindow(Number(event.target.value))}
          aria-label="Chart range"
        />
      </Card>
      <div className="grid gap-[16px] lg:grid-cols-3">
        <Card title="Accounts mentioning you most" extra={`${accounts.length} accounts`}>
          {!accounts.length ? (
            <p className="text-[14px] text-textItemBlur">No mentions in this view.</p>
          ) : (
            <ul className="flex flex-col gap-[8px]">
              {accounts.map((row: { authorName: string; count: number }) => (
                <li key={row.authorName} className="flex items-center justify-between text-[14px]">
                  <span className="truncate">{decodeHtmlEntities(row.authorName)}</span>
                  <span className="text-textItemBlur">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Top supporters">
          {!supporters.length ? (
            <p className="text-[14px] text-textItemBlur">No supporters yet</p>
          ) : (
            <ul className="flex flex-col gap-[8px]">
              {supporters.map((row: { authorName: string; count: number }) => (
                <li key={row.authorName} className="flex justify-between text-[14px]">
                  <span>{decodeHtmlEntities(row.authorName)}</span>
                  <span className="text-[color:var(--arc-success)]">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Top critics">
          {!critics.length ? (
            <p className="text-[14px] text-textItemBlur">No critics yet</p>
          ) : (
            <ul className="flex flex-col gap-[8px]">
              {critics.map((row: { authorName: string; count: number }) => (
                <li key={row.authorName} className="flex justify-between text-[14px]">
                  <span>{decodeHtmlEntities(row.authorName)}</span>
                  <span className="text-[color:var(--arc-danger)]">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Why people mention you">
          {!categories.some((row: { count: number; name: string }) => row.name !== 'Uncategorized' && row.count) ? (
            <p className="text-[14px] text-textItemBlur">No categorized mentions</p>
          ) : (
            <ul className="flex flex-col gap-[8px]">
              {categories.map((row: { name: string; count: number }) => (
                <li key={row.name} className="flex justify-between gap-[12px] text-[14px]">
                  <span>{row.name}</span>
                  <span className="text-textItemBlur">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Where people mention you">
          {!sources.length ? (
            <p className="text-[14px] text-textItemBlur">No mentions in this view.</p>
          ) : (
            <ul className="flex flex-col gap-[8px]">
              {sources.map((row: { source: string; count: number }) => (
                <li key={row.source} className="flex flex-col gap-[4px] text-[14px]">
                  <span className="flex items-center justify-between gap-[8px]">
                    <span>{sourceLabel(row.source)}</span>
                    <span className="text-[13px] text-textItemBlur">
                      {total ? `${Math.round((row.count / total) * 100)}%` : '0%'}
                    </span>
                  </span>
                  <span className="stk-hb">
                    <i style={{ width: total ? `${Math.round((row.count / total) * 100)}%` : '0%' }} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="When people mention you">
          {!peak ? (
            <p className="text-[14px] text-textItemBlur">No mentions in this view.</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="stk-heat text-[13px] text-textItemBlur">
                <span />
                {Array.from({ length: 12 }, (_, hour) => (
                  <span key={hour} className="text-center">{hour === 0 ? '12a' : hour}</span>
                ))}
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
                  <div key={day} className="contents">
                    <span>{day}</span>
                    {(heatmap[index] || []).filter((_, hour) => hour % 2 === 0).map((value, hour) => (
                      <span
                        key={`${day}-${hour}`}
                        className="h-[14px] rounded-[3px] border border-newBorder"
                        style={{
                          background:
                            value && value === peak
                              ? 'color-mix(in srgb, #00D9FF 45%, transparent)'
                              : value
                                ? `color-mix(in srgb, #00D9FF ${Math.max(12, Math.round((value / peak) * 40))}%, transparent)`
                                : 'transparent',
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
      <Card title="Keywords">
        {!keywords.length ? (
          <p className="text-[14px] text-textItemBlur">No keywords yet.</p>
        ) : (
          <ul className="flex flex-col gap-[8px]">
            {keywords.map((keyword: { id?: string; phrase: string }) => {
              const count =
                keywordCounts.find(
                  (row: { keywordId?: string; phrase: string; count: number }) =>
                    (!!keyword.id && row.keywordId === keyword.id) || row.phrase === keyword.phrase
                )?.count || 0;
              return (
                <li key={keyword.id || keyword.phrase} className="flex justify-between text-[14px]">
                  <span>{keyword.phrase}</span>
                  <span className="text-textItemBlur">{count}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      </>
      )}
    </div>
  );
};
