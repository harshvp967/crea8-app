'use client';

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import DrawChart from 'chart.js/auto';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import {
  useStalkerAnalytics,
  useStalkerAuthors,
  useStalkerKeywords,
} from '@gitroom/frontend/components/stalker/stalker.hooks';
import { useStalkerProject } from '@gitroom/frontend/components/stalker/stalker.project';
import { StalkerProjectMenu } from '@gitroom/frontend/components/stalker/stalker.nav';
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
import { stalkerSourceEnabled } from '@gitroom/helpers/utils/stalker.sources';
import { decodeHtmlEntities } from '@gitroom/helpers/utils/stalker.text';
import { SegmentedControl } from '@gitroom/frontend/components/ui/segmented-control';
import {
  stkCard,
  stkEmpty,
  stkHead,
  stkIconTile,
  stkMenu,
  stkPage,
  stkSecondary,
  stkTitle,
} from '@gitroom/frontend/components/stalker/stalker.chrome';

type DayRow = { date: string; positive: number; negative: number; neutral: number };
type CountRow = { authorName: string; count: number };
type SourceRow = { source: string; count: number };
type CategoryRow = { name: string; count: number };
type KeywordCount = { keywordId?: string; phrase: string; count: number };
type PersonAuthor = { authorName: string; authorHandle?: string; source?: string; count: number };

const RANGES = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
] as const;

const isoDay = (date: Date) => {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const rangeKey = (filters: MentionFilters) => {
  if (filters.preset === '7d' || filters.preset === '30d') return filters.preset;
  if (filters.preset === 'custom' && filters.start && filters.end) {
    const start = new Date(`${filters.start}T00:00:00`);
    const end = new Date(`${filters.end}T00:00:00`);
    const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    if (days >= 88 && days <= 92) return '90d';
  }
  return '';
};

const applyRange = (filters: MentionFilters, key: string): MentionFilters => {
  if (key === '90d') {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 89);
    return { ...filters, preset: 'custom', start: isoDay(start), end: isoDay(end) };
  }
  if (key === '7d' || key === '30d') {
    return { ...filters, preset: key, start: '', end: '' };
  }
  return filters;
};

const percent = (count: number, sum: number) => (sum ? Math.round((count / sum) * 100) : 0);

const toneFor = (name: string) => {
  const key = name.toLowerCase();
  if (/praise|positive|love|win/.test(key)) return 'is-ok';
  if (/complain|bug|negative|critic/.test(key)) return 'is-bad';
  return '';
};

const initials = (name: string) => {
  const parts = name.split(/[\s@._-]+/).filter(Boolean);
  const letters = `${parts[0]?.charAt(0) || ''}${parts[1]?.charAt(0) || ''}`;
  return (letters || name.slice(0, 1) || '?').toUpperCase();
};

const handleLabel = (handle?: string) => {
  const clean = (handle || '').trim();
  if (!clean) return '';
  if (clean.startsWith('@') || clean.startsWith('u/')) return clean;
  return `@${clean}`;
};

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
    <div className="mb-[14px] flex items-baseline justify-between gap-[8px]">
      <h2 className="text-[16px] font-[600]">{title}</h2>
      {extra ? <span className="text-[13px] text-textItemBlur">{extra}</span> : null}
    </div>
    {children}
  </section>
);

const People = ({ rows, authors }: { rows: CountRow[]; authors: PersonAuthor[] }) => {
  if (!rows.length) {
    return <p className="text-[14px] text-textItemBlur">No mentions in this view.</p>;
  }
  return (
    <ul className="stk-people">
      {rows.map((row) => {
        const author = authors.find((item) => item.authorName === row.authorName);
        const detail = handleLabel(author?.authorHandle) || (author?.source ? sourceLabel(author.source) : '');
        return (
          <li key={`${row.authorName}-${row.count}`}>
            <span className="stk-ava" aria-hidden>
              {initials(decodeHtmlEntities(row.authorName))}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-[600]">
                {decodeHtmlEntities(row.authorName)}
              </span>
              {detail ? (
                <span className="block truncate text-[13px] text-textItemBlur">{detail}</span>
              ) : null}
            </span>
            <span className="text-[14px] tabular-nums text-textItemBlur">{row.count}</span>
          </li>
        );
      })}
    </ul>
  );
};

