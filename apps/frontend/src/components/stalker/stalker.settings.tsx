'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useStalkerProject } from '@gitroom/frontend/components/stalker/stalker.project';
import { STALKER_SWATCHES } from '@gitroom/frontend/components/stalker/stalker.wizard';
import { StalkerCheckNow } from '@gitroom/frontend/components/stalker/stalker.check';

const field =
  'w-full rounded-[12px] border border-newBorder bg-newBgColorInner px-[12px] py-[10px] text-[14px] text-newTextColor outline-none focus:border-[#00D9FF]/50';

type CategoryDraft = { id?: string; name: string; description: string };

type Draft = {
  name: string;
  description: string;
  color: string;
  publicDashboard: boolean;
  categories: CategoryDraft[];
};

const icons: Record<string, string> = {
  Praise: '♡',
  'Bug report': '⚙',
  'Feature request': '✦',
  Complaint: '!',
};

export const StalkerSettings = () => {
  const fetch = useFetch();
  const toaster = useToaster();
  const { project, sample, refreshProjects, setProjectId, projects } = useStalkerProject();
  const saved = useMemo<Draft | null>(() => {
    if (!project) return null;
    return {
      name: project.name || '',
      description: project.description || '',
      color: project.color || STALKER_SWATCHES[0],
      publicDashboard: !!project.publicDashboard,
      categories: (project.categories || []).map((category) => ({
        id: category.id,
        name: category.name,
        description: category.description,
      })),
    };
  }, [project]);
  const savedKey = JSON.stringify(saved);
  const [draft, setDraft] = useState<Draft | null>(saved);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [savedKeySeen, setSavedKeySeen] = useState(savedKey);
  if (savedKeySeen !== savedKey) {
    setSavedKeySeen(savedKey);
    setDraft(saved);
    setConfirmDelete(false);
  }

  if (!project || !draft) {
    return null;
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const sharePath =
    project.publicDashboard && project.publicToken ? `/share/${project.publicToken}` : '';

  const save = async () => {
    if (draft.name.trim().length < 2) {
      toaster.show('Give the project a name', 'warning');
      return;
    }
    if (sample) {
      toaster.show('Project settings saved');
      return;
    }
    setSaving(true);
    const projectResponse = await fetch(`/stalker/projects/${project.id}`, {
      method: 'POST',
      body: JSON.stringify({
        name: draft.name.trim(),
        description: draft.description.trim(),
        color: draft.color,
        publicDashboard: draft.publicDashboard,
      }),
    });
    const categoryResponse = await fetch(`/stalker/projects/${project.id}/categories`, {
      method: 'POST',
      body: JSON.stringify({
        categories: draft.categories
          .map((category) => ({
            id: category.id,
            name: category.name.trim(),
            description: category.description.trim(),
          }))
          .filter((category) => category.name.length >= 2),
      }),
    });
    setSaving(false);
    if (!projectResponse.ok || !categoryResponse.ok) {
      toaster.show('Could not save these settings', 'warning');
      return;
    }
    refreshProjects();
    toaster.show('Project settings saved');
  };

  const remove = async () => {
    if (sample) {
      toaster.show('This preview project stays put', 'warning');
      return;
    }
    const response = await fetch(`/stalker/projects/${project.id}`, { method: 'DELETE' });
    if (!response.ok) {
      toaster.show('Could not delete this project', 'warning');
      return;
    }
    const next = projects.find((item) => item.id !== project.id);
    if (next) setProjectId(next.id);
    refreshProjects();
    toaster.show('Project deleted');
  };

  return (
    <div className="relative mx-auto flex w-full max-w-[920px] flex-col px-[20px] py-[24px] pb-[96px]">
      <div className="flex flex-wrap items-center justify-between gap-[12px]">
        <h1 className="text-[22px] font-[600]">Project settings</h1>
        <StalkerCheckNow />
      </div>
      <p className="mt-[6px] text-[14px] text-textItemBlur">
        Manage your project details, categories, and appearance.
      </p>
      <section className="mt-[20px] grid gap-[12px] border-t border-newBorder py-[18px] md:grid-cols-[240px_1fr] md:gap-[24px]">
        <div>
          <h2 className="text-[14px] font-[600]">Name</h2>
          <p className="mt-[4px] text-[13px] text-textItemBlur">The display name for this project.</p>
        </div>
        <input
          className={field}
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
      </section>
      <section className="grid gap-[12px] border-t border-newBorder py-[18px] md:grid-cols-[240px_1fr] md:gap-[24px]">
        <div>
          <h2 className="text-[14px] font-[600]">Description</h2>
          <p className="mt-[4px] text-[13px] text-textItemBlur">A short summary of what you&apos;re monitoring.</p>
        </div>
        <textarea
          className={`${field} min-h-[72px]`}
          value={draft.description}
          onChange={(event) => setDraft({ ...draft, description: event.target.value })}
        />
      </section>
      <section className="grid gap-[12px] border-t border-newBorder py-[18px] md:grid-cols-[240px_1fr] md:gap-[24px]">
        <div>
          <h2 className="text-[14px] font-[600]">Colour</h2>
          <p className="mt-[4px] text-[13px] text-textItemBlur">A visual cue for this project in the bar.</p>
        </div>
        <div className="flex flex-wrap gap-[8px]">
          {STALKER_SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={swatch}
              className={clsx(
                'h-[28px] w-[28px] rounded-full border-2',
                draft.color.toLowerCase() === swatch ? 'border-newTextColor' : 'border-transparent'
              )}
              style={{ backgroundColor: swatch }}
              onClick={() => setDraft({ ...draft, color: swatch })}
            />
          ))}
        </div>
      </section>
      <section className="grid gap-[12px] border-t border-newBorder py-[18px] md:grid-cols-[240px_1fr] md:gap-[24px]">
        <div>
          <h2 className="text-[14px] font-[600]">Categories</h2>
          <p className="mt-[4px] text-[13px] text-textItemBlur">
            How AI organizes your mentions. Edit, remove, or add your own.
          </p>
        </div>
        <div className="flex flex-col gap-[10px]">
          {draft.categories.map((category, index) => (
            <div key={category.id || index} className="flex flex-col gap-[6px]">
              <div className="flex items-center gap-[8px]">
                <span className="w-[18px] text-center text-[14px] text-textItemBlur">
                  {icons[category.name] || '•'}
                </span>
                <input
                  className={field}
                  value={category.name}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      categories: draft.categories.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, name: event.target.value } : item
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  aria-label={`Remove ${category.name}`}
                  className="text-textItemBlur"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      categories: draft.categories.filter((_, itemIndex) => itemIndex !== index),
                    })
                  }
                >
                  ×
                </button>
              </div>
              <input
                className={`${field} ms-[26px]`}
                value={category.description}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    categories: draft.categories.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, description: event.target.value } : item
                    ),
                  })
                }
              />
            </div>
          ))}
          <button
            type="button"
            className="self-start text-[13px] font-[600]"
            onClick={() =>
              setDraft({
                ...draft,
                categories: [...draft.categories, { name: 'New category', description: '' }],
              })
            }
          >
            + Add category
          </button>
        </div>
      </section>
      <section className="grid gap-[12px] border-t border-newBorder py-[18px] md:grid-cols-[240px_1fr] md:gap-[24px]">
        <div>
          <h2 className="text-[14px] font-[600]">Public dashboard</h2>
          <p className="mt-[4px] text-[13px] text-textItemBlur">
            A read-only Mentions and Analytics page anyone with the link can open.
          </p>
        </div>
        <div>
          <button
            type="button"
            role="switch"
            aria-checked={draft.publicDashboard}
            className={`relative h-[24px] w-[42px] rounded-full border ${
              draft.publicDashboard ? 'border-[#00D9FF]/50 bg-[#00D9FF]/20' : 'border-newBorder'
            }`}
            onClick={() => setDraft({ ...draft, publicDashboard: !draft.publicDashboard })}
          >
            <span
              className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-newTextColor transition-all ${
                draft.publicDashboard ? 'start-[20px]' : 'start-[2px]'
              }`}
            />
          </button>
          {sharePath ? (
            <p className="mt-[8px] text-[13px]">
              <a className="text-[#00A3C4] underline" href={sharePath}>
                {sharePath}
              </a>
            </p>
          ) : draft.publicDashboard ? (
            <p className="mt-[8px] text-[13px] text-textItemBlur">The public link appears after you save.</p>
          ) : null}
        </div>
      </section>
      <section className="grid gap-[12px] border-t border-newBorder py-[18px] md:grid-cols-[240px_1fr] md:gap-[24px]">
        <div>
          <h2 className="text-[14px] font-[600]">Delete project</h2>
          <p className="mt-[4px] text-[13px] text-textItemBlur">
            Removes this project, its keywords, mentions, and alerts.
          </p>
        </div>
        {confirmDelete ? (
          <div className="flex flex-wrap items-center gap-[8px]">
            <button
              type="button"
              className="rounded-full bg-[#eb4747] px-[14px] py-[8px] text-[13px] font-[600] text-white"
              onClick={remove}
            >
              Delete this project
            </button>
            <button
              type="button"
              className="text-[13px] text-textItemBlur"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="self-start rounded-full border border-[#eb4747]/50 px-[14px] py-[8px] text-[13px] font-[600] text-[#eb4747]"
            onClick={() => setConfirmDelete(true)}
          >
            Delete project
          </button>
        )}
      </section>
      {dirty ? (
        <div className="sticky bottom-[12px] mt-[8px] flex items-center justify-between gap-[12px] rounded-[16px] border border-newBorder bg-newBgColorInner px-[16px] py-[12px] shadow-[var(--menu-shadow)]">
          <span className="text-[14px] font-[600]">Unsaved changes</span>
          <span className="flex gap-[8px]">
            <button
              type="button"
              className="rounded-full border border-newBorder px-[14px] py-[8px] text-[13px] font-[600]"
              onClick={() => setDraft(saved)}
            >
              Discard
            </button>
            <button
              type="button"
              className="rounded-full bg-newTextColor px-[14px] py-[8px] text-[13px] font-[600] text-newBgColorInner disabled:opacity-40"
              disabled={saving}
              onClick={save}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </span>
        </div>
      ) : null}
    </div>
  );
};
