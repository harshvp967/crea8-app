'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import {
  useStalkerAuthors,
  useStalkerKeywords,
  useStalkerMentions,
  useStalkerViews,
} from '@gitroom/frontend/components/stalker/stalker.hooks';
import { useStalkerProject } from '@gitroom/frontend/components/stalker/stalker.project';
import { SourceIcon } from '@gitroom/frontend/components/stalker/stalker.icons';
import { StalkerCheckNow } from '@gitroom/frontend/components/stalker/stalker.check';
import { authorUrl, cleanMention } from '@gitroom/frontend/components/stalker/stalker.labels';
import {
  emptyFilters,
  filtersActive,
  filtersToSearch,
  filtersToView,
  MentionFilters,
  StalkerFilters,
  viewToFilters,
} from '@gitroom/frontend/components/stalker/stalker.filters';
import {
  SAMPLE_AUTHORS,
  SAMPLE_KEYWORDS,
  SAMPLE_MENTIONS,
  SAMPLE_VIEWS,
} from '@gitroom/frontend/components/stalker/stalker.sample';

type Mention = {
  id: string;
  createdAt?: string;
  source?: string;
  authorName?: string;
  authorHandle?: string;
  text: string;
  url?: string | null;
  likeCount?: number;
  replyCount?: number;
  sentiment?: string;
  status?: string;
  relevant?: boolean;
  keyword?: { phrase?: string } | null;
  categoryDef?: { id: string; name: string } | null;
};

const initials = (name?: string) =>
  (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';

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
  if (diff === 86400000) return 'YESTERDAY';
  return date
    .toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    .toUpperCase();
};

const relativeTime = (iso?: string) => {
  if (!iso) return '';
  const date = new Date(iso);
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `today at ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const exactTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString() : '';

const highlight = (text: string, phrase?: string) => {
  const parts: Array<string | { link: string }> = [];
  const pattern = /(https?:\/\/[^\s]+|#\w+)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index || 0;
    if (index > last) parts.push(text.slice(last, index));
    parts.push({ link: match[0] });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  const needle = (phrase || '').trim();
  return parts.map((part, index) => {
    if (typeof part !== 'string') {
      const href = part.link.startsWith('#')
        ? `https://x.com/hashtag/${part.link.slice(1)}`
        : part.link;
      return (
        <a key={index} href={href} className="text-[#00A3C4] underline" target="_blank" rel="noreferrer">
          {part.link}
        </a>
      );
    }
    if (needle.length < 2) return <span key={index}>{part}</span>;
    const at = part.toLowerCase().indexOf(needle.toLowerCase());
    if (at < 0) return <span key={index}>{part}</span>;
    return (
      <span key={index}>
        {part.slice(0, at)}
        <span className="rounded-[6px] bg-[#00D9FF]/15 px-[4px]">
          {part.slice(at, at + needle.length)}
        </span>
        {part.slice(at + needle.length)}
      </span>
    );
  });
};

const statusLabel = (status?: string) => {
  if (status === 'DONE' || status === 'REPLIED') return 'Done';
  if (status === 'FOLLOW_UP') return 'Follow up';
  if (status === 'IGNORED') return 'Irrelevant';
  return '';
};

