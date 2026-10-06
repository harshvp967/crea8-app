'use client';

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { useDebounce } from 'use-debounce';
import { Button } from '@gitroom/react/form/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import {
  useStalkerKeywords,
  useStalkerMentions,
  useStalkerViews,
} from '@gitroom/frontend/components/stalker/stalker.hooks';
import { useStalkerComposer } from '@gitroom/frontend/components/stalker/use.stalker.composer';
import { useStalkerProject } from '@gitroom/frontend/components/stalker/stalker.project';
import { SourceIcon } from '@gitroom/frontend/components/stalker/stalker.icons';

const SOURCE_OPTIONS = [
  { id: 'YOUTUBE_SEARCH', label: 'YouTube' },
  { id: 'YOUTUBE_COMMENT', label: 'YouTube comments' },
  { id: 'REDDIT', label: 'Reddit' },
  { id: 'X', label: 'X' },
  { id: 'LINKEDIN', label: 'LinkedIn' },
  { id: 'INSTAGRAM_COMMENT', label: 'Instagram' },
  { id: 'FACEBOOK_COMMENT', label: 'Facebook' },
];

const labelOf = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const sentimentLabel = (sentiment?: string) => {
  if (sentiment === 'POSITIVE') return 'Positive';
  if (sentiment === 'NEGATIVE') return 'Negative';
  return 'Neutral';
};

const initials = (name?: string) => {
  const parts = (name || '?').trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || '?';
};

const dayKey = (iso?: string) => {
  if (!iso) return 'earlier';
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const dayHeading = (iso?: string) => {
  if (!iso) return 'EARLIER';
  const date = new Date(iso);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const diff = start.getTime() - day.getTime();
  if (diff === 0) return 'TODAY';
  if (diff === 24 * 60 * 60 * 1000) return 'YESTERDAY';
  return date
    .toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    })
    .toUpperCase();
};

const relativeTime = (iso?: string) => {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const diff = start.getTime() - day.getTime();
  const clock = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  if (diff === 0) {
    const minutes = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60000));
    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.round(minutes / 60);
    if (hours < 12) return `${hours}h`;
    return `today at ${clock}`;
  }
  if (diff === 24 * 60 * 60 * 1000) return `yesterday at ${clock}`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const timePercent = (iso?: string) => {
  if (!iso) return 0;
  const date = new Date(iso);
  const minutes = date.getHours() * 60 + date.getMinutes();
  return (minutes / (24 * 60)) * 100;
};

const highlight = (text: string, phrase?: string) => {
  const needle = (phrase || '').trim();
  if (needle.length < 2) {
    return text;
  }
  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) {
    return text;
  }
  return (
    <>
      {text.slice(0, index)}
      <span className="rounded-full bg-[#00D9FF]/15 px-[6px] py-[1px] text-[#00A3C4] dark:text-[#7BE7FF]">
        {text.slice(index, index + needle.length)}
      </span>
      {text.slice(index + needle.length)}
    </>
  );
};

type Mention = {
  id: string;
  createdAt?: string;
  category?: string;
  source?: string;
  sentiment?: string;
  status?: 'NEW' | 'REPLIED' | 'IGNORED';
  urgency: number;
  text: string;
  authorName?: string;
  authorHandle?: string;
  likeCount?: number;
  replyCount?: number;
  saved?: boolean;
  matchKind?: string;
  matchLabel?: string;
  url?: string;
  integrationId?: string | null;
  keyword?: { phrase?: string };
  categoryDef?: { id: string; name: string } | null;
};

type SavedView = {
  id: string;
  name: string;
  filters: {
    date?: string;
    source?: string;
    from?: string;
    keywordId?: string;
    categoryId?: string;
    sentiment?: string;
    status?: string;
    q?: string;
    match?: string;
    offTopic?: string;
  };
};

