'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Button } from '@gitroom/react/form/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import {
  useStalkerKeywords,
  useStalkerMentions,
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

type Mention = {
  id: string;
  category?: string;
  source?: string;
  sentiment?: string;
  status?: 'NEW' | 'REPLIED' | 'IGNORED';
  urgency: number;
  text: string;
  authorName?: string;
  url?: string;
  keyword?: { phrase?: string };
  categoryDef?: { id: string; name: string } | null;
};

export const StalkerMentions = () => {
  const t = useT();
  const fetch = useFetch();
  const openComposer = useStalkerComposer();
  const { project, projectId } = useStalkerProject();
  const { data: keywordData } = useStalkerKeywords(projectId);
  const [date, setDate] = useState('all');
  const [source, setSource] = useState('');
  const [from, setFrom] = useState('');
  const [keywordId, setKeywordId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sentiment, setSentiment] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const search = useMemo(() => {
    const params = new URLSearchParams();
    if (date && date !== 'all') params.set('date', date);
    if (source) params.set('source', source);
    if (from.trim()) params.set('from', from.trim());
    if (keywordId) params.set('keywordId', keywordId);
    if (categoryId) params.set('categoryId', categoryId);
    if (sentiment) params.set('sentiment', sentiment);
    if (statusFilter) params.set('status', statusFilter);
    return params.toString();
  }, [date, source, from, keywordId, categoryId, sentiment, statusFilter]);
  const { data, isLoading, mutate } = useStalkerMentions(projectId, search);
  const mentions: Mention[] = Array.isArray(data) ? data : [];
  const keywords: Array<{ id: string; phrase: string }> = Array.isArray(
    keywordData
  )
    ? keywordData
    : [];

  const setStatus = async (id: string, next: 'NEW' | 'REPLIED' | 'IGNORED') => {
    await fetch(`/stalker/mentions/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status: next }),
    });
    mutate();
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
          Public matches and comments for {project?.name || 'this project'}.
        </p>
      </div>
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
      <div className="flex flex-col gap-[12px]">
        {mentions.map((mention) => (
          <article
            key={mention.id}
            className="flex flex-col gap-[10px] rounded-[16px] border border-newBorder bg-newBgColorInner p-[16px]"
          >
            <div className="flex flex-wrap items-center gap-[8px] text-[12px]">
              <span className="inline-flex items-center gap-[6px] text-textItemBlur">
                <SourceIcon source={mention.source || ''} />
                {labelOf(mention.source || '')}
              </span>
              <span className="rounded-full bg-[#00D9FF]/15 px-[8px] py-[3px] text-[#00D9FF]">
                {mention.categoryDef?.name || labelOf(mention.category || 'OTHER')}
              </span>
              <span className="text-textItemBlur">
                {mention.sentiment?.toLowerCase()}
              </span>
              <span className="rounded-full border border-[#2a2a2a] px-[8px] py-[3px] text-textItemBlur">
                {(mention.status || 'NEW').toLowerCase()}
              </span>
              <span
                className={clsx(
                  'ms-auto font-[600]',
                  mention.urgency >= 70 ? 'text-[#ff8a8a]' : 'text-textItemBlur'
                )}
              >
                {mention.urgency}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-[15px] leading-[1.5]">
              {mention.text}
            </p>
            <div className="flex flex-wrap items-center gap-[12px] text-[13px] text-textItemBlur">
              <span>{mention.authorName}</span>
              {mention.keyword?.phrase ? (
                <span>Keyword: {mention.keyword.phrase}</span>
              ) : null}
              {mention.url ? (
                <a
                  className="underline"
                  href={mention.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open
                </a>
              ) : null}
              <div className="ms-auto flex flex-wrap gap-[8px]">
                {(['NEW', 'REPLIED', 'IGNORED'] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={clsx(
                      'rounded-full border px-[8px] py-[3px] text-[12px]',
                      mention.status === item
                        ? 'border-[#00D9FF]/50 text-[#00D9FF]'
                        : 'border-[#2a2a2a]'
                    )}
                    onClick={() => setStatus(mention.id, item)}
                  >
                    {item.charAt(0) + item.slice(1).toLowerCase()}
                  </button>
                ))}
                {mention.category === 'TESTIMONIAL' ||
                mention.categoryDef?.name.toLowerCase().includes('praise') ? (
                  <Button
                    type="button"
                    secondary
                    onClick={() =>
                      openComposer({ mentionId: mention.id, mode: 'quote' })
                    }
                  >
                    Make quote post
                  </Button>
                ) : null}
                <Button
                  type="button"
                  onClick={() =>
                    openComposer({ mentionId: mention.id, mode: 'post' })
                  }
                >
                  Create post
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};