export const StalkerMentions = () => {
  const fetch = useFetch();
  const toaster = useToaster();
  const { project, projectId, sample } = useStalkerProject();
  const [filters, setFilters] = useState<MentionFilters>(emptyFilters());
  const [barHidden, setBarHidden] = useState(false);
  const [viewName, setViewName] = useState('');
  const [naming, setNaming] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [extra, setExtra] = useState<Mention[]>([]);
  const search = filtersToSearch(filters);
  const mentionsQuery = useStalkerMentions(sample ? null : projectId, search);
  const mentionsReady = sample || !!mentionsQuery.data || mentionsQuery.error;
  const keywordsQuery = useStalkerKeywords(sample ? null : projectId);
  const authorsQuery = useStalkerAuthors(
    !sample && projectId && mentionsReady ? projectId : null
  );
  // Saved views are secondary: load them after the first mentions page, not in the first-paint burst.
  const viewsQuery = useStalkerViews(
    !sample && projectId && mentionsReady ? projectId : null
  );
  const page = sample ? SAMPLE_MENTIONS : mentionsQuery.data;
  const mentions = useMemo<Mention[]>(
    () => [
      ...(Array.isArray(page?.mentions) ? page.mentions : []),
      ...extra,
    ],
    [page, extra]
  );
  const keywords = sample
    ? SAMPLE_KEYWORDS
    : Array.isArray(keywordsQuery.data)
      ? keywordsQuery.data
      : [];
  const authors = sample
    ? SAMPLE_AUTHORS
    : Array.isArray(authorsQuery.data)
      ? authorsQuery.data
      : [];
  const views = sample ? SAMPLE_VIEWS : Array.isArray(viewsQuery.data) ? viewsQuery.data : [];
  const dirty = filtersActive(filters, emptyFilters());

  const queryKey = `${projectId || ''}|${search}`;
  const [loadedKey, setLoadedKey] = useState(queryKey);
  if (loadedKey !== queryKey) {
    setLoadedKey(queryKey);
    setExtra([]);
    setBarHidden(false);
  }

  const groups = useMemo(() => {
    const family = (source?: string) => {
      if (!source) return '';
      if (source.startsWith('X')) return 'X';
      if (source.startsWith('REDDIT')) return 'REDDIT';
      if (source.startsWith('YOUTUBE')) return 'YOUTUBE';
      if (source.startsWith('LINKEDIN')) return 'LINKEDIN';
      return source;
    };
    const rows = sample
      ? mentions.filter((mention) => {
          if (filters.sentiment && mention.sentiment !== filters.sentiment) return false;
          if (filters.status === 'NEW' && mention.status && mention.status !== 'NEW') return false;
          if (filters.status === 'DONE' && mention.status !== 'DONE' && mention.status !== 'REPLIED') {
            return false;
          }
          if (filters.status === 'FOLLOW_UP' && mention.status !== 'FOLLOW_UP') return false;
          if (filters.sources.length && !filters.sources.includes(family(mention.source))) {
            return false;
          }
          if (filters.from) {
            const blob = `${mention.authorName || ''} ${mention.authorHandle || ''}`.toLowerCase();
            if (!blob.includes(filters.from.replace(/^@/, '').toLowerCase())) return false;
          }
          if (filters.categoryId === 'none' && mention.categoryDef) return false;
          if (
            filters.categoryId &&
            filters.categoryId !== 'none' &&
            mention.categoryDef?.id !== filters.categoryId
          ) {
            return false;
          }
          return true;
        })
      : mentions;
    const bag = new Map<string, Mention[]>();
    for (const mention of rows) {
      const key = dayKey(mention.createdAt);
      bag.set(key, [...(bag.get(key) || []), mention]);
    }
    return [...bag.entries()];
  }, [mentions, sample, filters]);

  const setStatus = async (id: string, status: string) => {
    setMarking(null);
    if (sample) {
      toaster.show('Updated');
      return;
    }
    const response = await fetch(`/stalker/mentions/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      toaster.show('Could not update the mention', 'warning');
      return;
    }
    mentionsQuery.mutate();
  };

  const setRelevant = async (id: string, relevant: boolean) => {
    setMarking(null);
    if (sample) {
      toaster.show('Updated');
      return;
    }
    const response = await fetch(`/stalker/mentions/${id}/relevant`, {
      method: 'POST',
      body: JSON.stringify({ relevant }),
    });
    if (!response.ok) {
      toaster.show('Could not update the mention', 'warning');
      return;
    }
    setExtra((current) =>
      current.map((row) => (row.id === id ? { ...row, relevant } : row))
    );
    toaster.show(relevant ? 'Marked relevant' : 'Marked off-topic');
    mentionsQuery.mutate();
  };

  const hiddenOffTopic = sample ? 0 : Number(page?.hiddenOffTopic || 0);

  const saveView = async () => {
    const name = viewName.trim();
    if (name.length < 2 || !projectId) return;
    if (sample) {
      toaster.show('View saved');
      setNaming(false);
      setBarHidden(true);
      return;
    }
    const response = await fetch('/stalker/views', {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        name,
        filters: filtersToView(filters),
      }),
    });
    if (!response.ok) {
      toaster.show('Could not save that view', 'warning');
      return;
    }
    viewsQuery.mutate();
    setNaming(false);
    setViewName('');
    setBarHidden(true);
    toaster.show('View saved');
  };

  return (
    <div className="relative flex min-h-full flex-col gap-[16px] p-[16px] md:p-[24px]">
      <div className="flex flex-wrap items-center justify-between gap-[12px]">
        <h1 className="text-[28px] font-[600]">Mentions</h1>
        <StalkerCheckNow />
      </div>
      {views.length ? (
        <div className="flex flex-wrap gap-[8px]">
          {views.map((view: { id: string; name: string; filters: Record<string, string> }) => (
            <button
              key={view.id}
              type="button"
              className="rounded-full border border-newBorder px-[12px] py-[6px] text-[12px] font-[600]"
              onClick={() => setFilters(viewToFilters(view.filters || {}))}
            >
              {view.name}
            </button>
          ))}
        </div>
      ) : null}
      <StalkerFilters
        filters={filters}
        onChange={setFilters}
        keywords={keywords}
        categories={project?.categories || []}
        authors={authors}
      />
      <div className="flex flex-wrap items-center gap-[10px] text-[13px]">
        <button
          type="button"
          role="switch"
          aria-checked={!!filters.offTopic}
          className="inline-flex items-center gap-[8px] text-textItemBlur hover:text-newTextColor"
          onClick={() => setFilters({ ...filters, offTopic: !filters.offTopic })}
        >
          <span
            className={clsx(
              'relative inline-flex h-[18px] w-[32px] items-center rounded-full border transition-colors',
              filters.offTopic ? 'border-[#00D9FF]/60 bg-[#00D9FF]/15' : 'border-newBorder bg-newBoxHover'
            )}
          >
            <span
              className={clsx(
                'absolute h-[12px] w-[12px] rounded-full bg-newTextColor transition-all',
                filters.offTopic ? 'start-[16px]' : 'start-[2px]'
              )}
            />
          </span>
          Show off-topic
          {!filters.offTopic && hiddenOffTopic ? ` (${hiddenOffTopic})` : ''}
        </button>
      </div>
      {mentionsQuery.isLoading && !mentions.length ? (
        <div className="flex flex-col gap-[12px]" aria-hidden>
          <div className="h-[96px] animate-pulse rounded-[16px] border border-newBorder bg-newBoxHover" />
          <div className="h-[96px] animate-pulse rounded-[16px] border border-newBorder bg-newBoxHover" />
          <div className="h-[96px] animate-pulse rounded-[16px] border border-newBorder bg-newBoxHover" />
        </div>
      ) : null}
      {!mentionsQuery.isLoading && !mentions.length ? (
        hiddenOffTopic && !filters.offTopic ? (
          <p className="text-[14px] text-textItemBlur">
            {hiddenOffTopic} mention{hiddenOffTopic === 1 ? '' : 's'} hidden as off-topic ·{' '}
            <button
              type="button"
              className="font-[600] text-newTextColor underline decoration-[#00D9FF]/60 underline-offset-[3px]"
              onClick={() => setFilters({ ...filters, offTopic: true })}
            >
              Show them
            </button>
          </p>
        ) : (
          <p className="text-[14px] text-textItemBlur">
            No mentions yet. Stalker is listening for mentions of {project?.name || 'this project'}.
          </p>
        )
      ) : null}
      {groups.map(([key, rows]) => (
        <section key={key} className="flex flex-col gap-[12px]">
          <p className="text-[12px] font-[600] tracking-wide text-textItemBlur">
            {dayHeading(rows[0]?.createdAt)} · {rows.length} mention{rows.length === 1 ? '' : 's'}
          </p>
          <Timeline rows={rows} />
          {rows.map((mention) => {
            const long = mention.text.length > 280;
            const text = expanded === mention.id || !long ? mention.text : `${mention.text.slice(0, 280)}…`;
            return (
              <article key={mention.id} className="rounded-[16px] border border-newBorder p-[14px]">
                <div className="flex gap-[12px]">
                  <div className="relative">
                    <span className="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-newBoxHover text-[12px] font-[600]">
                      {initials(mention.authorName)}
                    </span>
                    <span className="absolute -bottom-[2px] -end-[2px] flex h-[16px] w-[16px] items-center justify-center rounded-full bg-newBgColorInner">
                      <SourceIcon source={mention.source || ''} />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-[6px]">
                      <a
                        className="truncate text-[14px] font-[600]"
                        href={authorUrl(mention.source || '', mention.authorHandle || '', mention.url || '')}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {mention.authorName}
                      </a>
                      {mention.authorHandle ? (
                        <a
                          className="text-[13px] text-textItemBlur"
                          href={authorUrl(mention.source || '', mention.authorHandle, mention.url || '')}
                          target="_blank"
                          rel="noreferrer"
                        >
                          @{mention.authorHandle}
                        </a>
                      ) : null}
                      <span className="text-[12px] text-textItemBlur" title={exactTime(mention.createdAt)}>
                        {relativeTime(mention.createdAt)}
                      </span>
                    </div>
                    <p className="mt-[6px] text-[14px] leading-[1.5]">
                      {highlight(text, mention.keyword?.phrase)}
                    </p>
                    {long ? (
                      <button
                        type="button"
                        className="mt-[4px] text-[13px] text-textItemBlur"
                        onClick={() => setExpanded(expanded === mention.id ? null : mention.id)}
                      >
                        {expanded === mention.id ? 'See less' : 'See more'}
                      </button>
                    ) : null}
                    <p className="mt-[8px] flex gap-[12px] text-[12px] text-textItemBlur">
                      <span>{mention.replyCount || 0} replies</span>
                      <span>{mention.likeCount || 0} likes</span>
                    </p>
                    <div className="mt-[8px] flex flex-wrap gap-[6px]">
                      {mention.categoryDef?.name ? (
                        <span className="rounded-full border border-newBorder px-[8px] py-[2px] text-[12px]">
                          {mention.categoryDef.name}
                        </span>
                      ) : null}
                      {mention.sentiment && mention.sentiment !== 'NEUTRAL' ? (
                        <span
                          className={clsx(
                            'rounded-full px-[8px] py-[2px] text-[12px]',
                            mention.sentiment === 'POSITIVE'
                              ? 'bg-[#3DDC97]/15 text-[#1c8f5a]'
                              : 'bg-[#FF6B6B]/15 text-[#c43b3b]'
                          )}
                        >
                          {mention.sentiment === 'POSITIVE' ? 'Positive' : 'Negative'}
                        </span>
                      ) : null}
                      {mention.relevant === false ? (
                        <span className="rounded-full border border-dashed border-newBorder px-[8px] py-[2px] text-[12px] text-textItemBlur">
                          Off-topic
                        </span>
                      ) : null}
                      {statusLabel(mention.status) ? (
                        <span className="rounded-full border border-newBorder px-[8px] py-[2px] text-[12px]">
                          {statusLabel(mention.status)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-[6px] text-[13px]">
                    {mention.url ? (
                      <a href={mention.url} target="_blank" rel="noreferrer" className="text-textItemBlur hover:text-newTextColor">
                        Open
                      </a>
                    ) : null}
                    <button
                      type="button"
                      className="text-textItemBlur hover:text-newTextColor"
                      onClick={async () => {
                        if (!mention.url) return;
                        await navigator.clipboard.writeText(mention.url);
                        toaster.show('Link copied');
                      }}
                    >
                      Copy link
                    </button>
                    {mention.relevant === false ? (
                      <button
                        type="button"
                        className="font-[600] text-newTextColor hover:underline"
                        onClick={() => setRelevant(mention.id, true)}
                      >
                        Mark relevant
                      </button>
                    ) : null}
                    <div className="relative">
                      <button
                        type="button"
                        className="text-textItemBlur hover:text-newTextColor"
                        onClick={() => setMarking(marking === mention.id ? null : mention.id)}
                      >
                        Mark as…
                      </button>
                      {marking === mention.id ? (
                        <div className="absolute end-0 z-10 mt-[4px] w-[140px] rounded-[12px] border border-newBorder bg-newBgColorInner p-[6px] shadow-[var(--menu-shadow)]">
                          <button type="button" className="block w-full rounded-[8px] px-[8px] py-[6px] text-start" onClick={() => setStatus(mention.id, 'DONE')}>Done</button>
                          <button type="button" className="block w-full rounded-[8px] px-[8px] py-[6px] text-start" onClick={() => setStatus(mention.id, 'FOLLOW_UP')}>Follow up</button>
                          <button type="button" className="block w-full rounded-[8px] px-[8px] py-[6px] text-start text-[#c43b3b]" onClick={() => setStatus(mention.id, 'IGNORED')}>Irrelevant</button>
                          {mention.relevant === false ? (
                            <button type="button" className="block w-full rounded-[8px] px-[8px] py-[6px] text-start" onClick={() => setRelevant(mention.id, true)}>Relevant</button>
                          ) : (
                            <button type="button" className="block w-full rounded-[8px] px-[8px] py-[6px] text-start" onClick={() => setRelevant(mention.id, false)}>Off-topic</button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ))}
      {page?.nextCursor && !sample ? (
        <button
          type="button"
          className="self-center rounded-full border border-newBorder px-[14px] py-[8px] text-[13px] font-[600]"
          onClick={async () => {
            const response = await fetch(
              `/stalker/mentions?projectId=${projectId}&${search}&cursor=${page.nextCursor}`
            );
            const payload = await response.json();
            setExtra((current) => [...current, ...(payload.mentions || []).map(cleanMention)]);
          }}
        >
          Load more
        </button>
      ) : null}
      {dirty && !barHidden ? (
        <div className="sticky bottom-[12px] flex flex-wrap items-center justify-between gap-[8px] rounded-[14px] border border-newBorder bg-newBgColorInner px-[14px] py-[10px] shadow-[var(--menu-shadow)]">
          <p className="text-[13px]">Save these filters as a view</p>
          <div className="flex items-center gap-[8px]">
            {naming ? (
              <input
                className="rounded-[10px] border border-newBorder px-[8px] py-[6px] text-[13px]"
                placeholder="View name"
                value={viewName}
                onChange={(event) => setViewName(event.target.value)}
              />
            ) : null}
            <button type="button" className="rounded-full bg-newTextColor px-[12px] py-[6px] text-[13px] font-[600] text-newBgColorInner" onClick={() => (naming ? saveView() : setNaming(true))}>
              Save as view
            </button>
            <button type="button" className="text-[13px] text-textItemBlur" onClick={() => setBarHidden(true)}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const Timeline = ({ rows }: { rows: Mention[] }) => {
  const hours = Array.from({ length: 24 }, (_, hour) =>
    rows.filter((row) => row.createdAt && new Date(row.createdAt).getHours() === hour)
  );
  const now = new Date();
  const nowLeft = ((now.getHours() * 60 + now.getMinutes()) / (24 * 60)) * 100;
  const sameDay = rows[0]?.createdAt && dayKey(rows[0].createdAt) === dayKey(new Date().toISOString());
  return (
    <div className="relative px-[8px] py-[28px]">
      <div className="flex justify-between text-[11px] text-textItemBlur">
        {['12am', '6am', '12pm', '6pm', '11pm'].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="relative mt-[10px] h-[8px]">
        <div className="absolute inset-x-0 top-[3px] border-t border-dashed border-newBorder" />
        {hours.map((bucket, hour) =>
          bucket.length ? (
            <div
              key={hour}
              className="absolute -top-[14px] flex -translate-x-1/2"
              style={{ left: `${(hour / 24) * 100}%` }}
            >
              {bucket.slice(0, 3).map((mention) => (
                <span
                  key={mention.id}
                  title={mention.authorName}
                  className="-ms-[6px] flex h-[22px] w-[22px] items-center justify-center rounded-full border border-newBgColorInner bg-newBoxHover text-[9px] font-[600]"
                >
                  {initials(mention.authorName)}
                </span>
              ))}
              {bucket.length > 3 ? (
                <span className="ms-[2px] text-[11px] text-textItemBlur">+{bucket.length - 3}</span>
              ) : null}
            </div>
          ) : null
        )}
        {sameDay ? (
          <span className="absolute -top-[18px] text-[11px] font-[600] text-[#00A3C4]" style={{ left: `${nowLeft}%` }}>
            Now
          </span>
        ) : null}
      </div>
    </div>
  );
};
