'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useStalkerProject } from '@gitroom/frontend/components/stalker/stalker.project';

export const STALKER_SWATCHES = [
  '#71717a',
  '#7e47eb',
  '#9947eb',
  '#477eeb',
  '#47b4eb',
  '#47ebb4',
  '#47eb7e',
  '#ebd047',
  '#eb9947',
  '#eb4747',
  '#eb477e',
];

const DEFAULT_CATEGORIES = [
  {
    name: 'Praise',
    description: 'Users expressing positive feedback about the product.',
  },
  {
    name: 'Bug report',
    description: 'Someone reporting something broken or not working.',
  },
  {
    name: 'Feature request',
    description: 'Someone asking for a new feature or improvement.',
  },
  {
    name: 'Complaint',
    description: 'Negative feedback, frustration, or criticism about the product.',
  },
];

type KeywordDraft = {
  phrase: string;
  youtube: boolean;
  reddit: boolean;
  x: boolean;
  linkedin: boolean;
};

type CategoryDraft = { name: string; description: string };

const field =
  'w-full rounded-[12px] border border-newBorder bg-newBgColorInner px-[12px] py-[10px] text-[14px] text-newTextColor outline-none focus:border-[#00D9FF]/50';

export const StalkerWizard = () => {
  const fetch = useFetch();
  const toaster = useToaster();
  const { status, setProjectId, refreshProjects, setShowWizard, sample, watchScan } =
    useStalkerProject();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(STALKER_SWATCHES[0]);
  const [keywords, setKeywords] = useState<KeywordDraft[]>([
    { phrase: '', youtube: true, reddit: false, x: false, linkedin: false },
  ]);
  const [sourcesOpen, setSourcesOpen] = useState<number | null>(null);
  const [categories, setCategories] = useState<CategoryDraft[]>(DEFAULT_CATEGORIES);
  const [saving, setSaving] = useState(false);
  const [seeded, setSeeded] = useState(false);

  const sourceById = useMemo(() => {
    return new Map((status?.sources || []).map((source) => [source.id, source]));
  }, [status]);

  if (step === 1 && !seeded) {
    setSeeded(true);
    setKeywords((current) =>
      current.map((keyword, index) =>
        index === 0 && !keyword.phrase.trim()
          ? { ...keyword, phrase: name.trim() }
          : keyword
      )
    );
  }

  const preview =
    keywords.find((keyword) => keyword.phrase.trim())?.phrase.trim() ||
    name.trim() ||
    'your keyword';

  const note = (id: string) => {
    const source = sourceById.get(id);
    if (id === 'linkedin') return 'Coming soon';
    if (source?.available) return '';
    if (id === 'youtube') return source?.detail || 'Connect a channel';
    return 'Needs API access';
  };

  const toggleSource = (index: number, key: keyof KeywordDraft) => {
    setKeywords((current) =>
      current.map((keyword, keywordIndex) =>
        keywordIndex === index
          ? { ...keyword, [key]: !keyword[key] }
          : keyword
      )
    );
  };

  const createProject = async () => {
    const ready = keywords
      .map((keyword) => ({ ...keyword, phrase: keyword.phrase.trim() }))
      .filter((keyword) => keyword.phrase.length >= 2);
    const named = categories
      .map((category) => ({
        name: category.name.trim(),
        description: category.description.trim(),
      }))
      .filter((category) => category.name.length >= 2);
    if (name.trim().length < 2 || !named.length) {
      return;
    }
    if (sample) {
      toaster.show('Project created');
      setShowWizard(false);
      return;
    }
    setSaving(true);
    const response = await fetch('/stalker/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim(),
        color,
        brandName: name.trim(),
        keywords: ready.length
          ? ready
          : [
              {
                phrase: name.trim(),
                youtube: true,
                reddit: false,
                x: false,
                linkedin: false,
              },
            ],
        categories: named,
        handleX: status?.suggestedHandles?.x || '',
        handleYoutube: status?.suggestedHandles?.youtube || '',
        handleLinkedin: status?.suggestedHandles?.linkedin || '',
        handleInstagram: status?.suggestedHandles?.instagram || '',
        handleFacebook: status?.suggestedHandles?.facebook || '',
      }),
    });
    setSaving(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      toaster.show(payload?.message || 'Could not create the project', 'warning');
      return;
    }
    const created = await response.json();
    refreshProjects();
    if (created?.id) {
      setProjectId(created.id);
      watchScan(created.id);
    }
    setShowWizard(false);
    toaster.show('Scanning now…');
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-[16px]">
      <div className="flex max-h-[90vh] w-full max-w-[640px] flex-col overflow-hidden rounded-[20px] border border-newBorder bg-newBgColorInner shadow-[var(--menu-shadow)]">
        <div className="flex items-center justify-between gap-[12px] px-[20px] pt-[16px]">
          <ol className="flex items-center gap-[8px] text-[13px] font-[600]">
            {['Project', 'Keywords', 'Categories'].map((label, index) => (
              <li key={label} className="flex items-center gap-[8px]">
                <span
                  className={clsx(
                    'flex h-[26px] items-center gap-[6px] rounded-full px-[10px]',
                    index === step
                      ? 'bg-newTextColor text-newBgColorInner'
                      : index < step
                        ? 'text-newTextColor'
                        : 'text-textItemBlur'
                  )}
                >
                  <span
                    className={clsx(
                      'flex h-[18px] w-[18px] items-center justify-center rounded-full text-[11px]',
                      index === step
                        ? 'bg-newBgColorInner text-newTextColor'
                        : 'border border-current'
                    )}
                  >
                    {index < step ? '✓' : index + 1}
                  </span>
                  {label}
                </span>
                {index < 2 ? <span className="text-textItemBlur">—</span> : null}
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="text-[18px] text-textItemBlur"
            aria-label="Close"
            onClick={() => setShowWizard(false)}
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-[20px] py-[16px]">
          {step === 0 ? (
            <div className="flex flex-col gap-[14px]">
              <label className="flex flex-col gap-[6px] text-[13px] font-[600]">
                Name
                <input
                  className={field}
                  placeholder="My product"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-[6px] text-[13px] font-[600]">
                Description
                <input
                  className={field}
                  placeholder="What are you monitoring?"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              <div>
                <p className="mb-[8px] text-[13px] font-[600]">Colour</p>
                <div className="flex flex-wrap gap-[8px]">
                  {STALKER_SWATCHES.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      aria-label={swatch}
                      className={clsx(
                        'h-[28px] w-[28px] rounded-full border-2',
                        color === swatch ? 'border-newTextColor' : 'border-transparent'
                      )}
                      style={{ backgroundColor: swatch }}
                      onClick={() => setColor(swatch)}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          {step === 1 ? (
            <div className="flex flex-col gap-[14px]">
              <article className="rounded-[16px] border border-newBorder p-[14px]">
                <div className="flex items-center gap-[10px]">
                  <span className="flex h-[36px] w-[36px] items-center justify-center rounded-full bg-newBoxHover text-[12px] font-[600]">
                    AC
                  </span>
                  <div>
                    <p className="text-[14px] font-[600]">
                      Alex Chen <span className="text-[#477eeb]">✓</span>
                    </p>
                    <p className="text-[12px] text-textItemBlur">@alexchen</p>
                  </div>
                </div>
                <p className="mt-[10px] text-[14px] leading-[1.5]">
                  Just tried{' '}
                  <span className="rounded-[6px] bg-[#00D9FF]/15 px-[4px]">
                    {preview}
                  </span>{' '}
                  and I&apos;m honestly impressed — the product quality is top-tier.
                  Who else has tried it?
                </p>
                <p className="mt-[8px] text-[12px] text-textItemBlur">
                  8:38 PM · Apr 17, 2026 · 1.2M Views
                </p>
              </article>
              {keywords.map((keyword, index) => (
                <div key={index} className="relative">
                  <label className="mb-[6px] block text-[13px] font-[600]">
                    Keyword
                  </label>
                  <div className="flex items-center gap-[8px]">
                    <input
                      className={field}
                      placeholder="Your brand, product, or phrase"
                      value={keyword.phrase}
                      onChange={(event) =>
                        setKeywords((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, phrase: event.target.value }
                              : item
                          )
                        )
                      }
                    />
                    <button
                      type="button"
                      className="shrink-0 rounded-full border border-newBorder px-[10px] py-[8px] text-[12px] font-[600]"
                      onClick={() =>
                        setSourcesOpen((current) => (current === index ? null : index))
                      }
                    >
                      Sources
                    </button>
                  </div>
                  {sourcesOpen === index ? (
                    <div className="absolute end-0 z-10 mt-[6px] w-[240px] rounded-[14px] border border-newBorder bg-newBgColorInner p-[8px] shadow-[var(--menu-shadow)]">
                      {(
                        [
                          ['youtube', 'YouTube', 'youtube'],
                          ['x', 'X', 'x'],
                          ['reddit', 'Reddit', 'reddit'],
                          ['linkedin', 'LinkedIn', 'linkedin'],
                        ] as const
                      ).map(([id, label, key]) => {
                        const locked = !!note(id);
                        return (
                          <label
                            key={id}
                            className="flex items-center justify-between gap-[8px] rounded-[10px] px-[8px] py-[8px] text-[13px]"
                          >
                            <span className="flex items-center gap-[8px]">
                              <input
                                type="checkbox"
                                checked={!!keyword[key]}
                                disabled={locked}
                                onChange={() => toggleSource(index, key)}
                              />
                              {label}
                            </span>
                            {locked ? (
                              <span className="text-[11px] text-textItemBlur">{note(id)}</span>
                            ) : null}
                          </label>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ))}
              <button
                type="button"
                className="self-start text-[13px] font-[600] text-textItemBlur"
                onClick={() =>
                  setKeywords((current) => [
                    ...current,
                    {
                      phrase: '',
                      youtube: !!sourceById.get('youtube')?.available,
                      reddit: false,
                      x: false,
                      linkedin: false,
                    },
                  ])
                }
              >
                + Add another keyword
              </button>
            </div>
          ) : null}
          {step === 2 ? (
            <div className="flex flex-col gap-[14px]">
              <div className="rounded-[16px] border border-newBorder p-[14px]">
                <p className="text-[14px] italic text-textItemBlur">
                  “Honestly one of the best tools I&apos;ve used this year. Switched
                  from the competitor and haven&apos;t…”
                </p>
                <p className="mt-[8px] text-[12px] text-textItemBlur">AI analyzing…</p>
              </div>
              <div>
                <h2 className="text-[16px] font-[600]">Categories</h2>
                <p className="mt-[4px] text-[13px] text-textItemBlur">
                  AI sorts every mention into a category. The more detail you add to
                  each description, the more accurate the categorization.
                </p>
              </div>
              {categories.map((category, index) => (
                <div key={index} className="flex flex-col gap-[6px]">
                  <div className="flex items-center gap-[8px]">
                    <input
                      className={field}
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
                      className="text-textItemBlur"
                      aria-label={`Remove ${category.name}`}
                      onClick={() =>
                        setCategories((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index)
                        )
                      }
                    >
                      ×
                    </button>
                  </div>
                  <input
                    className={field}
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
                </div>
              ))}
              <button
                type="button"
                className="self-start text-[13px] font-[600]"
                onClick={() =>
                  setCategories((current) => [
                    ...current,
                    { name: 'New category', description: '' },
                  ])
                }
              >
                + Add category
              </button>
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-between border-t border-newBorder px-[20px] py-[14px]">
          <button
            type="button"
            className="rounded-full border border-newBorder px-[14px] py-[8px] text-[13px] font-[600] disabled:opacity-40"
            disabled={step === 0}
            onClick={() => setStep((value) => Math.max(0, value - 1))}
          >
            Back
          </button>
          {step < 2 ? (
            <button
              type="button"
              className="rounded-full bg-newTextColor px-[16px] py-[8px] text-[13px] font-[600] text-newBgColorInner disabled:opacity-40"
              disabled={step === 0 && name.trim().length < 2}
              onClick={() => setStep((value) => value + 1)}
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              className="rounded-full bg-newTextColor px-[16px] py-[8px] text-[13px] font-[600] text-newBgColorInner disabled:opacity-40"
              disabled={saving || !categories.some((category) => category.name.trim().length >= 2)}
              onClick={createProject}
            >
              {saving ? 'Creating…' : 'Create project'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
