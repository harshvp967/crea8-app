'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { HugeIcon, type HugeIconName } from '@gitroom/frontend/components/icons/hugeicons';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import {
  useStalkerAuthors,
  useStalkerKeywords,
  useStalkerMentions,
  useStalkerViews,
} from '@gitroom/frontend/components/stalker/stalker.hooks';
import { useStalkerProject } from '@gitroom/frontend/components/stalker/stalker.project';
import { platformLogo, SourceIcon } from '@gitroom/frontend/components/stalker/stalker.icons';
import { StalkerProjectMenu } from '@gitroom/frontend/components/stalker/stalker.nav';
import { SegmentedControl } from '@gitroom/frontend/components/ui/segmented-control';
import { StalkerCheckNow } from '@gitroom/frontend/components/stalker/stalker.check';
import { cleanMention, sourceLabel } from '@gitroom/frontend/components/stalker/stalker.labels';
import {
  describeFilters,
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
import {
  stkBadge,
  stkBadgeAcc,
  stkCardTight,
  stkEmpty,
  stkField,
  stkGhost,
  stkGroup,
  stkHead,
  stkIconTile,
  stkMenu,
  stkMenuItem,
  stkPage,
  stkChip,
  stkChipOn,
  stkPrimary,
  stkSecondary,
  stkTint,
  stkTitle,
  stkPopover,
} from '@gitroom/frontend/components/stalker/stalker.chrome';

const LONG_POST = 600;

type Mention = {
  id: string;
  createdAt?: string;
  postedAt?: string | null;
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
  if (!iso) return 'Earlier';
  const date = new Date(iso);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const diff = start.getTime() - day.getTime();
  if (diff === 0) return 'Today';
  if (diff === 86400000) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
};

const compactAge = (iso?: string) => {
  if (!iso) return '';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.max(1, Math.round(hours / 24));
  return `${days}d`;
};

const whoLabel = (mention: Mention) => {
  const name = mention.authorName || '';
  if (name.startsWith('@') || name.startsWith('u/')) return name;
  const source = mention.source || '';
  if ((source === 'X' || source.startsWith('X_')) && mention.authorHandle) {
    return mention.authorHandle.startsWith('@') ? mention.authorHandle : `@${mention.authorHandle}`;
  }
  return name || (mention.authorHandle ? `@${mention.authorHandle}` : 'Someone');
};

const groupLabel = (iso?: string) => {
  const heading = dayHeading(iso);
  return heading === 'Today' || heading === 'Yesterday' ? heading : 'Earlier';
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
        <a key={index} href={href} className="text-[color:var(--arc-accent-text)] underline" target="_blank" rel="noreferrer">
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
        <span className="stk-hit rounded-[6px] bg-[var(--arc-selected)] px-[4px] font-[600]">
          {part.slice(at, at + needle.length)}
        </span>
        {part.slice(at + needle.length)}
      </span>
    );
  });
};

const sentimentText = (sentiment?: string) => {
  if (sentiment === 'POSITIVE') return 'Positive';
  if (sentiment === 'NEGATIVE') return 'Negative';
  if (sentiment === 'NEUTRAL') return 'Neutral';
  return '';
};

const LineIcon = ({ name }: { name: HugeIconName }) => <HugeIcon name={name} size={16} />;

