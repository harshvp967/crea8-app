'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import {
  useStalkerKeywords,
  useStalkerStatus,
} from '@gitroom/frontend/components/stalker/stalker.hooks';
import { useStalkerProject } from '@gitroom/frontend/components/stalker/stalker.project';

const SOURCES = [
  { id: 'youtube', label: 'YouTube', key: 'listenYoutube' },
  { id: 'reddit', label: 'Reddit', key: 'listenReddit' },
  { id: 'x', label: 'X', key: 'listenX' },
  { id: 'linkedin', label: 'LinkedIn', key: 'listenLinkedin' },
] as const;

type SourceId = (typeof SOURCES)[number]['id'];

type Backfill = {
  id: SourceId;
  state: 'off' | 'idle' | 'queued' | 'done' | 'failed';
  error?: string;
};

type Keyword = {
  id: string;
  phrase: string;
  listenYoutube: boolean;
  listenReddit: boolean;
  listenX: boolean;
  listenLinkedin: boolean;
  backfillArmed?: boolean;
  backfill?: Backfill[];
};

const noteFor = (
  id: SourceId,
  available: boolean,
  detail?: string
) => {
  if (available) {
    return '';
  }
  if (id === 'linkedin') {
    return 'Coming soon';
  }
  if (id === 'reddit' || id === 'x') {
    return 'Needs API access';
  }
  return detail || 'Unavailable';
};

const backfillLabel = (source: (typeof SOURCES)[number], row?: Backfill) => {
  if (!row || row.state === 'off' || row.state === 'idle') {
    return '';
  }
  if (row.state === 'queued') {
    return `${source.label}: Backfill queued`;
  }
  if (row.state === 'done') {
    return `${source.label}: Backfilled`;
  }
  return `${source.label}: Failed: ${row.error || 'the last check failed'}`;
};

