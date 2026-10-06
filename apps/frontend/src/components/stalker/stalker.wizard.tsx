'use client';

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useStalkerProject } from '@gitroom/frontend/components/stalker/stalker.project';
import { SourceIcon } from '@gitroom/frontend/components/stalker/stalker.icons';

const COLORS = [
  { value: '#00D9FF', label: 'Cyan' },
  { value: '#7C5CFF', label: 'Violet' },
  { value: '#FFB020', label: 'Amber' },
  { value: '#FF6B6B', label: 'Coral' },
  { value: '#3DDC97', label: 'Green' },
  { value: '#E8E8E8', label: 'Silver' },
];

const PLATFORM_ORDER = ['x', 'reddit', 'youtube', 'linkedin'];
const EMPTY_SOURCES: Array<{
  id: string;
  label: string;
  available: boolean;
  detail: string;
}> = [];

const DEFAULT_CATEGORIES = [
  {
    name: 'Praise',
    description: 'Someone likes the product or thanks the team.',
  },
  {
    name: 'Bug report',
    description: 'Something is broken or not working as expected.',
  },
  {
    name: 'Feature request',
    description: 'A request for a new capability or improvement.',
  },
  {
    name: 'Complaint',
    description: 'Frustration about the product, support, or experience.',
  },
];

type KeywordDraft = {
  phrase: string;
  youtube: boolean;
  reddit: boolean;
  x: boolean;
  linkedin: boolean;
};

const emptyKeyword = (): KeywordDraft => ({
  phrase: '',
  youtube: true,
  reddit: false,
  x: false,
  linkedin: false,
});