export const StalkerMentions = () => {
  const fetch = useFetch();
  const toaster = useToaster();
  const { project, projectId, sample } = useStalkerProject();
  const [filters, setFilters] = useState<MentionFilters>(emptyFilters());
  const [feedView, setFeedView] = useState<'feed' | 'timeline'>('feed');
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const [naming, setNaming] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [extra, setExtra] = useState<Mention[]>([]);
  const [patches, setPatches] = useState<Record<string, Partial<Mention>>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [viewRemove, setViewRemove] = useState<string | null>(null);
  const search = filtersToSearch(filters);
  const mentionsQuery = useStalkerMentions(sample ? null : projectId, search);
  const keywordsQuery = useStalkerKeywords(sample ? null : projectId);
  // Load authors and saved views alongside the first page instead of after it:
  // the API answers each in ~30ms, and the waterfall cost a full extra round
  // trip (plus CORS preflight) before the filter bar was usable.
  const authorsQuery = useStalkerAuthors(!sample && projectId ? projectId : null);
  const viewsQuery = useStalkerViews(!sample && projectId ? projectId : null);
  const page = sample ? SAMPLE_MENTIONS : mentionsQuery.data;
  const mentions = useMemo<Mention[]>(
    () =>
      [...(Array.isArray(page?.mentions) ? page.mentions : []), ...extra]
        .filter((mention) => !removed.includes(mention.id))
        .map((mention) => ({ ...mention, ...patches[mention.id] })),
    [page, extra, patches, removed]
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
    setPatches({});
    setRemoved([]);
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
          if (
            filters.status === 'IGNORED' &&
            mention.status !== 'IGNORED' &&
            mention.relevant !== false
          ) {
            return false;
          }
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
      const key = groupLabel(mention.postedAt || mention.createdAt);
      bag.set(key, [...(bag.get(key) || []), mention]);
    }
    return ['Today', 'Yesterday', 'Earlier']
      .filter((key) => bag.has(key))
      .map((key) => [key, bag.get(key) || []] as const);
  }, [mentions, sample, filters]);

  useEffect(() => {
    if (!marking) return;
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-mention-menu]')) return;
      setMarking(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [marking]);

  const patchMention = (id: string, patch: Partial<Mention>) => {
    setPatches((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  };

  const setStatus = async (id: string, status: string) => {
    setMarking(null);
    const previous = mentions.find((mention) => mention.id === id);
    patchMention(id, {
      status,
      relevant: status === 'IGNORED' ? false : true,
    });
    if (status === 'IGNORED' && !filters.offTopic) {
      setRemoved((current) => (current.includes(id) ? current : [...current, id]));
    }
    if (sample) {
      toaster.show('Updated');
      return;
    }
    const response = await fetch(`/stalker/mentions/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      if (previous) patchMention(id, previous);
      setRemoved((current) => current.filter((item) => item !== id));
      toaster.show('Could not update the mention', 'warning');
      return;
    }
    mentionsQuery.mutate();
  };

  const setRelevant = async (id: string, relevant: boolean) => {
    setMarking(null);
    const previous = mentions.find((mention) => mention.id === id);
    patchMention(id, {
      relevant,
      status: relevant ? (previous?.status === 'IGNORED' ? 'NEW' : previous?.status) : 'IGNORED',
    });
    if (!relevant && !filters.offTopic) {
      setRemoved((current) => (current.includes(id) ? current : [...current, id]));
    }
    if (relevant) setRemoved((current) => current.filter((item) => item !== id));
    if (sample) {
      toaster.show(relevant ? 'Marked relevant' : 'Marked off-topic');
      return;
    }
    const response = await fetch(`/stalker/mentions/${id}/relevant`, {
      method: 'POST',
      body: JSON.stringify({ relevant }),
    });
    if (!response.ok) {
      if (previous) patchMention(id, previous);
      setRemoved((current) => current.filter((item) => item !== id));
      toaster.show('Could not update the mention', 'warning');
      return;
    }
    toaster.show(relevant ? 'Marked relevant' : 'Marked off-topic');
    mentionsQuery.mutate();
  };

  const deleteMention = async (id: string) => {
    setMarking(null);
    setConfirmDelete(null);
    setRemoved((current) => (current.includes(id) ? current : [...current, id]));
    if (sample) {
      toaster.show('Mention removed');
      return;
    }
    const response = await fetch(`/stalker/mentions/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      setRemoved((current) => current.filter((item) => item !== id));
      toaster.show('Could not remove the mention', 'warning');
      return;
    }
    mentionsQuery.mutate();
  };

  const deleteView = async (id: string) => {
    setViewRemove(null);
    if (sample) {
      toaster.show('View removed');
      return;
    }
    const response = await fetch(`/stalker/views/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      toaster.show('Could not remove that view', 'warning');
      return;
    }
    viewsQuery.mutate();
  };

  const viewIsActive = (raw: Record<string, string | undefined>) => {
    const next = viewToFilters(raw);
    return (
      next.preset === filters.preset &&
      next.start === filters.start &&
      next.end === filters.end &&
      next.sources.join(',') === filters.sources.join(',') &&
      next.sentiment === filters.sentiment &&
      next.status === filters.status &&
      next.keywordId === filters.keywordId &&
      next.categoryId === filters.categoryId &&
      next.from === filters.from &&
      JSON.stringify(next.engagement) === JSON.stringify(filters.engagement)
    );
  };

  const hiddenOffTopic = sample ? 0 : Number(page?.hiddenOffTopic || 0);

  const saveView = async () => {
    const name = viewName.trim();
    if (name.length < 2 || !projectId) return;
    if (sample) {
      toaster.show('View saved');
      setNaming(false);
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
    toaster.show('View saved');
  };

  return (
    <div className={`${stkPage} stk-mentions`}>
      <div className={stkHead}>
        <div className="min-w-0">
          <div className="stk-kicker">
            <span className="stk-sticker">Stalker</span>
            {project?.name ? <span className="stk-period">{project.name}</span> : null}
          </div>
          <h1 className={stkTitle}>Mentions</h1>
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
        <div className="stk-head-actions flex flex-wrap items-center gap-[8px]">
          <div className="relative">
            <button
              type="button"
              className={`${stkSecondary} stk-save-btn`}
              aria-expanded={naming}
              onClick={() => setNaming((value) => !value)}
            >
              <HugeIcon name="folder" size={16} />
              <span className="stk-save-label">Save these filters as a view</span>
            </button>
            {naming ? (
              <>
                <button type="button" className="stk-sheet-backdrop" aria-label="Close" onClick={() => setNaming(false)} />
                <div className={`${stkPopover} stk-save-pop`}>
                  <p className="text-[14px] font-[600]">Save these filters as a view</p>
                  <input
                    className={stkField}
                    placeholder="View name"
                    value={viewName}
                    autoFocus
                    onChange={(event) => setViewName(event.target.value)}
                  />
                  <p className="text-[13px] text-textItemBlur">{describeFilters(filters, keywords)}</p>
                  <div className="flex justify-end gap-[8px]">
                    <button
                      type="button"
                      className={stkGhost}
                      onClick={() => {
                        setViewName('');
                        setNaming(false);
                      }}
                    >
                      Clear
                    </button>
                    <button type="button" className={`${stkPrimary} stk-sm-btn`} onClick={saveView}>
                      Save
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
          <StalkerCheckNow />
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
      {views.length ? (
        <div className="flex flex-wrap gap-[8px]">
          {views.map((view: { id: string; name: string; filters: Record<string, string> }) => {
            const active = viewIsActive(view.filters || {});
            return (
              <span key={view.id} className="relative inline-flex items-center">
                <button
                  type="button"
                  className={active ? stkChipOn : stkChip}
                  aria-pressed={active}
                  onClick={() => setFilters(viewToFilters(view.filters || {}))}
                >
                  {active ? <HugeIcon name="check" size={14} /> : null}
                  {view.name}
                </button>
                <button
                  type="button"
                  className={`${stkGhost} !h-[32px] !min-h-[32px] !px-[8px]`}
                  aria-label={`Delete ${view.name}`}
                  onClick={() => setViewRemove(viewRemove === view.id ? null : view.id)}
                >
                  <HugeIcon name="trash" size={14} />
                </button>
                {viewRemove === view.id ? (
                  <div className="stk-confirm" role="dialog" aria-label={`Remove ${view.name}`}>
                    <button type="button" onClick={() => setViewRemove(null)}>
                      Cancel
                    </button>
                    <button type="button" className="is-remove" onClick={() => deleteView(view.id)}>
                      Remove
                    </button>
                  </div>
                ) : null}
              </span>
            );
          })}
        </div>
      ) : null}
      <StalkerFilters
        filters={filters}
        onChange={setFilters}
        keywords={keywords}
        categories={project?.categories || []}
        authors={authors}
      />
      <div className="stk-tools flex flex-wrap items-center gap-[10px] text-[14px]">
        <button
          type="button"
          className="stk-offtopic inline-flex min-h-[44px] items-center gap-[8px] text-[14px] text-textItemBlur"
          onClick={() => setFilters({ ...filters, offTopic: !filters.offTopic })}
        >
          <span className="stk-switch" role="switch" aria-checked={!!filters.offTopic} aria-label="Show off-topic">
            <span />
          </span>
          Show off-topic
          {!filters.offTopic && hiddenOffTopic ? ` (${hiddenOffTopic})` : ''}
        </button>
        <SegmentedControl
          className="stk-segments"
          aria-label="Mentions view"
          size="sm"
          value={feedView}
          onValueChange={(value) => setFeedView(value === 'timeline' ? 'timeline' : 'feed')}
          options={[
            { value: 'feed', label: 'Feed' },
            { value: 'timeline', label: 'Timeline' },
          ]}
        />
      </div>
      {mentionsQuery.isLoading && !mentions.length ? (
        <div className="stk-loading flex flex-col gap-[12px]" aria-hidden>
          {[0, 1, 2].map((row) => (
            <div key={row} className={`${stkCardTight} flex flex-col gap-[12px]`}>
              <div className="flex items-center gap-[12px]">
                <span className="stk-skel h-[28px] w-[28px] animate-pulse" />
                <span className="stk-skel h-[14px] w-[160px] animate-pulse" />
              </div>
              <span className="stk-skel h-[14px] w-full animate-pulse" />
              <span className="stk-skel h-[14px] w-[70%] animate-pulse" />
            </div>
          ))}
        </div>
      ) : null}
      {!mentionsQuery.isLoading && !mentions.length ? (
        hiddenOffTopic && !filters.offTopic ? (
          <div className={`${stkEmpty} stk-state`}>
            <span className={`${stkIconTile} stk-state-mark`} aria-hidden>
              <HugeIcon name="list" size={24} />
            </span>
            <h2 className="text-[16px] font-[600]">
              {hiddenOffTopic} mention{hiddenOffTopic === 1 ? '' : 's'} hidden as off-topic
            </h2>
            <button
              type="button"
              className={stkSecondary}
              onClick={() => setFilters({ ...filters, offTopic: true })}
            >
              Show them
            </button>
          </div>
        ) : dirty ? (
          <div className="stk-empty-view stk-state">
            <span className="stk-empty-mark stk-state-mark" aria-hidden>@</span>
            <h2 className="text-[16px] font-[600]">No mentions in this view.</h2>
            <p className="max-w-[360px] text-[14px] text-textItemBlur">
              Try a wider date range or clear a filter.
            </p>
            <button type="button" className={`${stkSecondary} mt-[6px]`} onClick={() => setFilters(emptyFilters())}>
              Clear
            </button>
          </div>
        ) : (
          <div className="stk-empty-view stk-state">
            <span className="stk-empty-mark stk-state-mark" aria-hidden>@</span>
            <h2 className="text-[16px] font-[600]">No mentions yet.</h2>
            <p className="max-w-[360px] text-[14px] text-textItemBlur">
              Stalker is listening for mentions of {project?.name || 'this project'}.
            </p>
          </div>
        )
      ) : null}
      {groups.map(([key, rows]) => (
        <section key={key} className="stk-day-group">
          <p className={stkGroup}>{key}</p>
          {feedView === 'timeline' ? <Timeline rows={rows} /> : null}
          {rows.map((mention) => {
            const posted = mention.postedAt || mention.createdAt;
            const long = mention.text.length > LONG_POST;
            const text =
              expanded === mention.id || !long ? mention.text : `${mention.text.slice(0, LONG_POST).trimEnd()}…`;
            const postUrl = mention.url || '';
            const sentiment = sentimentText(mention.sentiment);
            const follow = mention.status === 'FOLLOW_UP';
            const done = mention.status === 'DONE' || mention.status === 'REPLIED';
            const ignored = mention.status === 'IGNORED' || mention.relevant === false;
            const logo = platformLogo(mention.source);
            return (
              <article key={mention.id} className={`${stkCardTight} stk-mcard`}>
                <div className="stk-mhead">
                  <span className={clsx('stk-msrc', logo && 'is-logo')}>
                    {logo ? (
                      <img src={logo} alt="" />
                    ) : (
                      <SourceIcon source={mention.source || ''} className="h-[16px] w-[16px]" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="stk-mwho">
                      {postUrl ? (
                        <a className="truncate" href={postUrl} target="_blank" rel="noreferrer">
                          {whoLabel(mention)}
                        </a>
                      ) : (
                        <span className="truncate">{whoLabel(mention)}</span>
                      )}
                      {postUrl ? (
                        <a className="stk-mmeta" href={postUrl} target="_blank" rel="noreferrer" title={exactTime(posted)}>
                          {sourceLabel(mention.source || '')}
                          {compactAge(posted) ? ` · ${compactAge(posted)}` : ''}
                        </a>
                      ) : (
                        <span className="stk-mmeta" title={exactTime(posted)}>
                          {sourceLabel(mention.source || '')}
                          {compactAge(posted) ? ` · ${compactAge(posted)}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  {sentiment ? (
                    <span
                      className={clsx(
                        'stk-sent',
                        mention.sentiment === 'POSITIVE' && 'is-ok',
                        mention.sentiment === 'NEGATIVE' && 'is-bad'
                      )}
                    >
                      <i />
                      {sentiment}
                    </span>
                  ) : null}
                </div>
                <p className="stk-mtext">{highlight(text)}</p>
                {long ? (
                  <button
                    type="button"
                    className="stk-more-inline"
                    onClick={() => setExpanded(expanded === mention.id ? null : mention.id)}
                  >
                    {expanded === mention.id ? 'Show less' : 'Show more'}
                  </button>
                ) : null}
                <div className="stk-mfoot">
                  <div className="stk-mtags">
                    {mention.categoryDef?.name ? (
                      <span className={stkBadgeAcc}>{mention.categoryDef.name}</span>
                    ) : null}
                    {mention.keyword?.phrase ? <span className={stkBadge}>{mention.keyword.phrase}</span> : null}
                    {mention.relevant === false ? <span className={stkBadge}>Off-topic</span> : null}
                  </div>
                  <div className="stk-mention-actions">
                    <button
                      type="button"
                      className={clsx(follow ? stkTint : stkGhost, 'stk-act')}
                      onClick={() => setStatus(mention.id, follow ? 'NEW' : 'FOLLOW_UP')}
                    >
                      <LineIcon name="flag" />
                      <span>Follow up</span>
                    </button>
                    <button
                      type="button"
                      className={clsx(done ? stkTint : stkGhost, 'stk-act')}
                      onClick={() => setStatus(mention.id, done ? 'NEW' : 'DONE')}
                    >
                      <LineIcon name="check" />
                      <span>Done</span>
                    </button>
                    <button
                      type="button"
                      className={clsx(ignored ? stkTint : stkGhost, 'stk-act')}
                      onClick={() => setRelevant(mention.id, ignored ? true : false)}
                    >
                      <LineIcon name="close" />
                      <span>Irrelevant</span>
                    </button>
                    <div className="relative" data-mention-menu>
                      <button
                        type="button"
                        className={`${stkGhost} stk-act stk-more`}
                        aria-label="Mention actions"
                        aria-expanded={marking === mention.id}
                        onClick={() => setMarking(marking === mention.id ? null : mention.id)}
                      >
                        <HugeIcon name="more" size={16} />
                      </button>
                      {marking === mention.id ? (
                        <>
                          <button
                            type="button"
                            className="stk-sheet-backdrop"
                            aria-label="Close"
                            onClick={() => setMarking(null)}
                          />
                          <div className={`${stkMenu} stk-mention-menu`} role="menu">
                            {confirmDelete === mention.id ? (
                              <div className="stk-confirm" role="dialog" aria-label="Remove mention">
                                <button type="button" onClick={() => setConfirmDelete(null)}>
                                  Cancel
                                </button>
                                <button type="button" className="is-remove" onClick={() => deleteMention(mention.id)}>
                                  Remove
                                </button>
                              </div>
                            ) : (
                            <>
                            <button type="button" className={stkMenuItem} onClick={() => setRelevant(mention.id, true)}>
                              <LineIcon name="check" />
                              <span className="min-w-0 flex-1 text-start">Relevant</span>
                              {!ignored ? <HugeIcon name="check" size={16} /> : null}
                            </button>
                            <button type="button" className={stkMenuItem} onClick={() => setRelevant(mention.id, false)}>
                              <LineIcon name="close" />
                              <span className="min-w-0 flex-1 text-start">Off-topic</span>
                              {ignored ? <HugeIcon name="check" size={16} /> : null}
                            </button>
                            <div className="stk-menu-rule" />
                            <button
                              type="button"
                              className={stkMenuItem}
                              disabled={!mention.url}
                              onClick={async () => {
                                if (!mention.url) return;
                                await navigator.clipboard.writeText(mention.url);
                                toaster.show('Link copied');
                                setMarking(null);
                              }}
                            >
                              <LineIcon name="copy" />
                              Copy link
                            </button>
                            <button
                              type="button"
                              className={stkMenuItem}
                              onClick={() => {
                                setExpanded(expanded === mention.id ? null : mention.id);
                                setMarking(null);
                              }}
                            >
                              <LineIcon name="chevron-right" />
                              {expanded === mention.id ? 'See less' : 'See more'}
                            </button>
                            {mention.url ? (
                              <a href={mention.url} target="_blank" rel="noreferrer" className={stkMenuItem}>
                                <LineIcon name="external" />
                                Open
                              </a>
                            ) : null}
                            <button
                              type="button"
                              className={`${stkMenuItem} stk-menu-danger`}
                              onClick={() => setConfirmDelete(mention.id)}
                            >
                              <LineIcon name="trash" />
                              Delete
                            </button>
                            </>
                            )}
                          </div>
                        </>
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
          className={`${stkSecondary} self-center`}
          onClick={async () => {
            const response = await fetch(
              `/stalker/mentions?projectId=${projectId}&${search}&cursor=${page.nextCursor}`
            );
            if (!response.ok) {
              toaster.show('Could not load more mentions', 'warning');
              return;
            }
            const payload = await response.json();
            setExtra((current) => [...current, ...(payload.mentions || []).map(cleanMention)]);
          }}
        >
          Load more
        </button>
      ) : null}
    </div>
  );
};

// Each cluster needs ~84px (3 avatars + "+N"); merge hours until it fits.
const TIMELINE_SPANS = [1, 2, 3, 4, 6, 8, 12, 24];
const TIMELINE_MIN_PX = 84;

const Timeline = ({ rows }: { rows: Mention[] }) => {
  const track = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  useEffect(() => {
    const element = track.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    setWidth(element.getBoundingClientRect().width || 720);
    const observer = new ResizeObserver(([entry]) => {
      if (entry?.contentRect.width) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const span =
    TIMELINE_SPANS.find((hours) => (width / 24) * hours >= TIMELINE_MIN_PX) || 24;
  const clusters = Array.from({ length: 24 / span }, (_, index) => {
    const start = index * span;
    return {
      start,
      rows: rows.filter((row) => {
        const posted = row.postedAt || row.createdAt;
        if (!posted) return false;
        const hour = new Date(posted).getHours();
        return hour >= start && hour < start + span;
      }),
    };
  });
  const now = new Date();
  const nowLeft = ((now.getHours() * 60 + now.getMinutes()) / (24 * 60)) * 100;
  const first = rows[0]?.postedAt || rows[0]?.createdAt;
  const sameDay = first && dayKey(first) === dayKey(new Date().toISOString());
  return (
    <div className="stk-timeline relative px-[8px] py-[28px]">
      <div className="flex justify-between text-[13px] text-textItemBlur">
        {['12am', '6am', '12pm', '6pm', '11pm'].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div ref={track} className="relative mt-[10px] h-[8px]">
        <div className="absolute inset-x-0 top-[3px] border-t border-dashed border-newBorder" />
        {clusters.map((cluster) => {
          if (!cluster.rows.length) return null;
          const shown = cluster.rows.slice(0, 3);
          const names = cluster.rows
            .map((mention) => mention.authorName || 'Someone')
            .slice(0, 8)
            .join(', ');
          return (
            <div
              key={cluster.start}
              className="absolute -top-[14px] flex -translate-x-1/2 items-center"
              style={{ left: `${((cluster.start + span / 2) / 24) * 100}%` }}
              title={cluster.rows.length > 8 ? `${names} and ${cluster.rows.length - 8} more` : names}
            >
              {shown.map((mention, index) => (
                <span
                  key={mention.id}
                  style={{ zIndex: shown.length - index }}
                  className={clsx(
                    'relative flex h-[26px] w-[26px] items-center justify-center rounded-full border border-newBorder bg-newBoxHover text-[13px] font-[600] ring-2 ring-newBgColorInner',
                    index ? '-ms-[4px]' : ''
                  )}
                >
                  {initials(mention.authorName)}
                </span>
              ))}
              {cluster.rows.length > 3 ? (
                <span className="ms-[6px] whitespace-nowrap text-[13px] text-textItemBlur">
                  +{cluster.rows.length - 3}
                </span>
              ) : null}
            </div>
          );
        })}
        {sameDay ? (
          <span className="absolute -top-[18px] text-[13px] font-[600] text-[color:var(--arc-accent-text)]" style={{ left: `${nowLeft}%` }}>
            Now
          </span>
        ) : null}
      </div>
    </div>
  );
};
