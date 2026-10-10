'use client';

import { ReactNode, useMemo, useState } from 'react';
import clsx from 'clsx';
import { SourceIcon } from '@gitroom/frontend/components/stalker/stalker.icons';
import { sourceLabel } from '@gitroom/frontend/components/stalker/stalker.labels';
import {
  stkChip,
  stkChipOn,
  stkField,
  stkGhost,
  stkMenuItem,
  stkPopover,
  stkPrimary,
} from '@gitroom/frontend/components/stalker/stalker.chrome';

export type MentionFilters = {
  preset: string;
  start: string;
  end: string;
  sources: string[];
  engagement: Record<string, string>;
  from: string;
  keywordId: string;
  categoryId: string;
  sentiment: string;
  status: string;
  offTopic?: boolean;
};

export const emptyFilters = (): MentionFilters => ({
  preset: '',
  start: '',
  end: '',
  sources: [],
  engagement: {},
  from: '',
  keywordId: '',
  categoryId: '',
  sentiment: '',
  status: '',
  offTopic: false,
});

const PRESETS = [
  ['today', 'Today'],
  ['7d', 'Last 7 days'],
  ['30d', 'Last 30 days'],
  ['4w', 'Last 4 weeks'],
  ['6m', 'Last 6 months'],
  ['12m', 'Last 12 months'],
  ['mtd', 'Month to date'],
  ['qtd', 'Quarter to date'],
  ['ytd', 'Year to date'],
  ['all', 'All time'],
] as const;

const iso = (date: Date) => {
  const copy = new Date(date);
  const month = `${copy.getMonth() + 1}`.padStart(2, '0');
  const day = `${copy.getDate()}`.padStart(2, '0');
  return `${copy.getFullYear()}-${month}-${day}`;
};

export const resolveRange = (filters: MentionFilters) => {
  const now = new Date();
  const startOf = (date: Date) => {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
  };
  if (filters.preset === 'all' || (!filters.preset && !filters.start && !filters.end)) {
    return { start: '', end: '' };
  }
  if (filters.preset === 'custom' || (!filters.preset && (filters.start || filters.end))) {
    return { start: filters.start, end: filters.end };
  }
  const end = iso(now);
  if (filters.preset === 'today') return { start: end, end };
  if (filters.preset === '7d') {
    const start = startOf(now);
    start.setDate(start.getDate() - 6);
    return { start: iso(start), end };
  }
  if (filters.preset === '30d') {
    const start = startOf(now);
    start.setDate(start.getDate() - 29);
    return { start: iso(start), end };
  }
  if (filters.preset === '4w') {
    const start = startOf(now);
    start.setDate(start.getDate() - 27);
    return { start: iso(start), end };
  }
  if (filters.preset === '6m') {
    const start = startOf(now);
    start.setMonth(start.getMonth() - 6);
    return { start: iso(start), end };
  }
  if (filters.preset === '12m') {
    const start = startOf(now);
    start.setMonth(start.getMonth() - 12);
    return { start: iso(start), end };
  }
  if (filters.preset === 'mtd') {
    return { start: iso(new Date(now.getFullYear(), now.getMonth(), 1)), end };
  }
  if (filters.preset === 'qtd') {
    const quarter = Math.floor(now.getMonth() / 3) * 3;
    return { start: iso(new Date(now.getFullYear(), quarter, 1)), end };
  }
  if (filters.preset === 'ytd') {
    return { start: iso(new Date(now.getFullYear(), 0, 1)), end };
  }
  return { start: filters.start, end: filters.end };
};

export const filtersToSearch = (filters: MentionFilters) => {
  const params = new URLSearchParams();
  const range = resolveRange(filters);
  if (range.start) params.set('start', range.start);
  if (range.end) params.set('end', range.end);
  // start/end are local calendar days; tell the API which timezone they're in.
  if (range.start || range.end) params.set('tz', String(new Date().getTimezoneOffset()));
  if (filters.sources.length) params.set('source', filters.sources.join(','));
  const engagement = Object.entries(filters.engagement)
    .filter(([, value]) => Number(value) > 0)
    .map(([key, value]) => `${key}:${value}`)
    .join(',');
  if (engagement) params.set('engagement', engagement);
  if (filters.from) params.set('from', filters.from);
  if (filters.keywordId) params.set('keywordId', filters.keywordId);
  if (filters.categoryId) params.set('categoryId', filters.categoryId);
  if (filters.sentiment) params.set('sentiment', filters.sentiment);
  if (filters.status) params.set('status', filters.status);
  if (filters.offTopic) params.set('offTopic', 'include');
  return params.toString();
};

