'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Button } from '@gitroom/react/form/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import {
  useStalkerAnalytics,
  useStalkerKeywords,
  useStalkerMentions,
  useStalkerViews,
} from '@gitroom/frontend/components/stalker/stalker.hooks';
import { useStalkerComposer } from '@gitroom/frontend/components/stalker/use.stalker.composer';
import { useStalkerProject } from '@gitroom/frontend/components/stalker/stalker.project';
import { SourceIcon } from '@gitroom/frontend/components/stalker/stalker.icons';

const SOURCE_CHIPS = [
  { id: '', label: 'All' },
  { id: 'YOUTUBE_SEARCH', label: 'YouTube' },
  { id: 'REDDIT', label: 'Reddit' },
  { id: 'X', label: 'X' },
  { id: 'LINKEDIN', label: 'LinkedIn' },
  { id: 'YOUTUBE_COMMENT', label: 'YouTube comments' },
  { id: 'INSTAGRAM_COMMENT', label: 'Instagram' },
  { id: 'FACEBOOK_COMMENT', label: 'Facebook' },
];

const selectClass =
  'bg-[#141414] border border-[#2a2a2a] rounded-[10px] px-[12px] py-[8px] text-[13px]';

const labelOf = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const sentimentClass = (sentiment?: string) => {
  if (sentiment === 'POSITIVE') return 'bg-[#3DDC97]/15 text-[#3DDC97]';
  if (sentiment === 'NEGATIVE') return 'bg-[#FF6B6B]/15 text-[#FF6B6B]';
  return 'bg-[#E8E8E8]/10 text-[#E8E8E8]';
};

const categoryClass = (name: string) => {
  const value = name.toLowerCase();
  if (value.includes('bug') || value.includes('complain')) {
    return 'bg-[#FF6B6B]/15 text-[#FF6B6B]';
  }
  if (value.includes('praise') || value.includes('testimonial')) {
    return 'bg-[#3DDC97]/15 text-[#3DDC97]';
  }
  if (value.includes('feature') || value.includes('idea')) {
    return 'bg-[#7C5CFF]/15 text-[#7C5CFF]';
  }
  return 'bg-[#00D9FF]/15 text-[#00D9FF]';
};

const dayLabel = (iso?: string) => {
  if (!iso) return 'Earlier';
  const date = new Date(iso);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const diff = start.getTime() - day.getTime();
  if (diff === 0) return 'Today';
  if (diff === 24 * 60 * 60 * 1000) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const initials = (name?: string) => {
  const parts = (name || '?').trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || '?';
};

const domainsOf = (text: string) => {
  const found = text.match(/https?:\/\/[^\s)]+/g) || [];
  const names = found.map((value) => {
    try {
      return new URL(value).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  });
  return [...new Set(names.filter(Boolean))].slice(0, 4);
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
  };
};