const Chip = ({
  label,
  active,
  open,
  onClick,
  onClear,
  children,
}: {
  label: string;
  active?: string;
  open: boolean;
  onClick: () => void;
  onClear?: () => void;
  children: ReactNode;
}) => (
  <div className="relative">
    <div
      className={clsx(
        'inline-flex items-center rounded-full border text-[12px]',
        active
          ? 'border-[#00D9FF]/40 bg-[#00D9FF]/10 text-[#00A3C4] dark:text-[#7BE7FF]'
          : 'border-newBorder text-textItemBlur hover:border-[#00D9FF]/30'
      )}
    >
      <button type="button" className="max-w-[180px] truncate px-[10px] py-[5px]" onClick={onClick}>
        {active ? active : `+ ${label}`}
      </button>
      {active && onClear ? (
        <button
          type="button"
          aria-label={`Remove ${label} filter`}
          className="pe-[8px] text-[14px] leading-none"
          onClick={onClear}
        >
          ×
        </button>
      ) : null}
    </div>
    {open ? (
      <div className="absolute start-0 top-[calc(100%+6px)] z-20 min-w-[180px] rounded-[12px] border border-newBorder bg-newBgColorInner p-[8px] shadow-sm">
        {children}
      </div>
    ) : null}
  </div>
);

