'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Button } from '@gitroom/react/form/button';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useStalkerMentions } from '@gitroom/frontend/components/stalker/stalker.hooks';
import { useStalkerComposer } from '@gitroom/frontend/components/stalker/use.stalker.composer';

const CATEGORIES = [
  '',
  'IDEA',
  'QUESTION',
  'COMPLAINT',
  'BUG',
  'TESTIMONIAL',
  'PRAISE',
  'SPAM',
  'OTHER',
];

const SOURCES = [
  '',
  'YOUTUBE_COMMENT',
  'YOUTUBE_SEARCH',
  'INSTAGRAM_COMMENT',
  'FACEBOOK_COMMENT',
];

const labelOf = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const StalkerMentions = () => {
  const t = useT();
  const openComposer = useStalkerComposer();
  const [category, setCategory] = useState('');
  const [source, setSource] = useState('');
  const [minUrgency, setMinUrgency] = useState(0);
  const search = useMemo(() => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (source) params.set('source', source);
    if (minUrgency) params.set('minUrgency', String(minUrgency));
    return params.toString();
  }, [category, source, minUrgency]);
  const { data, isLoading } = useStalkerMentions(search);
  const mentions: Array<{
    id: string;
    category?: string;
    source?: string;
    sentiment?: string;
    urgency: number;
    text: string;
    authorName?: string;
    url?: string;
    keyword?: { phrase?: string };
  }> = Array.isArray(data) ? data : [];

  return (
    <div className="flex flex-col gap-[16px]">
      <div>
        <h1 className="text-[28px] font-[600]">
          {t('stalker_mentions', 'Mentions')}
        </h1>
        <p className="mt-[6px] text-[14px] text-textItemBlur">
          {t(
            'stalker_mentions_help',
            'Comments on your channels, plus public YouTube matches for your keywords.'
          )}
        </p>
      </div>
      <div className="flex flex-wrap gap-[8px]">
        <select
          aria-label="Category"
          className="bg-[#141414] border border-[#2a2a2a] rounded-[10px] px-[12px] py-[8px] text-[13px]"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          {CATEGORIES.map((item) => (
            <option key={item || 'all'} value={item}>
              {item ? labelOf(item) : 'All categories'}
            </option>
          ))}
        </select>
        <select
          aria-label="Source"
          className="bg-[#141414] border border-[#2a2a2a] rounded-[10px] px-[12px] py-[8px] text-[13px]"
          value={source}
          onChange={(event) => setSource(event.target.value)}
        >
          {SOURCES.map((item) => (
            <option key={item || 'all'} value={item}>
              {item ? labelOf(item) : 'All sources'}
            </option>
          ))}
        </select>
        <select
          aria-label="Urgency"
          className="bg-[#141414] border border-[#2a2a2a] rounded-[10px] px-[12px] py-[8px] text-[13px]"
          value={minUrgency}
          onChange={(event) => setMinUrgency(Number(event.target.value))}
        >
          <option value={0}>Any urgency</option>
          <option value={40}>Urgency 40+</option>
          <option value={70}>Urgency 70+</option>
        </select>
      </div>
      {isLoading ? (
        <p className="text-[14px] text-textItemBlur">Loading mentions…</p>
      ) : null}
      {!isLoading && !mentions.length ? (
        <p className="text-[14px] text-textItemBlur">
          No mentions yet. Add a keyword or wait for the next check of your connected channels.
        </p>
      ) : null}
      <div className="flex flex-col gap-[12px]">
        {mentions.map((mention) => (
          <article
            key={mention.id}
            className="rounded-[16px] border border-newBorder bg-newBgColorInner p-[16px] flex flex-col gap-[10px]"
          >
            <div className="flex flex-wrap items-center gap-[8px] text-[12px]">
              <span className="rounded-full bg-[#00D9FF]/15 text-[#00D9FF] px-[8px] py-[3px]">
                {labelOf(mention.category || 'OTHER')}
              </span>
              <span className="text-textItemBlur">
                {labelOf(mention.source || '')}
              </span>
              <span className="text-textItemBlur">
                {mention.sentiment?.toLowerCase()}
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
            <p className="text-[15px] leading-[1.5] whitespace-pre-wrap">
              {mention.text}
            </p>
            <div className="flex flex-wrap items-center gap-[12px] text-[13px] text-textItemBlur">
              <span>{mention.authorName}</span>
              {mention.keyword?.phrase ? (
                <span>Keyword: {mention.keyword.phrase}</span>
              ) : null}
              {mention.url ? (
                <a className="underline" href={mention.url} target="_blank" rel="noreferrer">
                  Open
                </a>
              ) : null}
              <div className="ms-auto flex gap-[8px]">
                {mention.category === 'TESTIMONIAL' ? (
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