export const StalkerMentions = () => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const openComposer = useStalkerComposer();
  const { project, projectId } = useStalkerProject();
  const { data: keywordData } = useStalkerKeywords(projectId);
  const { data: analytics } = useStalkerAnalytics(projectId, '30d');
  const { data: viewData, mutate: mutateViews } = useStalkerViews(projectId);
  const [date, setDate] = useState('all');
  const [source, setSource] = useState('');
  const [from, setFrom] = useState('');
  const [keywordId, setKeywordId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sentiment, setSentiment] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [q, setQ] = useState('');
  const [match, setMatch] = useState('');
  const [viewName, setViewName] = useState('');
  const [replyId, setReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const search = useMemo(() => {
    const params = new URLSearchParams();
    if (date && date !== 'all') params.set('date', date);
    if (source) params.set('source', source);
    if (from.trim()) params.set('from', from.trim());
    if (keywordId) params.set('keywordId', keywordId);
    if (categoryId) params.set('categoryId', categoryId);
    if (sentiment) params.set('sentiment', sentiment);
    if (statusFilter) params.set('status', statusFilter);
    if (q.trim()) params.set('q', q.trim());
    if (match) params.set('match', match);
    return params.toString();
  }, [
    date,
    source,
    from,
    keywordId,
    categoryId,
    sentiment,
    statusFilter,
    q,
    match,
  ]);
  const { data, isLoading, mutate } = useStalkerMentions(projectId, search);
  const mentions: Mention[] = Array.isArray(data) ? data : [];
  const keywords: Array<{ id: string; phrase: string }> = Array.isArray(
    keywordData
  )
    ? keywordData
    : [];
  const views: SavedView[] = Array.isArray(viewData) ? viewData : [];
  const timeline = Array.isArray(analytics?.overTime) ? analytics.overTime : [];
  const timelineMax = Math.max(
    1,
    ...timeline.map((row: { count: number }) => row.count)
  );

  const groups = useMemo(() => {
    const order: string[] = [];
    const buckets = new Map<string, Mention[]>();
    for (const mention of mentions) {
      const label = dayLabel(mention.createdAt);
      if (!buckets.has(label)) {
        order.push(label);
        buckets.set(label, []);
      }
      buckets.get(label)!.push(mention);
    }
    return order.map((label) => ({
      label,
      items: buckets.get(label) || [],
    }));
  }, [mentions]);

  const setStatus = async (id: string, next: 'NEW' | 'REPLIED' | 'IGNORED') => {
    await fetch(`/stalker/mentions/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status: next }),
    });
    mutate();
  };

  const saveMention = async (
    id: string,
    saved: boolean,
    as?: 'testimonial' | 'idea'
  ) => {
    await fetch(`/stalker/mentions/${id}/save`, {
      method: 'POST',
      body: JSON.stringify({ saved, as }),
    });
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
      toaster.show(
        'The reply was not sent. You can still draft a post.',
        'warning'
      );
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

  const filtersActive = Boolean(search);
  const categories = project?.categories || [];

  return (
    <div className="flex flex-col gap-[16px]">
      <div>
        <h1 className="text-[28px] font-[600]">
          {t('stalker_mentions', 'Mentions')}
        </h1>
        <p className="mt-[6px] text-[14px] text-textItemBlur">
          Public matches and comments from connected accounts for{' '}
          {project?.name || 'this project'}.
        </p>
      </div>
      {timeline.length ? (
        <div className="flex h-[46px] items-end gap-[3px]" aria-label="Activity">
          {timeline.slice(-30).map((row: { date: string; count: number }) => (
            <span
              key={row.date}
              title={`${row.date}: ${row.count}`}
              className="w-[8px] rounded-t-[3px] bg-[#00D9FF]"
              style={{
                height: `${Math.max(4, Math.round((row.count / timelineMax) * 46))}px`,
              }}
            />
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-[8px]">
        {SOURCE_CHIPS.map((chip) => (
          <button
            key={chip.id || 'all'}
            type="button"
            className={clsx(
              'inline-flex items-center gap-[6px] rounded-full border px-[10px] py-[5px] text-[12px]',
              source === chip.id
                ? 'border-[#00D9FF]/50 bg-[#00D9FF]/15 text-[#00D9FF]'
                : 'border-[#2a2a2a] text-textItemBlur'
            )}
            onClick={() => setSource(chip.id)}
          >
            {chip.id ? <SourceIcon source={chip.id} /> : null}
            {chip.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-[8px]">
        <input
          aria-label="Search mentions"
          className={selectClass}
          placeholder="Search text or author"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
        <select
          aria-label="Date"
          className={selectClass}
          value={date}
          onChange={(event) => setDate(event.target.value)}
        >
          <option value="all">All dates</option>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
        <input
          aria-label="From"
          className={selectClass}
          placeholder="From"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
        <select
          aria-label="Keywords"
          className={selectClass}
          value={keywordId}
          onChange={(event) => setKeywordId(event.target.value)}
        >
          <option value="">All keywords</option>
          {keywords.map((keyword) => (
            <option key={keyword.id} value={keyword.id}>
              {keyword.phrase}
            </option>
          ))}
        </select>
        <select
          aria-label="Category"
          className={selectClass}
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Sentiment"
          className={selectClass}
          value={sentiment}
          onChange={(event) => setSentiment(event.target.value)}
        >
          <option value="">All sentiments</option>
          <option value="POSITIVE">Positive</option>
          <option value="NEUTRAL">Neutral</option>
          <option value="NEGATIVE">Negative</option>
        </select>
        <select
          aria-label="Status"
          className={selectClass}
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="">All statuses</option>
          <option value="NEW">New</option>
          <option value="REPLIED">Replied</option>
          <option value="IGNORED">Ignored</option>
        </select>
        <select
          aria-label="Matched by"
          className={selectClass}
          value={match}
          onChange={(event) => setMatch(event.target.value)}
        >
          <option value="">Matched by</option>
          <option value="BRAND">Brand</option>
          <option value="ALIAS">Alias</option>
          <option value="HANDLE">Handle</option>
          <option value="KEYWORD">Keyword</option>
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-[8px]">
        {views.map((view) => (
          <span key={view.id} className="inline-flex items-center gap-[4px]">
            <button
              type="button"
              className="rounded-full border border-[#7C5CFF]/40 px-[10px] py-[4px] text-[12px] text-[#7C5CFF]"
              onClick={() => applyView(view.filters || {})}
            >
              {view.name}
            </button>
            <button
              type="button"
              className="text-[12px] text-textItemBlur"
              aria-label={`Delete ${view.name}`}
              onClick={async () => {
                await fetch(`/stalker/views/${view.id}`, { method: 'DELETE' });
                mutateViews();
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          aria-label="View name"
          className={selectClass}
          placeholder="Save this view"
          value={viewName}
          onChange={(event) => setViewName(event.target.value)}
        />
        <button
          type="button"
          className="text-[13px] text-[#00D9FF] underline"
          onClick={saveView}
        >
          Save view
        </button>
      </div>
      {isLoading ? (
        <p className="text-[14px] text-textItemBlur">Loading mentions…</p>
      ) : null}
      {!isLoading && !mentions.length ? (
        <p className="text-[14px] text-textItemBlur">
          {filtersActive
            ? 'No mentions match these filters.'
            : `No mentions yet. Stalker is listening for mentions of ${
                project?.name || 'this project'
              }`}
        </p>
      ) : null}
      <div className="flex flex-col gap-[18px]">
        {groups.map((group) => (
          <section key={group.label} className="flex flex-col gap-[12px]">
            <h2 className="text-[13px] font-[600] text-textItemBlur">
              {group.label} · {group.items.length} mention
              {group.items.length === 1 ? '' : 's'}
            </h2>
            {group.items.map((mention) => {
              const categoryName =
                mention.categoryDef?.name || labelOf(mention.category || 'OTHER');
              const domains = domainsOf(mention.text);
              return (
                <article
                  key={mention.id}
                  className="flex flex-col gap-[10px] rounded-[16px] border border-newBorder bg-newBgColorInner p-[16px]"
                >
                  <div className="flex items-start gap-[10px]">
                    <span className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full bg-[#1c1c1c] text-[12px] font-[600] text-[#00D9FF]">
                      {initials(mention.authorName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-[8px] text-[13px]">
                        <span className="font-[600]">
                          {mention.authorName || 'Someone'}
                        </span>
                        {mention.authorHandle ? (
                          <span className="text-textItemBlur">
                            @{mention.authorHandle.replace(/^@/, '')}
                          </span>
                        ) : null}
                        <span className="inline-flex items-center gap-[4px] text-textItemBlur">
                          <SourceIcon source={mention.source || ''} />
                          {labelOf(mention.source || '')}
                        </span>
                        <span className="text-textItemBlur">
                          {mention.createdAt
                            ? new Date(mention.createdAt).toLocaleString()
                            : ''}
                        </span>
                      </div>
                      <div className="mt-[8px] flex flex-wrap items-center gap-[6px] text-[12px]">
                        <span
                          className={clsx(
                            'rounded-full px-[8px] py-[3px]',
                            categoryClass(categoryName)
                          )}
                        >
                          {categoryName}
                        </span>
                        <span
                          className={clsx(
                            'rounded-full px-[8px] py-[3px]',
                            sentimentClass(mention.sentiment)
                          )}
                        >
                          {(mention.sentiment || 'neutral').toLowerCase()}
                        </span>
                        {mention.matchLabel ? (
                          <span className="rounded-full border border-[#FFB020]/40 px-[8px] py-[3px] text-[#FFB020]">
                            {labelOf(mention.matchKind || 'match')}: {mention.matchLabel}
                          </span>
                        ) : null}
                        {mention.saved ? (
                          <span className="text-[#3DDC97]">Saved</span>
                        ) : null}
                        <span
                          className={clsx(
                            'ms-auto font-[600]',
                            mention.urgency >= 70
                              ? 'text-[#FF6B6B]'
                              : 'text-textItemBlur'
                          )}
                        >
                          {mention.urgency}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap text-[15px] leading-[1.5]">
                    {mention.text}
                  </p>
                  <div className="flex flex-wrap gap-[10px] text-[12px] text-textItemBlur">
                    {mention.likeCount ? <span>{mention.likeCount} likes</span> : null}
                    {mention.replyCount ? (
                      <span>{mention.replyCount} replies</span>
                    ) : null}
                    {domains.map((domain) => (
                      <span key={domain} className="text-[#00D9FF]">
                        {domain}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-[8px] text-[12px]">
                    {mention.url ? (
                      <a
                        className="rounded-full border border-[#2a2a2a] px-[8px] py-[3px] underline"
                        href={mention.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open
                      </a>
                    ) : null}
                    <button
                      type="button"
                      className="rounded-full border border-[#2a2a2a] px-[8px] py-[3px]"
                      onClick={() => copyLink(mention.url)}
                    >
                      Copy link
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-[#2a2a2a] px-[8px] py-[3px]"
                      onClick={() => setStatus(mention.id, 'REPLIED')}
                    >
                      Mark replied
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-[#2a2a2a] px-[8px] py-[3px]"
                      onClick={() => setStatus(mention.id, 'IGNORED')}
                    >
                      Ignore
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-[#2a2a2a] px-[8px] py-[3px]"
                      onClick={() => saveMention(mention.id, !mention.saved)}
                    >
                      {mention.saved ? 'Unsave' : 'Save'}
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-[#3DDC97]/40 px-[8px] py-[3px] text-[#3DDC97]"
                      onClick={() => saveMention(mention.id, true, 'testimonial')}
                    >
                      Save testimonial
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-[#7C5CFF]/40 px-[8px] py-[3px] text-[#7C5CFF]"
                      onClick={() => saveMention(mention.id, true, 'idea')}
                    >
                      Save idea
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-[#00D9FF]/40 px-[8px] py-[3px] text-[#00D9FF]"
                      onClick={() => openReply(mention)}
                    >
                      Reply
                    </button>
                    <Button
                      type="button"
                      secondary
                      onClick={() =>
                        openComposer({ mentionId: mention.id, mode: 'post' })
                      }
                    >
                      Draft post
                    </Button>
                  </div>
                  {replyId === mention.id ? (
                    <div className="flex flex-col gap-[8px] rounded-[12px] border border-[#2a2a2a] p-[12px]">
                      <p className="text-[12px] text-textItemBlur">
                        Review the suggested reply. Send posts it from the
                        connected account. Nothing is sent until you click Send.
                      </p>
                      <textarea
                        className="min-h-[88px] rounded-[10px] border border-[#2a2a2a] bg-[#141414] px-[12px] py-[10px] text-[14px]"
                        value={replyText}
                        onChange={(event) => setReplyText(event.target.value)}
                      />
                      <div className="flex gap-[8px]">
                        <Button
                          type="button"
                          disabled={replyLoading || replyText.trim().length < 1}
                          onClick={() => sendReply(mention)}
                        >
                          Send reply
                        </Button>
                        <Button
                          type="button"
                          secondary
                          onClick={() => setReplyId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
};
