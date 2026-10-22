'use client';

import { CSSProperties, ReactNode, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { HugeIcon, type HugeIconName } from '@gitroom/frontend/components/icons/hugeicons';
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
import {
  STALKER_ENGAGEMENT_SOURCES,
  STALKER_FILTER_SOURCES,
} from '@gitroom/helpers/utils/stalker.sources';

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
  tz: String(new Date().getTimezoneOffset()),
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

const statusText = (status: string) =>
  status === 'NEW'
    ? 'Open'
    : status === 'DONE'
      ? 'Done'
      : status === 'FOLLOW_UP'
        ? 'Follow up'
        : status === 'IGNORED'
          ? 'Irrelevant'
          : '';

/** Short label for the save-view hint. Uses the filters the user actually set. */
export const describeFilters = (filters: MentionFilters, keywords: { id: string; phrase: string }[] = []) => {
  const parts: string[] = [];
  const preset = PRESETS.find((item) => item[0] === filters.preset);
  if (preset) parts.push(preset[1]);
  else if (filters.start || filters.end) parts.push('custom range');
  if (filters.sources.length) parts.push(filters.sources.map((source) => sourceLabel(source)).join(', '));
  if (filters.sentiment) {
    parts.push(filters.sentiment[0] + filters.sentiment.slice(1).toLowerCase());
  }
  if (filters.status && statusText(filters.status)) parts.push(statusText(filters.status));
  if (filters.keywordId) {
    parts.push(keywords.find((item) => item.id === filters.keywordId)?.phrase || 'keyword');
  }
  if (filters.categoryId) parts.push(filters.categoryId === 'none' ? 'Uncategorized' : 'category');
  if (filters.from) parts.push(filters.from);
  if (Object.values(filters.engagement).some((value) => Number(value) > 0)) parts.push('engagement');
  if (!parts.length) return 'Saves the current filters';
  return `Saves ${parts.join(' + ')}`;
};

const showDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[2]} / ${match[3]} / ${match[1]}` : value;
};

const parseDate = (value: string) => {
  const pretty = /^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})$/.exec(value.trim());
  if (!pretty) return value;
  return `${pretty[3]}-${pretty[1].padStart(2, '0')}-${pretty[2].padStart(2, '0')}`;
};

const chipIcons: Record<string, HugeIconName> = {
  cal: 'calendar',
  globe: 'globe',
  smile: 'smile',
  tag: 'tag',
  check: 'check',
  hash: 'hashtag',
  user: 'user',
  plus: 'plus',
  down: 'chevron-down',
};

const ChipIcon = ({ name }: { name: string }) => (
  <HugeIcon name={chipIcons[name] || 'plus'} size={16} />
);

const ActiveCheck = ({ on }: { on: boolean }) =>
  on ? <HugeIcon name="check" size={16} className="stk-opt-check" aria-hidden /> : null;

const BugGlyph = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
    <path d="M9 9.5V8a3 3 0 016 0v1.5" />
    <rect x="7" y="9" width="10" height="8" rx="4" />
    <path d="M4.5 11.5H7M17 11.5h2.5M5 16H7.5M16.5 16H19M12 9v8M8.5 6.5 7 5M15.5 6.5 17 5" />
  </svg>
);

const BulbGlyph = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
    <path d="M9 18h6M10 21h4" />
    <path d="M8.5 14.2c-1.4-1-2.3-2.6-2.3-4.4a5.8 5.8 0 1111.6 0c0 1.8-.9 3.4-2.3 4.4-.6.4-1 1.1-1 1.8v.2h-5v-.2c0-.7-.4-1.4-1-1.8z" />
  </svg>
);

const categoryTone = (name: string) => {
  const key = name.trim().toLowerCase();
  if (key === 'praise') return 'praise';
  if (key === 'bug report') return 'bug';
  if (key === 'feature request') return 'feature';
  if (key === 'complaint') return 'complaint';
  return 'muted';
};

const CategoryMark = ({ name }: { name: string }) => {
  const tone = categoryTone(name);
  const icon =
    tone === 'praise' ? 'thumbs-up' : tone === 'complaint' ? 'alert' : 'tag';
  return (
    <span className={`stk-cat-mark is-${tone}`} aria-hidden>
      {tone === 'bug' ? <BugGlyph /> : tone === 'feature' ? <BulbGlyph /> : <HugeIcon name={icon} size={12} />}
    </span>
  );
};

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
  const dateAnchor = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState(filters);
  const [cursor, setCursor] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date;
  });
  const [authorQuery, setAuthorQuery] = useState('');

  const dateLabel = () => {
    const preset = PRESETS.find((item) => item[0] === filters.preset);
    if (preset && filters.preset !== 'custom') return preset[1];
    if (filters.start || filters.end) {
      return `${showDate(filters.start) || '…'} – ${showDate(filters.end) || '…'}`;
    }
    return '';
  };

  const applyDate = () => {
    onChange({ ...filters, ...draft, preset: draft.preset || 'custom' });
    setOpen(null);
  };

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

  const pickDay = (value: string) => {
    if (!draft.start || (draft.start && draft.end)) {
      setDraft({ ...draft, preset: 'custom', start: value, end: '' });
      return;
    }
    setDraft({
      ...draft,
      preset: 'custom',
      start: value < draft.start ? value : draft.start,
      end: value < draft.start ? draft.start : value,
    });
  };

  const engagementOn = Object.values(filters.engagement).some((value) => Number(value) > 0);

  return (
    <div className="stk-filters flex flex-wrap items-center gap-[8px]">
      <div className="relative min-w-0">
        <button
          type="button"
          ref={dateAnchor}
          className={clsx(chipClass(!!dateLabel() || open === 'date'), 'stk-fchip')}
          onClick={() => {
            setDraft(filters);
            setOpen(open === 'date' ? null : 'date');
          }}
        >
          <ChipIcon name="cal" />
          <span className="min-w-0 flex-1 truncate text-start">{dateLabel() || 'Date'}</span>
          <ChipIcon name="down" />
        </button>
        <FilterPop open={open === 'date'} onClose={() => setOpen(null)} anchor={dateAnchor} wide>
              <div className="stk-date-layout">
                <div className="stk-date-presets">
                  {PRESETS.map(([id, text]) => (
                    <button
                      key={id}
                      type="button"
                      className={clsx(stkMenuItem, draft.preset === id && 'is-on')}
                      aria-pressed={draft.preset === id}
                      onClick={() => {
                        if (draft.preset === id) {
                          setDraft({ ...draft, preset: '', start: '', end: '' });
                          onChange({ ...filters, preset: '', start: '', end: '' });
                          setOpen(null);
                          return;
                        }
                        setDraft({ ...draft, preset: id, start: '', end: '' });
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate text-start">{text}</span>
                      <ActiveCheck on={draft.preset === id} />
                    </button>
                  ))}
                </div>
                <div>
                  <div className="stk-cal-nav">
                    <button
                      type="button"
                      className={stkGhost}
                      aria-label="Previous month"
                      onClick={() => setCursor((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))}
                    >
                      ‹
                    </button>
                    <span>{cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</span>
                    <button
                      type="button"
                      className={stkGhost}
                      aria-label="Next month"
                      onClick={() => setCursor((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))}
                    >
                      ›
                    </button>
                  </div>
                  <div className="stk-cal stk-cal-dow">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                      <span key={day}>{day}</span>
                    ))}
                  </div>
                  <div className="stk-cal">
                    {monthGrid(cursor).map((date) => {
                      const value = iso(date);
                      const outside = date.getMonth() !== cursor.getMonth();
                      const edge = value === draft.start || value === draft.end;
                      const inRange =
                        !!draft.start && !!draft.end && value > draft.start && value < draft.end;
                      return (
                        <button
                          key={value}
                          type="button"
                          className={clsx(
                            'stk-day',
                            outside && 'is-out',
                            inRange && 'is-range',
                            edge && 'is-edge'
                          )}
                          onClick={() => pickDay(value)}
                        >
                          {date.getDate()}
                        </button>
                      );
                    })}
                  </div>
                </div>
                  <div className="stk-date-fields">
                    <input
                      className={stkField}
                      placeholder="MM / DD / YYYY"
                      value={showDate(draft.start)}
                      onChange={(event) =>
                        setDraft({ ...draft, preset: 'custom', start: parseDate(event.target.value) })
                      }
                    />
                    <input
                      className={stkField}
                      placeholder="MM / DD / YYYY"
                      value={showDate(draft.end)}
                      onChange={(event) =>
                        setDraft({ ...draft, preset: 'custom', end: parseDate(event.target.value) })
                      }
                    />
                  </div>
                  <div className="stk-date-foot">
                    <button
                      type="button"
                      className={stkGhost}
                      onClick={() => setDraft({ ...draft, preset: '', start: '', end: '' })}
                    >
                      Clear
                    </button>
                    <button type="button" className={stkPrimary} onClick={applyDate}>
                      Apply
                    </button>
                  </div>
                </div>
        </FilterPop>
      </div>
      <FilterMenu
        icon="globe"
        label={filters.sources.length ? 'Source' : ''}
        title="Source"
        open={open === 'source'}
        onToggle={() => setOpen(open === 'source' ? null : 'source')}
      >
        {STALKER_FILTER_SOURCES.map((source) => {
          const checked = filters.sources.includes(source);
          return (
            <button
              key={source}
              type="button"
              className={stkMenuItem}
              aria-pressed={checked}
              onClick={() => {
                const sources = checked
                  ? filters.sources.filter((item) => item !== source)
                  : [...filters.sources, source];
                onChange({ ...filters, sources });
              }}
            >
              <span className={clsx('stk-box', checked && 'is-on')} />
              <SourceIcon source={source} />
              <span className="min-w-0 flex-1 truncate text-start">{sourceLabel(source)}</span>
            </button>
          );
        })}
      </FilterMenu>
      <FilterMenu
        icon="smile"
        label={filters.sentiment ? filters.sentiment[0] + filters.sentiment.slice(1).toLowerCase() : ''}
        title="Sentiment"
        open={open === 'sentiment'}
        onToggle={() => setOpen(open === 'sentiment' ? null : 'sentiment')}
      >
        <p className="stk-menu-hint">How they feel</p>
        {(
          [
            ['POSITIVE', 'Positive', 'is-ok'],
            ['NEUTRAL', 'Neutral', 'is-mid'],
            ['NEGATIVE', 'Negative', 'is-bad'],
          ] as const
        ).map(([sentiment, text, tone]) => (
          <button
            key={sentiment}
            type="button"
            className={stkMenuItem}
            aria-pressed={filters.sentiment === sentiment}
            onClick={() => {
              onChange({ ...filters, sentiment: filters.sentiment === sentiment ? '' : sentiment });
              setOpen(null);
            }}
          >
            <i className={`stk-sent-dot ${tone}`} />
            <span className="min-w-0 flex-1 truncate text-start">{text}</span>
            <ActiveCheck on={filters.sentiment === sentiment} />
          </button>
        ))}
      </FilterMenu>
      <FilterMenu
        icon="tag"
        label={
          filters.categoryId === 'none'
            ? 'Uncategorized'
            : categories.find((item) => item.id === filters.categoryId)?.name || ''
        }
        title="Category"
        open={open === 'category'}
        onToggle={() => setOpen(open === 'category' ? null : 'category')}
      >
        <p className="stk-menu-hint">What it&apos;s about</p>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className={stkMenuItem}
            aria-pressed={filters.categoryId === category.id}
            onClick={() => {
              onChange({
                ...filters,
                categoryId: filters.categoryId === category.id ? '' : category.id,
              });
              setOpen(null);
            }}
          >
            <CategoryMark name={category.name} />
            <span className="min-w-0 flex-1 truncate text-start">{category.name}</span>
            <ActiveCheck on={filters.categoryId === category.id} />
          </button>
        ))}
        <button
          type="button"
          className={stkMenuItem}
          aria-pressed={filters.categoryId === 'none'}
          onClick={() => {
            onChange({ ...filters, categoryId: filters.categoryId === 'none' ? '' : 'none' });
            setOpen(null);
          }}
        >
          <CategoryMark name="Uncategorized" />
          <span className="min-w-0 flex-1 truncate text-start">Uncategorized</span>
          <ActiveCheck on={filters.categoryId === 'none'} />
        </button>
        <a href="/stalker/settings" className={`${stkMenuItem} text-[color:var(--arc-accent-text)]`}>
          + Manage categories
        </a>
      </FilterMenu>
      <FilterMenu
        icon="check"
        label={statusText(filters.status)}
        title="Status"
        open={open === 'status'}
        onToggle={() => setOpen(open === 'status' ? null : 'status')}
      >
        {[
          ['NEW', 'Open'],
          ['DONE', 'Done'],
          ['FOLLOW_UP', 'Follow up'],
          ['IGNORED', 'Irrelevant'],
        ].map(([value, text]) => (
          <button
            key={value}
            type="button"
            className={stkMenuItem}
            aria-pressed={filters.status === value}
            onClick={() => {
              onChange({ ...filters, status: filters.status === value ? '' : value });
              setOpen(null);
            }}
          >
            <span className="min-w-0 flex-1 truncate text-start">{text}</span>
            <ActiveCheck on={filters.status === value} />
          </button>
        ))}
      </FilterMenu>
      <FilterMenu
        icon="hash"
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
              <div key={keyword.id} className="stk-key-row flex items-center gap-[8px] px-[8px] py-[4px] text-[14px]">
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-start"
                  aria-pressed={filters.keywordId === keyword.id}
                  onClick={() =>
                    onChange({
                      ...filters,
                      keywordId: filters.keywordId === keyword.id ? '' : keyword.id,
                    })
                  }
                >
                  {keyword.phrase}
                </button>
                <ActiveCheck on={filters.keywordId === keyword.id} />
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
        icon="user"
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
                aria-pressed={
                  filters.from === (author.authorHandle || author.authorName)
                }
                onClick={() => {
                  const value = author.authorHandle || author.authorName;
                  onChange({ ...filters, from: filters.from === value ? '' : value });
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
                <ActiveCheck
                  on={filters.from === (author.authorHandle || author.authorName)}
                />
              </button>
            </li>
          ))}
        </ul>
      </FilterMenu>
      <FilterMenu
        icon="plus"
        label={engagementOn ? 'Engagement' : ''}
        title="Engagement"
        chipClassName="stk-engage"
        open={open === 'engagement'}
        onToggle={() => setOpen(open === 'engagement' ? null : 'engagement')}
      >
        {STALKER_ENGAGEMENT_SOURCES.map((source) => (
          <label key={source} className="stk-engage-row flex items-center gap-[8px] px-[8px] py-[6px] text-[14px]">
            <SourceIcon source={source} />
            <button
              type="button"
              className="w-[88px] shrink-0 truncate text-start"
              onClick={() => {
                if (Number(filters.engagement[source]) > 0) {
                  onChange({
                    ...filters,
                    engagement: { ...filters.engagement, [source]: '' },
                  });
                }
              }}
            >
              {sourceLabel(source)}
            </button>
            <ActiveCheck on={Number(filters.engagement[source]) > 0} />
            <input
              className="h-[36px] min-w-0 flex-1 rounded-[14px] border border-newBorder bg-newBgColorInner px-[10px] text-[14px]"
              inputMode="numeric"
              placeholder="Min"
              value={filters.engagement[source] || ''}
              onChange={(event) =>
                onChange({
                  ...filters,
                  engagement: {
                    ...filters.engagement,
                    [source]: event.target.value.replace(/[^\d]/g, ''),
                  },
                })
              }
            />
          </label>
        ))}
      </FilterMenu>
    </div>
  );
};

type PopPlace = { top: number; left: number; width: number; maxHeight: number };

const placeFilterPop = (anchor: HTMLElement, menu: HTMLElement, wide: boolean): PopPlace => {
  const rect = anchor.getBoundingClientRect();
  const margin = 8;
  const gap = 8;
  const sidebar = document.querySelector('.c8-sidebar');
  const sidebarBox = sidebar?.getBoundingClientRect();
  const sidebarRight = sidebarBox && sidebarBox.width > 0 && sidebarBox.bottom > 0 ? sidebarBox.right : 0;
  const boundLeft = Math.max(margin, sidebarRight);
  const boundRight = window.innerWidth - margin;
  const width = Math.max(160, Math.min(wide ? 560 : 280, boundRight - boundLeft));
  let left = rect.left;
  if (left + width > boundRight) left = rect.right - width;
  if (left < boundLeft) left = boundLeft;
  if (left + width > boundRight) left = Math.max(boundLeft, boundRight - width);

  const spaceBelow = window.innerHeight - margin - rect.bottom - gap;
  const spaceAbove = rect.top - margin - gap;
  const content = menu.scrollHeight;
  const openAbove = spaceBelow < Math.min(content, 240) && spaceAbove > spaceBelow;
  const room = openAbove ? spaceAbove : spaceBelow;
  const maxHeight = Math.max(120, Math.min(content, wide ? 640 : 480, room, window.innerHeight - margin * 2));
  const height = Math.min(content, maxHeight);
  let top = openAbove ? rect.top - gap - height : rect.bottom + gap;
  if (top < margin) top = margin;
  if (top + height > window.innerHeight - margin) top = Math.max(margin, window.innerHeight - margin - height);
  return { top, left, width, maxHeight };
};

const FilterPop = ({
  open,
  onClose,
  anchor,
  wide,
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchor: RefObject<HTMLElement | null>;
  wide?: boolean;
  children: ReactNode;
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<PopPlace | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPlace(null);
      return;
    }
    const update = (event?: Event) => {
      const node = anchor.current;
      const menu = menuRef.current;
      if (!node || !menu) return;
      if (event?.target instanceof Node && menu.contains(event.target)) return;
      const next = placeFilterPop(node, menu, !!wide);
      setPlace((current) =>
        current &&
        current.top === next.top &&
        current.left === next.left &&
        current.width === next.width &&
        current.maxHeight === next.maxHeight
          ? current
          : next
      );
    };
    update();
    const menu = menuRef.current;
    const observer = menu && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => update()) : null;
    if (menu && observer) observer.observe(menu);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, anchor, wide]);

  if (!open || typeof document === 'undefined') return null;
  const host = document.querySelector('.stalker-screen') || document.body;
  const style: CSSProperties = place
    ? {
        position: 'fixed',
        top: place.top,
        left: place.left,
        width: place.width,
        maxHeight: place.maxHeight,
        zIndex: 90,
        margin: 0,
        right: 'auto',
        bottom: 'auto',
        transform: 'none',
        ['--stk-pop-top' as string]: `${place.top}px`,
        ['--stk-pop-left' as string]: `${place.left}px`,
        ['--stk-pop-width' as string]: `${place.width}px`,
        ['--stk-pop-max' as string]: `${place.maxHeight}px`,
        visibility: 'visible',
      }
    : { visibility: 'hidden' };
  return createPortal(
    <>
      <button type="button" className="stk-sheet-backdrop" aria-label="Close" onClick={onClose} />
      <div
        ref={menuRef}
        className={clsx(stkPopover, 'stk-filter-pop', wide && 'stk-date-pop')}
        style={style}
      >
        {children}
      </div>
    </>,
    host
  );
};

const FilterMenu = ({
  icon,
  label,
  title,
  chipClassName,
  open,
  onToggle,
  children,
}: {
  icon: string;
  label: string;
  title: string;
  chipClassName?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) => {
  const anchor = useRef<HTMLButtonElement>(null);
  return (
    <div className="relative min-w-0">
      <button
        type="button"
        ref={anchor}
        className={clsx(chipClass(!!label || open), 'stk-fchip', chipClassName)}
        onClick={onToggle}
      >
        <ChipIcon name={icon} />
        <span className="min-w-0 flex-1 truncate text-start">{label || title}</span>
        {icon === 'plus' ? null : <ChipIcon name="down" />}
      </button>
      <FilterPop open={open} onClose={onToggle} anchor={anchor}>
        {children}
      </FilterPop>
    </div>
  );
};