const DayStrip = ({
  items,
  today,
}: {
  items: Mention[];
  today: boolean;
}) => {
  const clusters = useMemo(() => {
    const slots = [...items]
      .map((mention) => ({ mention, x: timePercent(mention.createdAt) }))
      .sort((left, right) => left.x - right.x);
    const groups: { x: number; items: Mention[] }[] = [];
    for (const slot of slots) {
      const last = groups[groups.length - 1];
      if (last && Math.abs(slot.x - last.x) < 4) {
        last.items.push(slot.mention);
      } else {
        groups.push({ x: slot.x, items: [slot.mention] });
      }
    }
    return groups;
  }, [items]);
  const now = today ? timePercent(new Date().toISOString()) : null;
  const ticks = [
    { label: '12am', x: 0 },
    { label: '6am', x: 25 },
    { label: '12pm', x: 50 },
    { label: '6pm', x: 75 },
    { label: '12am', x: 100 },
  ];

  return (
    <div className="relative mb-[8px] h-[64px]" aria-hidden>
      <div className="absolute inset-x-0 top-[28px] border-t border-dashed border-newBorder" />
      {ticks.map((tick) => (
        <span
          key={`${tick.label}-${tick.x}`}
          className="absolute top-[36px] -translate-x-1/2 text-[10px] text-textItemBlur"
          style={{ left: `${tick.x}%` }}
        >
          {tick.label}
        </span>
      ))}
      {now !== null ? (
        <span
          className="absolute top-[8px] -translate-x-1/2 rounded-full bg-newTextColor px-[6px] py-[1px] text-[10px] text-newBgColorInner"
          style={{ left: `${now}%` }}
        >
          Now
        </span>
      ) : null}
      {clusters.map((cluster) => {
        const shown = cluster.items.slice(0, 3);
        const extra = cluster.items.length - shown.length;
        return (
          <span
            key={cluster.items[0].id}
            className="absolute top-[14px] flex -translate-x-1/2"
            style={{ left: `${cluster.x}%` }}
          >
            {shown.map((mention, index) => (
              <span
                key={mention.id}
                className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-newBgColorInner bg-newBorder text-[9px] font-[600]"
                style={{ marginLeft: index ? -8 : 0 }}
                title={mention.authorName}
              >
                {initials(mention.authorName)}
              </span>
            ))}
            {extra > 0 ? (
              <span className="-ms-[8px] flex h-[22px] min-w-[22px] items-center justify-center rounded-full border border-newBgColorInner bg-newBgColorInner px-[4px] text-[9px] text-textItemBlur">
                +{extra}
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
};

export const StalkerMentions = () => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const openComposer = useStalkerComposer();
  const { project, projectId } = useStalkerProject();
  const { data: keywordData } = useStalkerKeywords(projectId);
  const { data: viewData, mutate: mutateViews } = useStalkerViews(projectId);
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [date, setDate] = useState('all');
  const [source, setSource] = useState('');
  const [from, setFrom] = useState('');
  const [keywordId, setKeywordId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sentiment, setSentiment] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [q, setQ] = useState('');
  const [match, setMatch] = useState('');
  const [offTopic, setOffTopic] = useState(false);
  const [debouncedQ] = useDebounce(q, 300);
  const [debouncedFrom] = useDebounce(from, 300);
  const [viewName, setViewName] = useState('');
  const [replyId, setReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [markId, setMarkId] = useState<string | null>(null);
  const [extra, setExtra] = useState<Mention[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const search = useMemo(() => {
    const params = new URLSearchParams();
    if (date && date !== 'all') params.set('date', date);
    if (source) params.set('source', source);
    if (debouncedFrom.trim()) params.set('from', debouncedFrom.trim());
    if (keywordId) params.set('keywordId', keywordId);
    if (categoryId) params.set('categoryId', categoryId);
    if (sentiment) params.set('sentiment', sentiment);
    if (statusFilter) params.set('status', statusFilter);
    if (debouncedQ.trim()) params.set('q', debouncedQ.trim());
    if (match) params.set('match', match);
    if (offTopic) params.set('offTopic', 'include');
    return params.toString();
  }, [
    date,
    source,
    debouncedFrom,
    keywordId,
    categoryId,
    sentiment,
    statusFilter,
    debouncedQ,
    match,
    offTopic,
  ]);
  const { data, isLoading, mutate } = useStalkerMentions(projectId, search);
  const searchRef = useRef(search);
  searchRef.current = search;
  const page = data && !Array.isArray(data) ? data : null;
  const firstPage: Mention[] = page?.mentions || (Array.isArray(data) ? data : []);
  const mentions = [...firstPage, ...extra];
  const keywords: Array<{ id: string; phrase: string }> = Array.isArray(keywordData)
    ? keywordData
    : [];
  const views: SavedView[] = Array.isArray(viewData) ? viewData : [];

  useEffect(() => {
    setExtra([]);
    setNextCursor(page?.nextCursor || null);
  }, [page]);

  const groups = useMemo(() => {
    const order: string[] = [];
    const buckets = new Map<string, Mention[]>();
    for (const mention of mentions) {
      const key = dayKey(mention.createdAt);
      if (!buckets.has(key)) {
        order.push(key);
        buckets.set(key, []);
      }
      buckets.get(key)!.push(mention);
    }
    return order.map((key) => {
      const items = buckets.get(key) || [];
      return {
        key,
        label: dayHeading(items[0]?.createdAt),
        items,
      };
    });
  }, [mentions]);

  const setStatus = async (id: string, next: 'NEW' | 'REPLIED' | 'IGNORED') => {
    await fetch(`/stalker/mentions/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status: next }),
    });
    setMarkId(null);
    mutate();
  };

  const copyLink = async (url?: string) => {
    if (!url) {
      toaster.show('This mention has no link', 'warning');
      return;
    }
    await navigator.clipboard.writeText(url);
    toaster.show('Link copied', 'success');
  };

  const openReply = async (mention: Mention) => {
    setReplyId(mention.id);
    setReplyLoading(true);
    setReplyText('');
    const response = await fetch('/stalker/draft', {
      method: 'POST',
      body: JSON.stringify({ mentionId: mention.id, mode: 'post' }),
    });
    const draft = await response.json().catch(() => null);
    setReplyLoading(false);
    setReplyText(draft?.content || mention.text);
  };

  const sendReply = async (mention: Mention) => {
    const response = await fetch(`/stalker/mentions/${mention.id}/reply`, {
      method: 'POST',
      body: JSON.stringify({ text: replyText }),
    });
    if (!response.ok) {
      toaster.show('The reply was not sent. You can still draft a post.', 'warning');
      return;
    }
    toaster.show('Reply sent from the connected account', 'success');
    setReplyId(null);
    mutate();
  };

  const applyView = (filters: SavedView['filters']) => {
    setDate(filters.date || 'all');
    setSource(filters.source || '');
    setFrom(filters.from || '');
    setKeywordId(filters.keywordId || '');
    setCategoryId(filters.categoryId || '');
    setSentiment(filters.sentiment || '');
    setStatusFilter(filters.status || '');
    setQ(filters.q || '');
    setMatch(filters.match || '');
    setOffTopic(filters.offTopic === 'include');
  };

  const saveView = async () => {
    if (!projectId || viewName.trim().length < 2) {
      return;
    }
    const response = await fetch('/stalker/views', {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        name: viewName.trim(),
        filters: {
          date,
          source,
          from,
          keywordId,
          categoryId,
          sentiment,
          status: statusFilter,
          q,
          match,
          ...(offTopic ? { offTopic: 'include' } : {}),
        },
      }),
    });
    if (!response.ok) {
      toaster.show('Could not save that view', 'warning');
      return;
    }
    setViewName('');
    mutateViews();
  };

  const loadMore = async () => {
    if (!projectId || !nextCursor) {
      return;
    }
    const snapshot = search;
    const cursor = nextCursor;
    setLoadingMore(true);
    const params = new URLSearchParams(snapshot);
    params.set('projectId', projectId);
    params.set('cursor', cursor);
    const response = await fetch(`/stalker/mentions?${params.toString()}`);
    const payload = await response.json().catch(() => null);
    setLoadingMore(false);
    if (searchRef.current !== snapshot) {
      return;
    }
    const rows: Mention[] = payload?.mentions || [];
    setExtra((current) => [...current, ...rows]);
    setNextCursor(payload?.nextCursor || null);
  };

  const exportCsv = async () => {
    if (!projectId) {
      return;
    }
    const params = new URLSearchParams(search);
    params.set('projectId', projectId);
    const response = await fetch(`/stalker/export?${params.toString()}`);
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.csv) {
      toaster.show('Could not export these mentions', 'warning');
      return;
    }
    const blob = new Blob([payload.csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = payload.filename || 'stalker-mentions.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggle = (id: string) => setOpenFilter((current) => (current === id ? null : id));
  const categories = project?.categories || [];
  const keywordPhrase = keywords.find((keyword) => keyword.id === keywordId)?.phrase;
  const categoryName = categories.find((category) => category.id === categoryId)?.name;
  const dateLabel =
    date === '24h' ? '24h' : date === '7d' ? '7d' : date === '30d' ? '30d' : '';
  const sourceLabel = SOURCE_OPTIONS.find((option) => option.id === source)?.label;
  const filtersActive = Boolean(search);

  const fieldClass =
    'w-full rounded-[8px] border border-newBorder bg-newBgColorInner px-[8px] py-[6px] text-[13px] outline-none';

  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-[12px]">
        <h1 className="text-[22px] font-[600]">{t('stalker_mentions', 'Mentions')}</h1>
        <input
          aria-label="Search mentions"
          className="w-full rounded-full border border-newBorder bg-newBgColorInner px-[12px] py-[7px] text-[13px] outline-none sm:w-[240px]"
          placeholder="Search text or author"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
      </div>
      {openFilter ? (
        <button
          type="button"
          aria-label="Close filters"
          className="fixed inset-0 z-10 cursor-default"
          onClick={() => setOpenFilter(null)}
        />
      ) : null}
      <div className="relative z-20 flex flex-wrap gap-[8px]">
        <Chip label="Date" active={dateLabel} open={openFilter === 'date'} onClick={() => toggle('date')} onClear={() => setDate('all')}>
          {['all', '24h', '7d', '30d'].map((value) => (
            <button
              key={value}
              type="button"
              className="block w-full rounded-[8px] px-[8px] py-[6px] text-start text-[13px] hover:bg-[#00D9FF]/10"
              onClick={() => {
                setDate(value);
                setOpenFilter(null);
              }}
            >
              {value === 'all' ? 'Any time' : value === '24h' ? 'Last 24 hours' : value === '7d' ? 'Last 7 days' : 'Last 30 days'}
            </button>
          ))}
        </Chip>
        <Chip label="Source" active={sourceLabel} open={openFilter === 'source'} onClick={() => toggle('source')} onClear={() => setSource('')}>
          <button type="button" className="block w-full rounded-[8px] px-[8px] py-[6px] text-start text-[13px]" onClick={() => { setSource(''); setOpenFilter(null); }}>All sources</button>
          {SOURCE_OPTIONS.map((option) => (
            <button key={option.id} type="button" className="flex w-full items-center gap-[6px] rounded-[8px] px-[8px] py-[6px] text-start text-[13px] hover:bg-[#00D9FF]/10" onClick={() => { setSource(option.id); setOpenFilter(null); }}>
              <SourceIcon source={option.id} />
              {option.label}
            </button>
          ))}
        </Chip>
        <Chip label="From" active={from.trim() || undefined} open={openFilter === 'from'} onClick={() => toggle('from')} onClear={() => setFrom('')}>
          <input aria-label="From" className={fieldClass} placeholder="Author name" value={from} onChange={(event) => setFrom(event.target.value)} />
        </Chip>
        <Chip label="Keywords" active={keywordPhrase} open={openFilter === 'keywords'} onClick={() => toggle('keywords')} onClear={() => setKeywordId('')}>
          <button type="button" className="block w-full rounded-[8px] px-[8px] py-[6px] text-start text-[13px]" onClick={() => { setKeywordId(''); setOpenFilter(null); }}>All keywords</button>
          {keywords.map((keyword) => (
            <button key={keyword.id} type="button" className="block w-full rounded-[8px] px-[8px] py-[6px] text-start text-[13px] hover:bg-[#00D9FF]/10" onClick={() => { setKeywordId(keyword.id); setOpenFilter(null); }}>{keyword.phrase}</button>
          ))}
        </Chip>
        <Chip label="Category" active={categoryName} open={openFilter === 'category'} onClick={() => toggle('category')} onClear={() => setCategoryId('')}>
          <button type="button" className="block w-full rounded-[8px] px-[8px] py-[6px] text-start text-[13px]" onClick={() => { setCategoryId(''); setOpenFilter(null); }}>All categories</button>
          {categories.map((category) => (
            <button key={category.id} type="button" className="block w-full rounded-[8px] px-[8px] py-[6px] text-start text-[13px] hover:bg-[#00D9FF]/10" onClick={() => { setCategoryId(category.id); setOpenFilter(null); }}>{category.name}</button>
          ))}
        </Chip>
        <Chip label="Sentiment" active={sentiment ? sentimentLabel(sentiment) : undefined} open={openFilter === 'sentiment'} onClick={() => toggle('sentiment')} onClear={() => setSentiment('')}>
          {['', 'POSITIVE', 'NEUTRAL', 'NEGATIVE'].map((value) => (
            <button key={value || 'all'} type="button" className="block w-full rounded-[8px] px-[8px] py-[6px] text-start text-[13px] hover:bg-[#00D9FF]/10" onClick={() => { setSentiment(value); setOpenFilter(null); }}>{value ? sentimentLabel(value) : 'All sentiments'}</button>
          ))}
        </Chip>
        <Chip label="Status" active={statusFilter ? labelOf(statusFilter) : undefined} open={openFilter === 'status'} onClick={() => toggle('status')} onClear={() => setStatusFilter('')}>
          {['', 'NEW', 'REPLIED', 'IGNORED'].map((value) => (
            <button key={value || 'all'} type="button" className="block w-full rounded-[8px] px-[8px] py-[6px] text-start text-[13px] hover:bg-[#00D9FF]/10" onClick={() => { setStatusFilter(value); setOpenFilter(null); }}>{value ? labelOf(value) : 'All statuses'}</button>
          ))}
        </Chip>
        <button type="button" className="text-[12px] text-textItemBlur underline" onClick={() => setOffTopic((current) => !current)}>
          {offTopic ? 'Showing off-topic' : '+ Off-topic'}
        </button>
        <button type="button" className="text-[12px] text-[#00D9FF]" onClick={exportCsv}>Export CSV</button>
      </div>
      <div className="flex flex-wrap items-center gap-[8px]">
        <select aria-label="Matched by" className={fieldClass + ' w-auto'} value={match} onChange={(event) => setMatch(event.target.value)}>
          <option value="">Matched by</option>
          <option value="BRAND">Brand</option>
          <option value="ALIAS">Alias</option>
          <option value="HANDLE">Handle</option>
          <option value="KEYWORD">Keyword</option>
        </select>
        {views.map((view) => (
          <span key={view.id} className="inline-flex items-center gap-[4px]">
            <button type="button" className="rounded-full border border-newBorder px-[10px] py-[4px] text-[12px]" onClick={() => applyView(view.filters || {})}>{view.name}</button>
            <button type="button" className="text-[12px] text-textItemBlur" aria-label={`Delete ${view.name}`} onClick={async () => { await fetch(`/stalker/views/${view.id}`, { method: 'DELETE' }); mutateViews(); }}>×</button>
          </span>
        ))}
        <input aria-label="View name" className={fieldClass + ' w-auto'} placeholder="Save this view" value={viewName} onChange={(event) => setViewName(event.target.value)} />
        <button type="button" className="text-[13px] text-[#00D9FF]" onClick={saveView}>Save view</button>
      </div>
      {isLoading && !mentions.length ? (
        <div className="flex flex-col gap-[12px]" aria-hidden>
          <div className="h-[18px] w-[160px] animate-pulse rounded bg-newBorder" />
          <div className="h-[120px] animate-pulse rounded-[16px] border border-newBorder" />
          <div className="h-[120px] animate-pulse rounded-[16px] border border-newBorder" />
        </div>
      ) : null}
      {!isLoading && !mentions.length ? (
        <p className="text-[14px] text-textItemBlur">
          {filtersActive
            ? 'No mentions match these filters.'
            : `No mentions yet. Stalker is listening for mentions of ${project?.name || 'this project'}.`}
        </p>
      ) : null}
      <div className="flex flex-col gap-[22px]">
        {groups.map((group) => (
          <section key={group.key} className="flex flex-col gap-[12px]">
            <h2 className="text-[12px] font-[600] tracking-[0.04em] text-textItemBlur">
              {group.label} · {group.items.length} mention{group.items.length === 1 ? '' : 's'}
            </h2>
            <DayStrip items={group.items} today={group.label === 'TODAY'} />
            {group.items.map((mention) => {
              const category = mention.categoryDef?.name || labelOf(mention.category || 'OTHER');
              const phrase = mention.keyword?.phrase || mention.matchLabel;
              const replyLine = (mention.source || '').includes('COMMENT');
              return (
                <div key={mention.id} className="flex flex-col gap-[8px] sm:flex-row sm:items-start">
                  <article className="min-w-0 flex-1 rounded-[16px] border border-newBorder bg-newBgColorInner p-[14px]">
                    <div className="flex items-start gap-[10px]">
                      <span className="relative flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-newBorder text-[12px] font-[600]">
                        {initials(mention.authorName)}
                        <span className="absolute -bottom-[2px] -end-[2px] flex h-[16px] w-[16px] items-center justify-center rounded-full border border-newBgColorInner bg-newBgColorInner text-textItemBlur">
                          <SourceIcon source={mention.source || ''} className="h-[10px] w-[10px]" />
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-[6px] text-[13px]">
                          <span className="font-[600]">{mention.authorName || 'Someone'}</span>
                          {mention.authorHandle ? (
                            <span className="text-textItemBlur">@{mention.authorHandle.replace(/^@/, '')}</span>
                          ) : null}
                          <span className="text-textItemBlur">{relativeTime(mention.createdAt)}</span>
                        </div>
                        {replyLine ? (
                          <p className="mt-[2px] text-[12px] text-textItemBlur">Replying to a post</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-[4px]">
                        <span className="rounded-full border border-[#3DDC97]/40 px-[8px] py-[2px] text-[11px] text-[#1f8f5f] dark:text-[#3DDC97]">{category}</span>
                        <span className={clsx(
                          'rounded-full px-[8px] py-[2px] text-[11px]',
                          mention.sentiment === 'NEGATIVE'
                            ? 'bg-[#FF6B6B]/15 text-[#FF6B6B]'
                            : mention.sentiment === 'POSITIVE'
                              ? 'bg-[#3DDC97]/15 text-[#1f8f5f] dark:text-[#3DDC97]'
                              : 'bg-newBorder text-textItemBlur'
                        )}>
                          {sentimentLabel(mention.sentiment)}
                        </span>
                      </div>
                    </div>
                    <p className="mt-[10px] whitespace-pre-wrap text-[14px] leading-[1.5]">
                      {highlight(mention.text, phrase)}
                    </p>
                    <div className="mt-[10px] flex gap-[14px] text-[12px] text-textItemBlur">
                      <span>{mention.likeCount || 0} likes</span>
                      <span>{mention.replyCount || 0} replies</span>
                    </div>
                    <div className="mt-[10px] flex flex-wrap gap-[8px] text-[12px]">
                      <button type="button" className="text-[#00D9FF]" onClick={() => openReply(mention)}>Reply</button>
                      <button type="button" className="text-textItemBlur" onClick={() => openComposer({ mentionId: mention.id, mode: 'post' })}>Draft post</button>
                    </div>
                    {replyId === mention.id ? (
                      <div className="mt-[10px] flex flex-col gap-[8px] rounded-[12px] border border-newBorder p-[12px]">
                        <p className="text-[12px] text-textItemBlur">Review the suggested reply. Nothing is sent until you click Send.</p>
                        <textarea className="min-h-[88px] rounded-[10px] border border-newBorder bg-newBgColorInner px-[12px] py-[10px] text-[14px]" value={replyText} onChange={(event) => setReplyText(event.target.value)} />
                        <div className="flex gap-[8px]">
                          <Button type="button" disabled={replyLoading || replyText.trim().length < 1} onClick={() => sendReply(mention)}>Send reply</Button>
                          <Button type="button" secondary onClick={() => setReplyId(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                  <div className="flex shrink-0 gap-[12px] text-[13px] text-textItemBlur sm:w-[108px] sm:flex-col sm:pt-[8px]">
                    {mention.url ? (
                      <a className="hover:text-newTextColor" href={mention.url} target="_blank" rel="noreferrer">Open</a>
                    ) : (
                      <span className="opacity-40">Open</span>
                    )}
                    <button type="button" className="text-start hover:text-newTextColor" onClick={() => copyLink(mention.url)}>Copy link</button>
                    <div className="relative">
                      <button type="button" className="text-start hover:text-newTextColor" onClick={() => setMarkId((current) => current === mention.id ? null : mention.id)}>Mark as…</button>
                      {markId === mention.id ? (
                        <div className="absolute end-0 z-20 mt-[4px] min-w-[120px] rounded-[10px] border border-newBorder bg-newBgColorInner p-[4px] shadow-sm sm:start-0">
                          {(['NEW', 'REPLIED', 'IGNORED'] as const).map((status) => (
                            <button key={status} type="button" className="block w-full rounded-[8px] px-[8px] py-[6px] text-start text-[12px] hover:bg-[#00D9FF]/10" onClick={() => setStatus(mention.id, status)}>{labelOf(status)}</button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </div>
      {nextCursor ? (
        <button type="button" className="self-start text-[13px] text-[#00D9FF]" disabled={loadingMore} onClick={loadMore}>
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      ) : null}
    </div>
  );
};
