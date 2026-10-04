'use client';

import { useState } from 'react';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useStalkerKeywords } from '@gitroom/frontend/components/stalker/stalker.hooks';
import { useStalkerProject } from '@gitroom/frontend/components/stalker/stalker.project';

const FLAGS = [
  { key: 'listenYoutube', label: 'YouTube' },
  { key: 'listenReddit', label: 'Reddit' },
  { key: 'listenX', label: 'X' },
  { key: 'listenLinkedin', label: 'LinkedIn' },
] as const;

export const StalkerKeywords = () => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const { projectId } = useStalkerProject();
  const [phrase, setPhrase] = useState('');
  const { data, mutate, isLoading } = useStalkerKeywords(projectId);
  const keywords: Array<{
    id: string;
    phrase: string;
    listenYoutube: boolean;
    listenReddit: boolean;
    listenX: boolean;
    listenLinkedin: boolean;
  }> = Array.isArray(data) ? data : [];

  const addKeyword = async () => {
    const response = await fetch('/stalker/keywords', {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        phrase,
        youtube: true,
        reddit: true,
        x: false,
        linkedin: false,
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

  return (
    <div className="flex max-w-[640px] flex-col gap-[16px]">
      <div>
        <h1 className="text-[28px] font-[600]">
          {t('stalker_keywords', 'Keywords')}
        </h1>
        <p className="mt-[6px] text-[14px] text-textItemBlur">
          Brand names, competitors, and niche phrases. Up to five are searched on each connected source every check.
        </p>
      </div>
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
      {isLoading ? (
        <p className="text-[14px] text-textItemBlur">Loading keywords…</p>
      ) : null}
      <ul className="flex flex-col gap-[8px]">
        {keywords.map((keyword) => (
          <li
            key={keyword.id}
            className="flex items-center justify-between gap-[12px] rounded-[12px] border border-newBorder bg-newBgColorInner px-[14px] py-[10px]"
          >
            <div className="flex flex-col gap-[4px]">
              <span>{keyword.phrase}</span>
              <span className="text-[12px] text-textItemBlur">
                {FLAGS.filter((flag) => keyword[flag.key])
                  .map((flag) => flag.label)
                  .join(', ') || 'No sources'}
              </span>
            </div>
            <button
              type="button"
              className="text-[13px] text-textItemBlur underline"
              onClick={() => removeKeyword(keyword.id)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