const cssColor = (name: string, fallback: string) => {
  const value = getComputedStyle(document.body).getPropertyValue(name).trim();
  return value || fallback;
};

const dayTotal = (row: DayRow) => row.positive + row.negative + row.neutral;

const chartIsEmpty = (rows: DayRow[]) => !rows.length || rows.every((row) => dayTotal(row) === 0);

const ChartMark = () => <HugeIcon name="chart-line" size={24} />;

type CompareLine = { name: string; points: { date: string; count: number }[] };

const COMPARE_TOKENS = [
  ['--c8-cyan', '#00d9ff'],
  ['--c8-app-stalker', '#b197fc'],
  ['--c8-warn', '#f59e0b'],
  ['--c8-app-schedule', '#ff8a4c'],
  ['--c8-app-lib', '#c2f23d'],
  ['--c8-danger', '#ff5a5f'],
] as const;

const SENTIMENT_SERIES = [
  { key: 'positive' as const, label: 'Positive', token: '--c8-sentiment-pos', fallback: '#d9f99d' },
  { key: 'neutral' as const, label: 'Neutral', token: '--c8-muted', fallback: '#6b6875' },
  { key: 'negative' as const, label: 'Negative', token: '--c8-danger', fallback: '#ff5a5f' },
];

const MentionsChart = ({
  rows,
  compare,
  mode,
}: {
  rows: DayRow[];
  compare?: CompareLine[] | null;
  mode: string;
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const lines = compare ?? [];
  const comparing = lines.length > 0;
  const empty = comparing
    ? lines.every((line) => line.points.every((point) => !point.count))
    : chartIsEmpty(rows);
  const signature = comparing
    ? lines.map((line) => `${line.name}:${line.points.map((point) => point.count).join(',')}`).join('|')
    : rows.map((row) => `${row.date}:${row.positive}:${row.negative}:${row.neutral}`).join('|');

  useEffect(() => {
    if (empty) return;
    const canvas = ref.current;
    if (!canvas) return;
    const grid = cssColor('--new-border', mode === 'light' ? '#E6E6E8' : '#2A2A2E');
    const text = cssColor('--new-textItemBlur', '#71717A');
    const ink = cssColor('--new-btn-text', mode === 'light' ? '#18181B' : '#F4F4F5');
    const raised = cssColor('--arc-raised', mode === 'light' ? '#FFFFFF' : '#161618');
    const labelSource = comparing ? lines[0]?.points || [] : rows;
    const labels = labelSource.map((row) => {
      const date = new Date(`${row.date}T00:00:00`);
      return Number.isNaN(date.getTime())
        ? row.date
        : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const last = Math.max(0, labels.length - 1);
    const marked = new Set(
      [0, Math.round(last / 3), Math.round((last * 2) / 3), last].filter((index) => index >= 0)
    );
    const chart = new DrawChart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: comparing
          ? lines.map((line, index) => {
              const [token, fallback] = COMPARE_TOKENS[index % COMPARE_TOKENS.length];
              const color = cssColor(token, fallback);
              return {
                label: line.name,
                data: line.points.map((point) => point.count),
                borderColor: color,
                backgroundColor: 'transparent',
                fill: false,
                tension: 0.35,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHoverBackgroundColor: color,
                pointHoverBorderColor: color,
                borderWidth: 2,
              };
            })
          : SENTIMENT_SERIES.map((tone) => {
              const color = cssColor(tone.token, tone.fallback);
              return {
                label: tone.label,
                data: rows.map((row) => row[tone.key]),
                borderColor: color,
                backgroundColor: 'transparent',
                fill: false,
                tension: 0.35,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHoverBackgroundColor: color,
                pointHoverBorderColor: color,
                borderWidth: 2,
              };
            }),
      },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        layout: { padding: { left: 0, right: 4, top: 8, bottom: 0 } },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: raised,
            titleColor: ink,
            bodyColor: text,
            borderColor: grid,
            borderWidth: 1,
            padding: 10,
            cornerRadius: 12,
            displayColors: true,
            titleFont: { family: 'Plus Jakarta Sans', size: 13, weight: 600 },
            bodyFont: { family: 'Plus Jakarta Sans', size: 13 },
            callbacks: {
              label: (item) => `${item.dataset.label}: ${item.parsed.y}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: text,
              autoSkip: false,
              maxRotation: 0,
              minRotation: 0,
              font: { family: 'Plus Jakarta Sans', size: 12 },
              callback: (_value, index) => (marked.has(index) ? labels[index] : ''),
            },
          },
          y: {
            beginAtZero: true,
            position: 'right',
            border: { display: false },
            grid: { color: grid },
            ticks: {
              color: text,
              precision: 0,
              maxTicksLimit: 5,
              font: { family: 'Plus Jakarta Sans', size: 12 },
            },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [comparing, empty, lines, mode, rows, signature]);

  if (empty) {
    return (
      <div className="stk-chart-empty">
        <span className="stk-empty-mark">
          <ChartMark />
        </span>
        <p>No mentions in this view.</p>
      </div>
    );
  }

  return (
    <div className="stk-chart">
      <canvas ref={ref} aria-label="Mentions over time" />
    </div>
  );
};

export const StalkerAnalytics = () => {
  const { project, projectId, sample } = useStalkerProject();
  const [filters, setFilters] = useState<MentionFilters>({
    ...emptyFilters(),
    preset: '30d',
  });
  const [scope, setScope] = useState<'brand' | 'competitors' | 'compare'>('brand');
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [mode, setMode] = useState('dark');
  const search = [filtersToSearch(filters), `group=${scope}`].filter(Boolean).join('&');
  const analytics = useStalkerAnalytics(sample ? null : projectId, search || 'date=30d');
  const keywordsQuery = useStalkerKeywords(sample ? null : projectId);
  const authorsQuery = useStalkerAuthors(sample ? null : projectId);
  const data = sample ? SAMPLE_ANALYTICS : analytics.data;
  const series = useMemo<DayRow[]>(
    () => (Array.isArray(data?.series) ? data.series : []),
    [data]
  );
  const compare = useMemo<CompareLine[] | null>(
    () => (scope === 'compare' && Array.isArray(data?.compare) ? data.compare : null),
    [data, scope]
  );
  const total = data?.totals?.mentions || 0;
  const accounts = useMemo<CountRow[]>(
    () => (Array.isArray(data?.accounts) ? data.accounts : []),
    [data]
  );
  const supporters = useMemo<CountRow[]>(
    () => (Array.isArray(data?.supporters) ? data.supporters : []),
    [data]
  );
  const critics = useMemo<CountRow[]>(
    () => (Array.isArray(data?.critics) ? data.critics : []),
    [data]
  );
  const categories = useMemo<CategoryRow[]>(
    () =>
      (Array.isArray(data?.byCategory) ? data.byCategory : [])
        .filter((row: CategoryRow) => row.count > 0)
        .sort((left: CategoryRow, right: CategoryRow) => right.count - left.count),
    [data]
  );
  const sources = useMemo<SourceRow[]>(
    () =>
      (Array.isArray(data?.bySource) ? data.bySource : [])
        .filter((row: SourceRow) => row.count > 0 && stalkerSourceEnabled(row.source))
        .sort((left: SourceRow, right: SourceRow) => right.count - left.count),
    [data]
  );
  const keywords = sample
    ? SAMPLE_KEYWORDS
    : Array.isArray(keywordsQuery.data)
      ? keywordsQuery.data
      : [];
  const keywordCounts = (
    Array.isArray(data?.byKeyword) ? data.byKeyword : []
  ) as KeywordCount[];
  const authors = sample
    ? SAMPLE_AUTHORS
    : Array.isArray(authorsQuery.data)
      ? authorsQuery.data
      : [];
  const heatmap = useMemo(
    () => (Array.isArray(data?.heatmap) ? (data.heatmap as number[][]) : []),
    [data]
  );
  const selected = rangeKey(filters);
  const categorySum = categories.reduce((sum, row) => sum + row.count, 0);
  const sourceSum = sources.reduce((sum, row) => sum + row.count, 0) || total;
  const bins = useMemo(
    () =>
      Array.from({ length: 7 }, (_, day) =>
        Array.from({ length: 12 }, (_, hour) => {
          const row = heatmap[day] || [];
          return (row[hour * 2] || 0) + (row[hour * 2 + 1] || 0);
        })
      ),
    [heatmap]
  );
  const peak = useMemo(() => {
    let best = 0;
    bins.forEach((row) =>
      row.forEach((value) => {
        if (value > best) best = value;
      })
    );
    return best;
  }, [bins]);

  useEffect(() => {
    const read = () => setMode(document.body.classList.contains('light') ? 'light' : 'dark');
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`${stkPage} stk-analytics`}>
      <div className={stkHead}>
        <div className="min-w-0">
          <div className="stk-kicker">
            <span className="stk-sticker">Stalker</span>
            {project?.name ? <span className="stk-period">{project.name}</span> : null}
          </div>
          <h1 className={stkTitle}>Analytics</h1>
          {project?.name ? (
            <button
              type="button"
              className="stk-project-sub md:hidden"
              aria-haspopup="listbox"
              aria-expanded={projectsOpen}
              onClick={() => setProjectsOpen(true)}
            >
              <span className="stk-pdot" style={{ backgroundColor: project.color || '#71717a' }} />
              <span className="truncate">{project.name}</span>
              <span aria-hidden>▾</span>
            </button>
          ) : null}
        </div>
        <div className="stk-head-actions">
          <SegmentedControl
            aria-label="Chart range"
            className="stk-segments shrink-0"
            size="sm"
            value={selected}
            onValueChange={(value) => setFilters((current) => applyRange(current, value))}
            options={RANGES.map((item) => ({ value: item.value, label: item.label }))}
          />
        </div>
      </div>
      {projectsOpen ? (
        <>
          <button
            type="button"
            className="stk-sheet-backdrop"
            aria-label="Close"
            onClick={() => setProjectsOpen(false)}
          />
          <div className={`${stkMenu} stk-project-sheet`} role="listbox">
            <StalkerProjectMenu onPick={() => setProjectsOpen(false)} />
          </div>
        </>
      ) : null}
      <StalkerFilters
        filters={filters}
        onChange={setFilters}
        keywords={keywords}
        categories={project?.categories || []}
        authors={authors}
      />
      {!data ? (
        analytics.isLoading || analytics.isValidating || analytics.data === undefined ? (
          <div className="stk-an-loading flex flex-col gap-[16px]" aria-busy="true">
            <div className="stk-skel h-[280px] animate-pulse" />
            <div className="stk-an-grid">
              <div className="stk-skel h-[180px] animate-pulse" />
              <div className="stk-skel h-[180px] animate-pulse" />
              <div className="stk-skel h-[180px] animate-pulse" />
            </div>
          </div>
        ) : (
          <section className={`${stkCard} stk-an-error`}>
            <div className={`${stkEmpty} stk-state`}>
              <span className={`${stkIconTile} stk-state-mark`} aria-hidden>
                <HugeIcon name="chart-line" size={24} />
              </span>
              <h3 className="text-[16px] font-[600]">Couldn&apos;t load analytics.</h3>
              <button type="button" className={stkSecondary} onClick={() => analytics.mutate()}>
                Try again
              </button>
            </div>
          </section>
        )
      ) : (
        <>
          <Card
            title="Mentions over time"
            extra={selected ? `Chart range · ${selected}` : 'Chart range'}
          >
            <SegmentedControl
              aria-label="Whose mentions"
              className="stk-segments stk-scope"
              size="sm"
              value={scope}
              onValueChange={(value) =>
                setScope(value === 'competitors' || value === 'compare' ? value : 'brand')
              }
              options={[
                { value: 'brand', label: 'My brand' },
                { value: 'competitors', label: 'Competitors' },
                { value: 'compare', label: 'Compare' },
              ]}
            />
            <div className="stk-an-legend">
              {compare ? (
                compare.map((line, index) => {
                  const [token, fallback] = COMPARE_TOKENS[index % COMPARE_TOKENS.length];
                  return (
                    <span
                      key={line.name}
                      className="is-line"
                      style={{ ['--stk-dot' as string]: `var(${token}, ${fallback})` }}
                    >
                      {line.name}
                    </span>
                  );
                })
              ) : (
                <>
                  <span className="is-ok">Positive</span>
                  <span>Neutral</span>
                  <span className="is-bad">Negative</span>
                </>
              )}
            </div>
            <MentionsChart rows={series} compare={compare} mode={mode} />
          </Card>
          <div className="stk-an-grid">
            <Card title="Where people mention you">
              {!sources.length ? (
                <p className="text-[14px] text-textItemBlur">No mentions in this view.</p>
              ) : (
                <ul className="flex flex-col gap-[12px]">
                  {sources.map((row) => {
                    const share = percent(row.count, sourceSum);
                    return (
                      <li key={row.source} className="stk-bar-row">
                        <span className="flex items-center justify-between gap-[8px] text-[14px]">
                          <span>{sourceLabel(row.source)}</span>
                          <span className="text-textItemBlur">{share}%</span>
                        </span>
                        <span className="stk-hb">
                          <i style={{ width: `${share}%` }} />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
            <Card title="Why people mention you">
              {!categories.length ? (
                <p className="text-[14px] text-textItemBlur">No categorized mentions</p>
              ) : (
                <ul className="flex flex-col gap-[12px]">
                  {categories.map((row) => {
                    const share = percent(row.count, categorySum);
                    return (
                      <li key={row.name} className="stk-bar-row">
                        <span className="flex items-center justify-between gap-[8px] text-[14px]">
                          <span className="truncate">{row.name}</span>
                          <span className="text-textItemBlur">{share}%</span>
                        </span>
                        <span className="stk-hb">
                          <i className={toneFor(row.name)} style={{ width: `${share}%` }} />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
            <Card title="When people mention you">
              <div className="stk-heat text-[13px] text-textItemBlur">
                <span />
                {Array.from({ length: 12 }, (_, hour) => (
                  <span key={hour} className="text-center">
                    {hour === 0 ? '12a' : hour * 2}
                  </span>
                ))}
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
                  <div key={day} className="contents">
                    <span>{day}</span>
                    {bins[index].map((value, hour) => (
                      <span
                        key={`${day}-${hour}`}
                        className="stk-heat-cell"
                        title={value ? `${day} ${hour * 2}:00 · ${value}` : undefined}
                        style={{
                          background:
                            value && peak
                              ? `color-mix(in srgb, var(--c8-cyan) ${Math.max(18, Math.round((value / peak) * 70))}%, transparent)`
                              : 'transparent',
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Top supporters">
              <People rows={supporters} authors={authors} />
            </Card>
            <Card title="Top critics">
              <People rows={critics} authors={authors} />
            </Card>
            <Card title="Accounts mentioning you most">
              <People rows={accounts} authors={authors} />
            </Card>
          </div>
          <Card title="Keywords">
            {!keywords.length ? (
              <p className="text-[14px] text-textItemBlur">No keywords yet.</p>
            ) : (
              <div className="stk-table-wrap">
                <table className="stk-table w-full text-left">
                  <thead>
                    <tr>
                      <th>Keyword</th>
                      <th>Group</th>
                      <th>Mentions{selected ? ` (${selected})` : ''}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keywords.map((keyword) => {
                      const count =
                        keywordCounts.find(
                          (row) =>
                            (!!keyword.id && row.keywordId === keyword.id) ||
                            row.phrase === keyword.phrase
                        )?.count || 0;
                      return (
                        <tr key={keyword.id || keyword.phrase}>
                          <td>{keyword.phrase}</td>
                          <td data-label="Group">{keyword.group?.name || '—'}</td>
                          <td data-label={selected ? `Mentions (${selected})` : 'Mentions'}>{count}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};
