'use client';

import { useMemo, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useStalkerProject } from '@gitroom/frontend/components/stalker/stalker.project';
import { STALKER_SWATCHES } from '@gitroom/frontend/components/stalker/stalker.wizard';
import { StalkerCheckNow } from '@gitroom/frontend/components/stalker/stalker.check';
import {
  stkCard,
  stkDanger,
  stkField,
  stkGhost,
  stkMenu,
  stkMenuItem,
  stkPage,
  stkPrimary,
  stkSecondary,
  stkSub,
  stkSwatch,
  stkTitle,
} from '@gitroom/frontend/components/stalker/stalker.chrome';

const field = stkField;

type CategoryDraft = { id?: string; name: string; description: string };

type Draft = {
  name: string;
  description: string;
  color: string;
  publicDashboard: boolean;
  categories: CategoryDraft[];
};

const CATEGORY_DOT: Record<string, string> = {
  Praise: '#4ade80',
  Complaint: '#fb923c',
  'Bug report': '#f87171',
  'Feature request': '#38bdf8',
};

const categoryDot = (name: string) => CATEGORY_DOT[name] || '#71717a';

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
  </svg>
);

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
  const [menuIndex, setMenuIndex] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [savedKeySeen, setSavedKeySeen] = useState(savedKey);
  if (savedKeySeen !== savedKey) {
    setSavedKeySeen(savedKey);
    setDraft(saved);
    setConfirmDelete(false);
    setMenuIndex(null);
    setEditing(null);
  }

  if (!project || !draft) {
    return null;
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const sharePath =
    project.publicDashboard && project.publicToken ? `/share/${project.publicToken}` : '';

  const updateCategory = (index: number, patch: Partial<CategoryDraft>) => {
    setDraft({
      ...draft,
      categories: draft.categories.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      ),
    });
  };

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
    <div className={`${stkPage} stk-settings`}>
      <div className="stk-set-head">
        <div className="min-w-0">
          <h1 className={stkTitle}>Project settings</h1>
          {project.name ? <p className={stkSub}>{project.name}</p> : null}
        </div>
        <div className="stk-set-actions">
          <span className="stk-set-check">
            <StalkerCheckNow iconOnly />
          </span>
          {dirty ? (
            <button type="button" className={`${stkGhost} stk-set-discard`} onClick={() => setDraft(saved)}>
              Discard
            </button>
          ) : null}
          <button
            type="button"
            className={`${stkPrimary} stk-set-save`}
            disabled={!dirty || saving}
            onClick={save}
          >
            {dirty ? <span className="stk-set-dot" aria-hidden /> : null}
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      <section className={`${stkCard} stk-set-card`}>
        <label className="stk-set-label">
          Name
          <span>The display name for this project.</span>
          <input
            className={field}
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </label>
        <label className="stk-set-label">
          Description
          <span>A short summary of what you&apos;re monitoring.</span>
          <input
            className={field}
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          />
        </label>
        <div className="stk-set-label">
          <p>Colour</p>
          <span>A visual cue for this project in the bar.</span>
          <div className="stk-set-swatches">
            {STALKER_SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={swatch}
                className={`${stkSwatch(draft.color.toLowerCase() === swatch)} stk-set-swatch`}
                style={{ backgroundColor: swatch }}
                onClick={() => setDraft({ ...draft, color: swatch })}
              />
            ))}
          </div>
        </div>
      </section>

      <section className={`${stkCard} stk-set-card`}>
        <div className="stk-set-cathead">
          <h2>Categories</h2>
          <button
            type="button"
            className={`${stkSecondary} stk-set-new`}
            onClick={() => {
              const next = draft.categories.length;
              setDraft({
                ...draft,
                categories: [...draft.categories, { name: 'New category', description: '' }],
              });
              setEditing(next);
              setMenuIndex(null);
            }}
          >
            <PlusIcon />
            New category
          </button>
        </div>
        <ul className="stk-set-cats">
          {draft.categories.map((category, index) => (
            <li key={category.id || index} className="stk-set-cat">
              {editing === index ? (
                <div className="stk-set-edit">
                  <input
                    className={field}
                    aria-label="Category name"
                    value={category.name}
                    onChange={(event) => updateCategory(index, { name: event.target.value })}
                  />
                  <input
                    className={field}
                    aria-label="Category description"
                    value={category.description}
                    onChange={(event) => updateCategory(index, { description: event.target.value })}
                  />
                </div>
              ) : (
                <>
                  <span className="stk-set-cdot" style={{ backgroundColor: categoryDot(category.name) }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="stk-set-cname">{category.name}</p>
                    {category.description ? <p className="stk-set-cdesc">{category.description}</p> : null}
                  </div>
                </>
              )}
              <div className="relative">
                <button
                  type="button"
                  className="stk-set-more"
                  aria-label={`Actions for ${category.name || 'category'}`}
                  aria-expanded={menuIndex === index}
                  onClick={() => setMenuIndex(menuIndex === index ? null : index)}
                >
                  ···
                </button>
                {menuIndex === index ? (
                  <>
                    <button
                      type="button"
                      className="stk-sheet-backdrop md:hidden"
                      aria-label="Close"
                      onClick={() => setMenuIndex(null)}
                    />
                    <div className={`${stkMenu} stk-set-menu`} role="menu">
                      <p className="stk-set-menu-title">Category actions</p>
                      <button
                        type="button"
                        className={stkMenuItem}
                        onClick={() => {
                          setEditing(index);
                          setMenuIndex(null);
                        }}
                      >
                        Edit
                      </button>
                      <div className="stk-menu-rule" />
                      <button
                        type="button"
                        className={`${stkMenuItem} stk-set-remove`}
                        onClick={() => {
                          setDraft({
                            ...draft,
                            categories: draft.categories.filter((_, itemIndex) => itemIndex !== index),
                          });
                          setMenuIndex(null);
                          if (editing === index) setEditing(null);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={`${stkCard} stk-set-card stk-set-row`}>
        <div className="min-w-0">
          <h2>Public dashboard</h2>
          <p>A read-only Mentions and Analytics page anyone with the link can open.</p>
          {sharePath ? (
            <p className="stk-set-share">
              <a href={sharePath}>{sharePath}</a>
            </p>
          ) : draft.publicDashboard ? (
            <p className="stk-set-note">The public link appears after you save.</p>
          ) : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={draft.publicDashboard}
          aria-label="Public dashboard"
          className="stk-switch"
          onClick={() => setDraft({ ...draft, publicDashboard: !draft.publicDashboard })}
        >
          <span />
        </button>
      </section>

      <section className={`${stkCard} stk-danger-card stk-set-card stk-set-row`}>
        <div className="min-w-0">
          <h2>Delete project</h2>
          <p>Removes this project, its keywords, mentions, and alerts.</p>
        </div>
        {confirmDelete ? (
          <div className="stk-set-confirm">
            <button type="button" className={stkDanger} onClick={remove}>
              Delete this project
            </button>
            <button type="button" className={stkGhost} onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className={`${stkDanger} stk-set-delete`} onClick={() => setConfirmDelete(true)}>
            Delete project
          </button>
        )}
      </section>
    </div>
  );
};