export const filtersToView = (filters: MentionFilters) => ({
  preset: filters.preset,
  start: filters.start,
  end: filters.end,
  sources: filters.sources.join(','),
  engagement: Object.entries(filters.engagement)
    .map(([key, value]) => `${key}:${value}`)
    .join(','),
  from: filters.from,
  keywordId: filters.keywordId,
  categoryId: filters.categoryId,
  sentiment: filters.sentiment,
  status: filters.status,
  offTopic: filters.offTopic ? 'include' : '',
});

export const viewToFilters = (raw: Record<string, string | undefined>): MentionFilters => {
  const engagement: Record<string, string> = {};
  for (const part of (raw.engagement || '').split(',')) {
    const [key, value] = part.split(':');
    if (key && value) engagement[key] = value;
  }
  return {
    preset: raw.preset || '',
    start: raw.start || '',
    end: raw.end || '',
    sources: (raw.sources || raw.source || '').split(',').filter(Boolean),
    engagement,
    from: raw.from || '',
    keywordId: raw.keywordId || '',
    categoryId: raw.categoryId || '',
    sentiment: raw.sentiment || '',
    status: raw.status || '',
    offTopic: raw.offTopic === 'include',
  };
};

export const filtersActive = (filters: MentionFilters, baseline: MentionFilters) =>
  JSON.stringify(filters) !== JSON.stringify(baseline);

const chipClass = (on: boolean) => (on ? stkChipOn : stkChip);

const monthGrid = (cursor: Date) => {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
};

type KeywordRow = {
  id: string;
  phrase: string;
  group?: { id: string; name: string } | null;
};

type CategoryRow = { id: string; name: string };

type AuthorRow = {
  authorName: string;
  authorHandle: string;
  source: string;
  count: number;
};

