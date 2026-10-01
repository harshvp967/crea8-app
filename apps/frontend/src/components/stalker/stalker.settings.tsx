'use client';

import { useState } from 'react';
import { Button } from '@gitroom/react/form/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useStalkerStatus } from '@gitroom/frontend/components/stalker/stalker.hooks';

export const StalkerSettings = () => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const { data } = useStalkerStatus();
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

  return (
    <div className="flex flex-col gap-[16px] max-w-[640px]">
      <div>
        <h1 className="text-[28px] font-[600]">
          {t('stalker_settings', 'Settings')}
        </h1>
        <p className="mt-[6px] text-[14px] text-textItemBlur">
          Stalker reads comments on connected YouTube, Instagram, and Facebook channels, and searches public YouTube videos for your keywords.
        </p>
      </div>
      <dl className="rounded-[16px] border border-newBorder bg-newBgColorInner p-[16px] flex flex-col gap-[8px] text-[14px]">
        <div className="flex justify-between gap-[12px]">
          <dt className="text-textItemBlur">Automatic check</dt>
          <dd>Every {data?.pollHours || 6} hours</dd>
        </div>
        <div className="flex justify-between gap-[12px]">
          <dt className="text-textItemBlur">Keywords searched each run</dt>
          <dd>{data?.keywordsSearchedPerRun || 5}</dd>
        </div>
        <div className="flex justify-between gap-[12px]">
          <dt className="text-textItemBlur">Saved keyword limit</dt>
          <dd>{data?.maxKeywords || 10}</dd>
        </div>
        <div className="flex justify-between gap-[12px]">
          <dt className="text-textItemBlur">Classification</dt>
          <dd>{data?.openAi ? 'OpenAI is configured' : 'Waiting for OPENAI_API_KEY'}</dd>
        </div>
      </dl>
      <div>
        <Button type="button" loading={running} onClick={checkNow}>
          Check now
        </Button>
      </div>
    </div>
  );
};