export const StalkerWizard = () => {
  const fetch = useFetch();
  const toaster = useToaster();
  const { status, setProjectId, refreshProjects, setShowWizard, projects } =
    useStalkerProject();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLORS[0].value);
  const [brandName, setBrandName] = useState('');
  const [brandTouched, setBrandTouched] = useState(false);
  const [aliases, setAliases] = useState('');
  const [exclusions, setExclusions] = useState('');
  const [handleX, setHandleX] = useState('');
  const [handleRedditUser, setHandleRedditUser] = useState('');
  const [handleRedditSubreddit, setHandleRedditSubreddit] = useState('');
  const [handleYoutube, setHandleYoutube] = useState('');
  const [handleLinkedin, setHandleLinkedin] = useState('');
  const [handleInstagram, setHandleInstagram] = useState('');
  const [handleFacebook, setHandleFacebook] = useState('');
  const [handlesFilled, setHandlesFilled] = useState(false);
  const [keywords, setKeywords] = useState<KeywordDraft[]>([emptyKeyword()]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [saving, setSaving] = useState(false);

  const sources = status?.sources ?? EMPTY_SOURCES;
  const sourceById = useMemo(() => {
    return new Map(sources.map((source) => [source.id, source]));
  }, [sources]);

  useEffect(() => {
    if (!sources.length) {
      return;
    }
    setKeywords((current) =>
      current.map((keyword) => ({
        ...keyword,
        youtube: sourceById.get('youtube')?.available ? keyword.youtube : false,
        reddit: sourceById.get('reddit')?.available ? keyword.reddit : false,
        x: sourceById.get('x')?.available ? keyword.x : false,
        linkedin: sourceById.get('linkedin')?.available
          ? keyword.linkedin
          : false,
      }))
    );
  }, [sources, sourceById]);

  useEffect(() => {
    const handles = status?.suggestedHandles;
    if (!handles || handlesFilled) {
      return;
    }
    setHandleX((current) => current || handles.x || '');
    setHandleYoutube((current) => current || handles.youtube || '');
    setHandleLinkedin((current) => current || handles.linkedin || '');
    setHandleInstagram((current) => current || handles.instagram || '');
    setHandleFacebook((current) => current || handles.facebook || '');
    setHandlesFilled(true);
  }, [status, handlesFilled]);

  const updateKeyword = (index: number, patch: Partial<KeywordDraft>) => {
    setKeywords((current) =>
      current.map((keyword, keywordIndex) =>
        keywordIndex === index ? { ...keyword, ...patch } : keyword
      )
    );
  };

  const previewPhrase =
    keywords.find((keyword) => keyword.phrase.trim().length >= 2)?.phrase.trim() ||
    'your brand';

  const createProject = async () => {
    setSaving(true);
    const response = await fetch('/stalker/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim(),
        color,
        brandName: (brandName || name).trim(),
        aliases,
        exclusions,
        handleX,
        handleRedditUser,
        handleRedditSubreddit,
        handleYoutube,
        handleLinkedin,
        handleInstagram,
        handleFacebook,
        keywords: keywords
          .map((keyword) => ({
            phrase: keyword.phrase.trim(),
            youtube: keyword.youtube,
            reddit: keyword.reddit,
            x: keyword.x,
            linkedin: keyword.linkedin,
          }))
          .filter((keyword) => keyword.phrase.length >= 2),
        categories: categories
          .map((category) => ({
            name: category.name.trim(),
            description: category.description.trim(),
          }))
          .filter((category) => category.name.length >= 2),
      }),
    });
    setSaving(false);
    if (!response.ok) {
      toaster.show('Could not create the project', 'warning');
      return;
    }
    const created = await response.json();
    refreshProjects();
    if (created?.id) {
      setProjectId(created.id);
    }
    setShowWizard(false);
  };

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-[20px] py-[12px]">
      <div>
        <p className="text-[12px] uppercase tracking-[0.08em] text-[#00D9FF]">
          Set up Stalker
        </p>
        <h1 className="mt-[6px] text-[28px] font-[600]">
          {step === 0
            ? 'Name the brand you want to listen for'
            : step === 1
              ? 'Choose the words to watch'
              : 'Tell the classifier what matters'}
        </h1>
      </div>
      <ol className="flex gap-[8px] text-[13px]">
        {['Project', 'Keywords', 'Categories'].map((label, index) => (
          <li
            key={label}
            className={clsx(
              'rounded-full border px-[12px] py-[6px]',
              index === step
                ? 'border-[#00D9FF] text-[#00D9FF]'
                : 'border-[#2a2a2a] text-textItemBlur'
            )}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <div className="flex flex-col gap-[14px] rounded-[16px] border border-newBorder bg-newBgColorInner p-[18px]">
          <Input
            label="Project name"
            translationKey="label_project_name"
            name="name"
            disableForm={true}
            value={name}
            onChange={(event) => {
              const next = event.target.value;
              setName(next);
              if (!brandTouched) {
                setBrandName(next);
              }
            }}
            placeholder="Crea8one"
          />
          <Input
            label="Brand name"
            translationKey="label_brand_name"
            name="brandName"
            disableForm={true}
            value={brandName}
            onChange={(event) => {
              setBrandTouched(true);
              setBrandName(event.target.value);
            }}
            placeholder="crea8one"
          />
          <label className="flex flex-col gap-[6px] text-[14px]">
            Aliases, one per line
            <textarea
              name="aliases"
              className="min-h-[72px] rounded-[10px] border border-[#2a2a2a] bg-[#141414] px-[12px] py-[10px] text-[14px]"
              value={aliases}
              onChange={(event) => setAliases(event.target.value)}
              placeholder={'crea8 one\ncrea8.one'}
            />
          </label>
          <div className="grid gap-[10px] sm:grid-cols-2">
            <Input label="X handle" translationKey="label_handle_x" name="handleX" disableForm={true} value={handleX} onChange={(event) => setHandleX(event.target.value)} placeholder="crea8one" />
            <Input label="YouTube handle" translationKey="label_handle_youtube" name="handleYoutube" disableForm={true} value={handleYoutube} onChange={(event) => setHandleYoutube(event.target.value)} placeholder="crea8one" />
            <Input label="Reddit username" translationKey="label_handle_reddit_user" name="handleRedditUser" disableForm={true} value={handleRedditUser} onChange={(event) => setHandleRedditUser(event.target.value)} placeholder="crea8one" />
            <Input label="Subreddit" translationKey="label_handle_reddit_subreddit" name="handleRedditSubreddit" disableForm={true} value={handleRedditSubreddit} onChange={(event) => setHandleRedditSubreddit(event.target.value)} placeholder="crea8one" />
            <Input label="LinkedIn company" translationKey="label_handle_linkedin" name="handleLinkedin" disableForm={true} value={handleLinkedin} onChange={(event) => setHandleLinkedin(event.target.value)} placeholder="crea8one" />
            <Input label="Instagram handle" translationKey="label_handle_instagram" name="handleInstagram" disableForm={true} value={handleInstagram} onChange={(event) => setHandleInstagram(event.target.value)} placeholder="crea8one" />
            <Input label="Facebook page" translationKey="label_handle_facebook" name="handleFacebook" disableForm={true} value={handleFacebook} onChange={(event) => setHandleFacebook(event.target.value)} placeholder="crea8one" />
          </div>
          <p className="text-[12px] text-textItemBlur">
            Handles fill from connected channels when Stalker can read them.
          </p>
          <label className="flex flex-col gap-[6px] text-[14px]">
            Negative keywords, one per line
            <textarea
              name="exclusions"
              className="min-h-[72px] rounded-[10px] border border-[#2a2a2a] bg-[#141414] px-[12px] py-[10px] text-[14px]"
              value={exclusions}
              onChange={(event) => setExclusions(event.target.value)}
              placeholder="unrelated brand"
            />
          </label>
          <label className="flex flex-col gap-[6px] text-[14px]">
            Description
            <textarea
              className="min-h-[88px] rounded-[10px] border border-[#2a2a2a] bg-[#141414] px-[12px] py-[10px] text-[14px]"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What this brand or product is, in a sentence."
            />
          </label>
          <div>
            <p className="mb-[8px] text-[14px]">Color</p>
            <div className="flex flex-wrap gap-[8px]">
              {COLORS.map((swatch) => (
                <button
                  key={swatch.value}
                  type="button"
                  aria-label={swatch.label}
                  title={swatch.label}
                  className={clsx(
                    'h-[32px] w-[32px] rounded-full border-2',
                    color === swatch.value
                      ? 'border-white'
                      : 'border-transparent'
                  )}
                  style={{ backgroundColor: swatch.value }}
                  onClick={() => setColor(swatch.value)}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              disabled={name.trim().length < 2}
              onClick={() => setStep(1)}
            >
              Continue
            </Button>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="flex flex-col gap-[14px]">
          {keywords.map((keyword, index) => (
            <div
              key={index}
              className="rounded-[16px] border border-newBorder bg-newBgColorInner p-[16px] flex flex-col gap-[10px]"
            >
              <Input
                label={`Keyword ${index + 1}`}
                translationKey="label_keyword"
                name={`phrase-${index}`}
                disableForm={true}
                value={keyword.phrase}
                onChange={(event) =>
                  updateKeyword(index, { phrase: event.target.value })
                }
                placeholder="crea8one"
              />
              <div className="flex flex-wrap gap-[8px]">
                {PLATFORM_ORDER.map((id) => {
                  const source = sourceById.get(id);
                  const available = !!source?.available;
                  const on = !!keyword[id as keyof KeywordDraft];
                  const note = available
                    ? ''
                    : id === 'linkedin'
                      ? 'Coming soon'
                      : id === 'reddit' || id === 'x'
                        ? 'Needs API access'
                        : source?.detail || 'Unavailable';
                  return (
                    <span key={id} title={note || source?.label || id}>
                      <button
                        type="button"
                        disabled={!available}
                        className={clsx(
                          'rounded-full border px-[10px] py-[4px] text-[12px]',
                          !available && 'cursor-not-allowed opacity-60',
                          on && available
                            ? 'border-[#00D9FF]/40 bg-[#00D9FF]/10 text-[#00D9FF]'
                            : 'border-newBorder text-textItemBlur'
                        )}
                        onClick={() =>
                          updateKeyword(index, {
                            [id]: !on,
                          } as Partial<KeywordDraft>)
                        }
                      >
                        {source?.label || id}
                        {note ? ` · ${note}` : ''}
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
          <button
            type="button"
            className="self-start text-[13px] text-[#00D9FF] underline"
            onClick={() =>
              setKeywords((current) =>
                current.length >= 10 ? current : [...current, emptyKeyword()]
              )
            }
          >
            Add another keyword
          </button>
          <article className="rounded-[16px] border border-dashed border-[#2a2a2a] bg-[#101010] p-[16px]">
            <p className="mb-[8px] text-[12px] uppercase tracking-[0.06em] text-textItemBlur">
              Example mention
            </p>
            <div className="mb-[8px] flex items-center gap-[8px] text-[12px] text-[#00D9FF]">
              <SourceIcon source="REDDIT" />
              <span>Reddit</span>
            </div>
            <p className="text-[15px] leading-[1.5]">
              Has anyone tried {previewPhrase} for scheduling posts? The calendar
              view is the part I keep coming back to.
            </p>
            <p className="mt-[8px] text-[13px] text-textItemBlur">
              A sample of what a match can look like. Nothing is collected until
              the project exists.
            </p>
          </article>
          <div className="flex justify-between">
            <Button type="button" secondary onClick={() => setStep(0)}>
              Back
            </Button>
            <Button
              type="button"
              disabled={
                !keywords.some((keyword) => keyword.phrase.trim().length >= 2)
              }
              onClick={() => setStep(2)}
            >
              Continue
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-[12px]">
          {categories.map((category, index) => (
            <div
              key={index}
              className="rounded-[16px] border border-newBorder bg-newBgColorInner p-[16px] flex flex-col gap-[8px]"
            >
              <div className="flex items-center justify-between gap-[8px]">
                <Input
                  label="Category"
                  translationKey="label_category"
                  name={`category-${index}`}
                  disableForm={true}
                  value={category.name}
                  onChange={(event) =>
                    setCategories((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, name: event.target.value }
                          : item
                      )
                    )
                  }
                />
                <button
                  type="button"
                  className="mt-[22px] text-[13px] text-textItemBlur underline"
                  onClick={() =>
                    setCategories((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index)
                    )
                  }
                >
                  Remove
                </button>
              </div>
              <label className="flex flex-col gap-[6px] text-[14px]">
                Description the AI uses to classify
                <textarea
                  className="min-h-[72px] rounded-[10px] border border-[#2a2a2a] bg-[#141414] px-[12px] py-[10px] text-[14px]"
                  value={category.description}
                  onChange={(event) =>
                    setCategories((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, description: event.target.value }
                          : item
                      )
                    )
                  }
                />
              </label>
            </div>
          ))}
          <button
            type="button"
            className="self-start text-[13px] text-[#00D9FF] underline"
            onClick={() =>
              setCategories((current) =>
                current.length >= 12
                  ? current
                  : [...current, { name: '', description: '' }]
              )
            }
          >
            Add category
          </button>
          <div className="flex justify-between">
            <Button type="button" secondary onClick={() => setStep(1)}>
              Back
            </Button>
            <div className="flex gap-[8px]">
              {projects.length ? (
                <Button
                  type="button"
                  secondary
                  onClick={() => setShowWizard(false)}
                >
                  Cancel
                </Button>
              ) : null}
              <Button
                type="button"
                loading={saving}
                disabled={
                  !categories.some((category) => category.name.trim().length >= 2)
                }
                onClick={createProject}
              >
                Create project
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
