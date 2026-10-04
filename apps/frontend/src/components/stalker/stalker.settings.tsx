'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { Button } from '@gitroom/react/form/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useStalkerProject } from '@gitroom/frontend/components/stalker/stalker.project';

export const StalkerSettings = () => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const { status } = useStalkerProject();
  const [running, setRunning] = useState(false);

  const checkNow = async () => {
    setRunning(true);
    const response = await fetch('/stalker/poll', { method: 'POST' });
    setRunning(false);
    if (!response.ok) {
      toaster.show('The check did not finish', 'warning');
      return;
    }
    toaster.show('Check finished. Open Mentions to see what was found.', 'success');
  };

  const sources = [
    ...(status?.sources || []).map((source) => ({
      id: source.id,
      label: source.label,
      available: source.available,
      detail: source.detail,
    })),
    ...(status?.commentSources || []).map((source) => ({
      id: source.id,
      label: source.label,
      available: source.available,
      detail: source.available ? 'Connected account' : 'Connect a channel',
    })),
  ];

  return (
    <div className="flex max-w-[640px] flex-col gap-[16px]">
      <div>
        <h1 className="text-[28px] font-[600]">
          {t('stalker_settings', 'Settings')}
        </h1>
        <p className="mt-[6px] text-[14px] text-textItemBlur">
          Keyword search runs on the sources that are connected. Comments still come from YouTube, Instagram, and Facebook channels you have already linked.
        </p>
      </div>
      <dl className="flex flex-col gap-[8px] rounded-[16px] border border-newBorder bg-newBgColorInner p-[16px] text-[14px]">
        <div className="flex justify-between gap-[12px]">
          <dt className="text-textItemBlur">Automatic check</dt>
          <dd>Every {status?.pollHours || 6} hours</dd>
        </div>
        <div className="flex justify-between gap-[12px]">
          <dt className="text-textItemBlur">Keywords searched each run</dt>
          <dd>{status?.keywordsSearchedPerRun || 5}</dd>
        </div>
        <div className="flex justify-between gap-[12px]">
          <dt className="text-textItemBlur">Saved keyword limit</dt>
          <dd>{status?.maxKeywords || 10}</dd>
        </div>
        <div className="flex justify-between gap-[12px]">
          <dt className="text-textItemBlur">Classification</dt>
          <dd>
            {status?.openAi
              ? 'OpenAI is configured'
              : 'Waiting for OPENAI_API_KEY'}
          </dd>
        </div>
      </dl>
      <ul className="flex flex-col gap-[8px]">
        {sources.map((source) => (
          <li
            key={source.id}
            className="flex items-center justify-between gap-[12px] rounded-[12px] border border-newBorder bg-newBgColorInner px-[14px] py-[10px] text-[14px]"
          >
            <span>{source.label}</span>
            <span
              className={clsx(
                'text-[13px]',
                source.available ? 'text-[#3DDC97]' : 'text-textItemBlur'
              )}
            >
              {source.available ? 'Available' : source.detail}
            </span>
          </li>
        ))}
      </ul>
      <div>
        <Button type="button" loading={running} onClick={checkNow}>
          Check now
        </Button>
      </div>
    </div>
  );
};