export const StalkerKeywords = () => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const { projectId } = useStalkerProject();
  const { data: status } = useStalkerStatus();
  const [phrase, setPhrase] = useState('');
  const [youtube, setYoutube] = useState(true);
  const [reddit, setReddit] = useState(false);
  const [xOn, setXOn] = useState(false);
  const [linkedin, setLinkedin] = useState(false);
  const flags: Record<SourceId, boolean> = {
    youtube,
    reddit,
    x: xOn,
    linkedin,
  };
  const setFlag = (id: SourceId, value: boolean) => {
    if (id === 'youtube') setYoutube(value);
    if (id === 'reddit') setReddit(value);
    if (id === 'x') setXOn(value);
    if (id === 'linkedin') setLinkedin(value);
  };
  const { data, mutate, isLoading } = useStalkerKeywords(projectId);
  const keywords: Keyword[] = Array.isArray(data) ? data : [];
  const sources: Array<{ id: string; available?: boolean; detail?: string }> =
    Array.isArray(status?.sources) ? status.sources : [];
  const statusReady = Array.isArray(status?.sources);
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  useEffect(() => {
    if (window.location.hash !== '#add-keyword') {
      return;
    }
    document.getElementById('add-keyword')?.scrollIntoView({ block: 'start' });
  }, []);

  const addKeyword = async () => {
    const response = await fetch('/stalker/keywords', {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        phrase,
        youtube: statusReady ? !!sourceById.get('youtube')?.available && youtube : youtube,
        reddit: statusReady ? !!sourceById.get('reddit')?.available && reddit : reddit,
        x: statusReady ? !!sourceById.get('x')?.available && xOn : xOn,
        linkedin: statusReady ? !!sourceById.get('linkedin')?.available && linkedin : linkedin,
      }),
    });
    if (!response.ok) {
      toaster.show('Could not add that keyword', 'warning');
      return;
    }
    setPhrase('');
    mutate();
  };

  const removeKeyword = async (id: string) => {
    await fetch(`/stalker/keywords/${id}`, { method: 'DELETE' });
    mutate();
  };

  const updateSources = async (keyword: Keyword, id: SourceId, on: boolean) => {
    const body = {
      youtube: keyword.listenYoutube,
      reddit: keyword.listenReddit,
      x: keyword.listenX,
      linkedin: keyword.listenLinkedin,
      [id]: on,
    };
    const response = await fetch(`/stalker/keywords/${keyword.id}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      toaster.show('Could not update that keyword', 'warning');
      return;
    }
    mutate();
  };

  const backfill = async (id: string) => {
    const response = await fetch(`/stalker/keywords/${id}/backfill`, {
      method: 'POST',
    });
    if (!response.ok) {
      toaster.show('Could not queue that backfill', 'warning');
      return;
    }
    mutate();
    toaster.show(
      'Next check looks back 30 days for this keyword. The live scan keeps its place.',
      'success'
    );
  };

  return (
    <div className="flex max-w-[720px] flex-col gap-[16px]">
      <div>
        <h1 className="text-[22px] font-[600]">
          {t('stalker_keywords', 'Keywords')}
        </h1>
        <p className="mt-[6px] text-[14px] text-textItemBlur">
          Brand names, competitors, and niche phrases. YouTube is on by default. Up to five flagged keywords are searched on each check.
        </p>
      </div>
      <div
        id="add-keyword"
        className="flex flex-col gap-[12px] rounded-[16px] border border-newBorder bg-newBgColorInner p-[16px]"
      >
        <div className="flex items-end gap-[8px]">
          <div className="flex-1">
            <Input
              label="Keyword"
              translationKey="label_keyword"
              name="phrase"
              disableForm={true}
              value={phrase}
              onChange={(event) => setPhrase(event.target.value)}
              placeholder="tutorial request"
            />
          </div>
          <Button
            type="button"
            onClick={addKeyword}
            disabled={!projectId || phrase.trim().length < 2}
          >
            Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-[8px]">
          {SOURCES.map((source) => {
            const statusSource = sourceById.get(source.id);
            const available = !!statusSource?.available;
            const note = noteFor(source.id, available, statusSource?.detail);
            const on = flags[source.id] && available;
            return (
              <button
                key={source.id}
                type="button"
                disabled={!available}
                title={note || source.label}
                className={clsx(
                  'rounded-full border px-[10px] py-[4px] text-[12px]',
                  !available && 'cursor-not-allowed opacity-60',
                  on
                    ? 'border-[#00D9FF]/40 bg-[#00D9FF]/10 text-[#00D9FF]'
                    : 'border-newBorder text-textItemBlur'
                )}
                onClick={() => setFlag(source.id, !flags[source.id])}
              >
                {source.label}
                {note ? ` · ${note}` : ''}
              </button>
            );
          })}
        </div>
      </div>
      {isLoading && !keywords.length ? (
        <div className="h-[72px] animate-pulse rounded-[12px] border border-newBorder" />
      ) : null}
      {!isLoading && !keywords.length ? (
        <p className="text-[14px] text-textItemBlur">
          No keywords yet. Add a phrase and the next check will listen for it.
        </p>
      ) : null}
      <ul className="flex flex-col gap-[8px]">
        {keywords.map((keyword) => {
          const states = SOURCES.map((source) =>
            backfillLabel(
              source,
              keyword.backfill?.find((row) => row.id === source.id)
            )
          ).filter(Boolean);
          return (
            <li
              key={keyword.id}
              className="flex flex-col gap-[8px] rounded-[12px] border border-newBorder bg-newBgColorInner px-[14px] py-[10px]"
            >
              <div className="flex items-center justify-between gap-[12px]">
                <span className="font-[600]">{keyword.phrase}</span>
                <span className="flex items-center gap-[10px]">
                  <button
                    type="button"
                    className="text-[13px] text-[#00D9FF]"
                    onClick={() => backfill(keyword.id)}
                  >
                    Backfill 30 days
                  </button>
                  <button
                    type="button"
                    className="text-[13px] text-textItemBlur"
                    onClick={() => removeKeyword(keyword.id)}
                  >
                    Remove
                  </button>
                </span>
              </div>
              <div className="flex flex-wrap gap-[8px]">
                {SOURCES.map((source) => {
                  const statusSource = sourceById.get(source.id);
                  const available = !!statusSource?.available;
                  const note = noteFor(source.id, available, statusSource?.detail);
                  const on = keyword[source.key];
                  return (
                    <button
                      key={source.id}
                      type="button"
                      disabled={!available && !on}
                      className={clsx(
                        'rounded-full border px-[10px] py-[4px] text-[12px]',
                        !available && !on && 'cursor-not-allowed opacity-60',
                        on
                          ? 'border-[#00D9FF]/40 bg-[#00D9FF]/10 text-[#00D9FF]'
                          : 'border-newBorder text-textItemBlur'
                      )}
                      onClick={() => updateSources(keyword, source.id, !on)}
                    >
                      {source.label}
                      {note ? ` · ${note}` : ''}
                    </button>
                  );
                })}
              </div>
              {states.length ? (
                <p className="text-[12px] text-textItemBlur">{states.join(' · ')}</p>
              ) : keyword.backfillArmed ? (
                <p className="text-[12px] text-textItemBlur">Backfill queued</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