export const StalkerFilters = ({
  filters,
  onChange,
  keywords,
  categories,
  authors,
}: {
  filters: MentionFilters;
  onChange: (next: MentionFilters) => void;
  keywords: KeywordRow[];
  categories: CategoryRow[];
  authors: AuthorRow[];
}) => {
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState(filters);
  const [cursor, setCursor] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date;
  });
  const [authorQuery, setAuthorQuery] = useState('');

  const label = (id: string, fallback: string, value?: string) =>
    value ? value : `+ ${fallback}`;

  const dateLabel = () => {
    const preset = PRESETS.find((item) => item[0] === filters.preset);
    if (preset && filters.preset !== 'custom') return preset[1];
    if (filters.start || filters.end) return `${filters.start || '…'} – ${filters.end || '…'}`;
    return '';
  };

  const applyDate = () => {
    onChange({ ...filters, ...draft, preset: draft.preset || 'custom' });
    setOpen(null);
  };

  const months = useMemo(() => {
    const right = new Date(cursor);
    const left = new Date(cursor);
    left.setMonth(left.getMonth() - 1);
    return [left, right];
  }, [cursor]);

  const grouped = keywords.reduce<Record<string, KeywordRow[]>>((bag, keyword) => {
    const name = keyword.group?.name || 'My brand';
    bag[name] = bag[name] || [];
    bag[name].push(keyword);
    return bag;
  }, {});

  const visibleAuthors = authors.filter((author) => {
    const query = authorQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      author.authorName.toLowerCase().includes(query) ||
      author.authorHandle.toLowerCase().includes(query)
    );
  });

  return (
    <div className="stk-filters flex flex-wrap items-center gap-[8px]">
      <div className="relative">
        <button type="button" className={chipClass(!!dateLabel())} onClick={() => {
          setDraft(filters);
          setOpen(open === 'date' ? null : 'date');
        }}>
          {label('date', 'Date', dateLabel())}
        </button>
        {open === 'date' ? (
          <div className={`${stkPopover} w-[min(720px,calc(100vw-32px))]`}>
            <div className="grid gap-[12px] md:grid-cols-[180px_1fr]">
              <div className="flex flex-col">
                {PRESETS.map(([id, text]) => (
                  <button
                    key={id}
                    type="button"
                    className={clsx(
                      stkMenuItem,
                      draft.preset === id && 'bg-newBoxHover'
                    )}
                    onClick={() => setDraft({ ...draft, preset: id, start: '', end: '' })}
                  >
                    {text}
                  </button>
                ))}
              </div>
              <div>
                <div className="mb-[8px] flex gap-[8px]">
                  <input className={stkField} placeholder="MM / DD / YYYY" value={draft.start} onChange={(event) => setDraft({ ...draft, preset: 'custom', start: event.target.value })} />
                  <input className={stkField} placeholder="MM / DD / YYYY" value={draft.end} onChange={(event) => setDraft({ ...draft, preset: 'custom', end: event.target.value })} />
                </div>
                <div className="mb-[8px] flex items-center justify-between text-[14px] font-[600]">
                  <button type="button" aria-label="Previous month" onClick={() => setCursor((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))}>‹</button>
                  <span>
                    {months[0].toLocaleString(undefined, { month: 'long', year: 'numeric' })}
                    {'  '}
                    {months[1].toLocaleString(undefined, { month: 'long', year: 'numeric' })}
                  </span>
                  <button type="button" aria-label="Next month" onClick={() => setCursor((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))}>›</button>
                </div>
                <div className="grid grid-cols-2 gap-[12px]">
                  {months.map((month) => (
                    <div key={month.toISOString()}>
                      <div className="grid grid-cols-7 text-center text-[13px] text-textItemBlur">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                          <span key={day}>{day}</span>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 text-center text-[14px]">
                        {monthGrid(month).map((date) => {
                          const value = iso(date);
                          const outside = date.getMonth() !== month.getMonth();
                          const selected = value === draft.start || value === draft.end;
                          return (
                            <button
                              key={value + month.getMonth()}
                              type="button"
                              className={clsx(
                                'mx-auto my-[2px] flex h-[36px] w-[36px] items-center justify-center rounded-[12px]',
                                outside && 'text-textItemBlur/50',
                                selected && 'bg-forth font-[600] text-[#0A0A0A]'
                              )}
                              onClick={() => {
                                if (!draft.start || (draft.start && draft.end)) {
                                  setDraft({ ...draft, preset: 'custom', start: value, end: '' });
                                } else {
                                  setDraft({
                                    ...draft,
                                    preset: 'custom',
                                    start: value < draft.start ? value : draft.start,
                                    end: value < draft.start ? draft.start : value,
                                  });
                                }
                              }}
                            >
                              {date.getDate()}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-[8px] flex justify-end gap-[8px]">
                  <button type="button" className={stkGhost} onClick={() => setDraft({ ...draft, preset: '', start: '', end: '' })}>Clear</button>
                  <button type="button" className={stkPrimary} onClick={applyDate}>Apply</button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <FilterMenu
        label={filters.sources.length ? filters.sources.join(', ') : ''}
        title="Source"
        open={open === 'source'}
        onToggle={() => setOpen(open === 'source' ? null : 'source')}
      >
        {['X', 'REDDIT', 'YOUTUBE', 'LINKEDIN'].map((source) => (
          <div key={source} className="flex items-center justify-between gap-[12px] px-[8px] py-[8px] text-[14px]">
            <label className="flex items-center gap-[8px]">
              <input
                type="checkbox"
                checked={filters.sources.includes(source)}
                onChange={() => {
                  const sources = filters.sources.includes(source)
                    ? filters.sources.filter((item) => item !== source)
                    : [...filters.sources, source];
                  onChange({ ...filters, sources });
                }}
              />
              <SourceIcon source={source} />
              {sourceLabel(source)}
            </label>
            {source !== 'REDDIT' ? (
              <input
                className="h-[36px] w-[120px] rounded-[14px] border border-newBorder bg-newBgColorInner px-[10px] text-[14px]"
                placeholder="+ Engagement"
                value={filters.engagement[source] || ''}
                onChange={(event) =>
                  onChange({
                    ...filters,
                    engagement: { ...filters.engagement, [source]: event.target.value.replace(/[^\d]/g, '') },
                  })
                }
              />
            ) : null}
          </div>
        ))}
      </FilterMenu>
      <FilterMenu
        label={filters.from ? filters.from : ''}
        title="From"
        open={open === 'from'}
        onToggle={() => setOpen(open === 'from' ? null : 'from')}
      >
        <input
          className={`${stkField} mb-[8px]`}
          placeholder="Name or @handle"
          value={authorQuery}
          onChange={(event) => setAuthorQuery(event.target.value)}
        />
        <ul className="max-h-[240px] overflow-auto">
          {visibleAuthors.map((author) => (
            <li key={`${author.authorHandle}-${author.source}`}>
              <button
                type="button"
                className={stkMenuItem}
                onClick={() => {
                  onChange({ ...filters, from: author.authorHandle || author.authorName });
                  setOpen(null);
                }}
              >
                <span className="flex h-[28px] w-[28px] items-center justify-center rounded-full border border-newBorder bg-newBoxHover text-[13px] font-[600]">
                  {author.authorName.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px]">{author.authorName}</span>
                  <span className="block truncate text-[13px] text-textItemBlur">{author.authorHandle ? `@${author.authorHandle}` : ''}</span>
                </span>
                <SourceIcon source={author.source} />
                <span className="text-[13px] text-textItemBlur">{author.count}</span>
              </button>
            </li>
          ))}
        </ul>
      </FilterMenu>
      <FilterMenu
        label={filters.keywordId ? keywords.find((item) => item.id === filters.keywordId)?.phrase || 'Keyword' : ''}
        title="Keywords"
        open={open === 'keywords'}
        onToggle={() => setOpen(open === 'keywords' ? null : 'keywords')}
      >
        <p className="px-[8px] py-[4px] text-[13px] text-textItemBlur">
          All keywords · {keywords.length} tracked
        </p>
        {Object.entries(grouped).map(([name, rows]) => (
          <div key={name} className="mt-[6px]">
            <p className="px-[8px] text-[13px] font-[500] text-textItemBlur">{name}</p>
            {rows.map((keyword) => (
              <div key={keyword.id} className="flex items-center justify-between px-[8px] py-[4px] text-[14px]">
                <button type="button" onClick={() => onChange({ ...filters, keywordId: keyword.id })}>
                  {keyword.phrase}
                </button>
                <button
                  type="button"
                  className="text-[13px] text-[color:var(--arc-accent-text)]"
                  onClick={() => {
                    onChange({ ...filters, keywordId: keyword.id });
                    setOpen(null);
                  }}
                >
                  Only
                </button>
              </div>
            ))}
          </div>
        ))}
      </FilterMenu>
      <FilterMenu
        label={
          filters.categoryId === 'none'
            ? 'Uncategorized'
            : categories.find((item) => item.id === filters.categoryId)?.name || ''
        }
        title="Category"
        open={open === 'category'}
        onToggle={() => setOpen(open === 'category' ? null : 'category')}
      >
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className={stkMenuItem}
            onClick={() => {
              onChange({ ...filters, categoryId: category.id });
              setOpen(null);
            }}
          >
            {category.name}
          </button>
        ))}
        <button
          type="button"
          className={stkMenuItem}
          onClick={() => {
            onChange({ ...filters, categoryId: 'none' });
            setOpen(null);
          }}
        >
          Uncategorized
        </button>
        <a href="/stalker/settings" className={`${stkMenuItem} text-[color:var(--arc-accent-text)]`}>
          + Manage categories
        </a>
      </FilterMenu>
      <FilterMenu
        label={filters.sentiment ? filters.sentiment[0] + filters.sentiment.slice(1).toLowerCase() : ''}
        title="Sentiment"
        open={open === 'sentiment'}
        onToggle={() => setOpen(open === 'sentiment' ? null : 'sentiment')}
      >
        {['POSITIVE', 'NEUTRAL', 'NEGATIVE'].map((sentiment) => (
          <button
            key={sentiment}
            type="button"
            className={stkMenuItem}
            onClick={() => {
              onChange({ ...filters, sentiment });
              setOpen(null);
            }}
          >
            {sentiment[0] + sentiment.slice(1).toLowerCase()}
          </button>
        ))}
      </FilterMenu>
      <FilterMenu
        label={filters.status === 'NEW' ? 'Open' : filters.status === 'DONE' ? 'Done' : filters.status === 'FOLLOW_UP' ? 'Follow up' : ''}
        title="Status"
        open={open === 'status'}
        onToggle={() => setOpen(open === 'status' ? null : 'status')}
      >
        {[
          ['NEW', 'Open'],
          ['DONE', 'Done'],
          ['FOLLOW_UP', 'Follow up'],
        ].map(([value, text]) => (
          <button
            key={value}
            type="button"
            className={stkMenuItem}
            onClick={() => {
              onChange({ ...filters, status: value });
              setOpen(null);
            }}
          >
            {text}
          </button>
        ))}
      </FilterMenu>
    </div>
  );
};

const FilterMenu = ({
  label,
  title,
  open,
  onToggle,
  children,
}: {
  label: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) => (
  <div className="relative">
    <button type="button" className={chipClass(!!label)} onClick={onToggle}>
      {label || `+ ${title}`}
    </button>
    {open ? (
      <div className={`${stkPopover} w-[280px]`}>
        {children}
      </div>
    ) : null}
  </div>
);
