'use client';

import { Button } from '@gitroom/react/form/button';
import { decodeHtmlEntities } from '@gitroom/helpers/utils/stalker.text';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useStalkerThemes } from '@gitroom/frontend/components/stalker/stalker.hooks';
import { useStalkerComposer } from '@gitroom/frontend/components/stalker/use.stalker.composer';
import { useStalkerProject } from '@gitroom/frontend/components/stalker/stalker.project';

export const StalkerThemes = () => {
  const t = useT();
  const openComposer = useStalkerComposer();
  const { projectId } = useStalkerProject();
  const { data, isLoading } = useStalkerThemes();
  const themes: Array<{
    id: string;
    projectId?: string | null;
    title: string;
    summary: string;
    _count?: { mentions?: number };
    mentions?: Array<{ id: string; authorName?: string; text: string }>;
  }> = (Array.isArray(data) ? data : []).filter(
    (theme) => !projectId || !theme.projectId || theme.projectId === projectId
  );

  return (
    <div className="flex flex-col gap-[16px]">
      <div>
        <h1 className="text-[28px] font-[600]">
          {t('stalker_themes', 'Themes')}
        </h1>
        <p className="mt-[6px] text-[14px] text-textItemBlur">
          Recurring signals from the last 14 days, after mentions are classified.
        </p>
      </div>
      {isLoading ? (
        <p className="text-[14px] text-textItemBlur">Loading themes…</p>
      ) : null}
      {!isLoading && !themes.length ? (
        <p className="text-[14px] text-textItemBlur">
          Themes show up once there are classified mentions and OPENAI_API_KEY is set.
        </p>
      ) : null}
      <div className="flex flex-col gap-[12px]">
        {themes.map((theme) => (
          <article
            key={theme.id}
            className="flex flex-col gap-[10px] rounded-[26px] border border-newBorder bg-newBgColorInner p-[20px] shadow-[var(--arc-shadow-resting)]"
          >
            <div className="flex items-start gap-[12px]">
              <h2 className="text-[18px] font-[600] flex-1">{theme.title}</h2>
              <span className="text-[13px] font-[600] text-[color:var(--arc-accent-text)]">
                {theme._count?.mentions || 0}
              </span>
            </div>
            <p className="text-[14px] leading-[1.5] text-textItemBlur">
              {theme.summary}
            </p>
            <ul className="flex flex-col gap-[6px] text-[13px]">
              {(theme.mentions || []).map((mention) => (
                <li key={mention.id} className="text-textItemBlur">
                  <span className="text-white">{decodeHtmlEntities(mention.authorName || '')}: </span>
                  {decodeHtmlEntities(mention.text)}
                </li>
              ))}
            </ul>
            <div>
              <Button
                type="button"
                onClick={() => openComposer({ themeId: theme.id, mode: 'post' })}
              >
                Draft post
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};
