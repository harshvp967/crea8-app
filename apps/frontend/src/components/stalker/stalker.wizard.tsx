'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useStalkerProject } from '@gitroom/frontend/components/stalker/stalker.project';
import { SourceIcon } from '@gitroom/frontend/components/stalker/stalker.icons';
import {
  stkClose,
  stkDialog,
  stkDialogBody,
  stkDialogFoot,
  stkDialogHead,
  stkField,
  stkGhost,
  stkLabel,
  stkOverlay,
  stkPrimary,
  stkSecondary,
} from '@gitroom/frontend/components/stalker/stalker.chrome';

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

const field = stkField;

const CATEGORY_DOT: Record<string, string> = {
  Praise: '#4ade80',
  Complaint: '#fb923c',
  'Bug report': '#f87171',
  'Feature request': '#38bdf8',
};

const categoryDot = (name: string) => CATEGORY_DOT[name] || '#71717a';

const SOURCES = [
  ['x', 'X', 'x', 'X'],
  ['reddit', 'Reddit', 'reddit', 'REDDIT'],
  ['youtube', 'YouTube', 'youtube', 'YOUTUBE'],
  ['linkedin', 'LinkedIn', 'linkedin', 'LINKEDIN'],
] as const;

const Arrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const StepCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
    <path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

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
  const [sourcesOpen, setSourcesOpen] = useState<number | null>(0);
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
    <div className={`${stkOverlay} stk-wiz-overlay`} role="dialog" aria-modal="true" aria-labelledby="stk-wiz-title">
      <div className={`${stkDialog} stk-wiz max-h-[90vh] max-w-[560px]`}>
        <div className={stkDialogHead}>
          <div className="min-w-0 flex-1">
            <h2 id="stk-wiz-title" className="text-[18px] font-[600]">
              Create project
            </h2>
            <ol className="stk-wiz-steps">
              {['Project', 'Keywords', 'Categories'].map((label, index) => (
                <li key={label} className="stk-wiz-stepwrap">
                  <span
                    className={clsx(
                      'stk-wiz-step',
                      index === step && 'is-on',
                      index < step && 'is-done'
                    )}
                  >
                    <span className="stk-wiz-num">{index < step ? <StepCheck /> : index + 1}</span>
                    <span className="stk-wiz-label">{label}</span>
                  </span>
                  {index < 2 ? <span className="stk-wiz-line" /> : null}
                </li>
              ))}
            </ol>
          </div>
          <button type="button" className={stkClose} aria-label="Close" onClick={() => setShowWizard(false)}>
            ×
          </button>
        </div>
        <div className={`${stkDialogBody} stk-wiz-body`}>
          {step === 0 ? (
            <div className="flex flex-col gap-[14px]">
              <label className={`${stkLabel} flex flex-col gap-[6px]`}>
                What are you monitoring?
                <input
                  className={field}
                  placeholder="My product"
                  value={name}
                  autoFocus
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label className={`${stkLabel} flex flex-col gap-[6px]`}>
                Description (optional)
                <input
                  className={field}
                  placeholder="A short summary of what you're monitoring."
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              <div>
                <p className="mb-[8px] text-[14px] font-[500]">Colour</p>
                <div className="stk-set-swatches">
                  {STALKER_SWATCHES.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      aria-label={swatch}
                      aria-pressed={color === swatch}
                      className="stk-set-swatch"
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
              {keywords.map((keyword, index) => (
                <div key={index}>
                  <label className={`${stkLabel} mb-[6px] block`}>Keyword</label>
                  <div className="stk-wiz-keyword">
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
                      className={`${stkSecondary} stk-wiz-sources-btn`}
                      aria-expanded={sourcesOpen === index}
                      onClick={() =>
                        setSourcesOpen((current) => (current === index ? null : index))
                      }
                    >
                      Sources
                    </button>
                  </div>
                  {sourcesOpen === index ? (
                    <ul className="stk-wiz-sources">
                      {SOURCES.map(([id, label, key, icon]) => {
                        const locked = !!note(id);
                        return (
                          <li key={id}>
                            <label className="stk-wiz-source">
                              <input
                                type="checkbox"
                                checked={!!keyword[key]}
                                disabled={locked}
                                onChange={() => toggleSource(index, key)}
                              />
                              <SourceIcon source={icon} className="h-[16px] w-[16px]" />
                              <span className="stk-wiz-source-name">{label}</span>
                              {locked ? <span className="stk-wiz-note">{note(id)}</span> : null}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              ))}
              <button
                type="button"
                className={`${stkGhost} stk-wiz-add self-start`}
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
            <div className="flex flex-col gap-[10px]">
              <p className="stk-wiz-analyze">
                <span className="stk-wiz-spin" aria-hidden />
                AI analyzing…
              </p>
              <ul className="stk-wiz-cats">
                {categories.map((category, index) => (
                  <li key={index} className="stk-wiz-cat">
                    <span
                      className="stk-set-cdot"
                      style={{ backgroundColor: categoryDot(category.name) }}
                      aria-hidden
                    />
                    <div className="stk-wiz-cat-fields">
                      <input
                        className="stk-wiz-cname"
                        aria-label="Category name"
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
                      <input
                        className="stk-wiz-cdesc"
                        aria-label="Category description"
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
                    <button
                      type="button"
                      className="stk-wiz-remove"
                      aria-label={`Remove ${category.name}`}
                      onClick={() =>
                        setCategories((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index)
                        )
                      }
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={`${stkGhost} stk-wiz-add self-start`}
                onClick={() =>
                  setCategories((current) => [
                    ...current,
                    { name: 'New category', description: '' },
                  ])
                }
              >
                + New category
              </button>
            </div>
          ) : null}
        </div>
        <div className={`${stkDialogFoot} stk-wiz-foot`}>
          <button
            type="button"
            className={stkSecondary}
            onClick={() =>
              step === 0 ? setShowWizard(false) : setStep((value) => Math.max(0, value - 1))
            }
          >
            {step === 0 ? 'Close' : 'Back'}
          </button>
          {step < 2 ? (
            <button
              type="button"
              className={stkPrimary}
              disabled={step === 0 && name.trim().length < 2}
              onClick={() => setStep((value) => value + 1)}
            >
              Next
              <Arrow />
            </button>
          ) : (
            <button
              type="button"
              className={stkPrimary}
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
