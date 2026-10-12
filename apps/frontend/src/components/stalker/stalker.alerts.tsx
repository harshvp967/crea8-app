'use client';

import { useMemo, useState } from 'react';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import {
  useStalkerAuthors,
  useStalkerKeywords,
  useStalkerRules,
} from '@gitroom/frontend/components/stalker/stalker.hooks';
import { useStalkerProject } from '@gitroom/frontend/components/stalker/stalker.project';
import { StalkerProjectMenu } from '@gitroom/frontend/components/stalker/stalker.nav';
import { sourceLabel } from '@gitroom/frontend/components/stalker/stalker.labels';
import {
  emptyFilters,
  filtersToView,
  MentionFilters,
  StalkerFilters,
} from '@gitroom/frontend/components/stalker/stalker.filters';
import {
  SAMPLE_AUTHORS,
  SAMPLE_KEYWORDS,
  SAMPLE_RULES,
} from '@gitroom/frontend/components/stalker/stalker.sample';
import {
  stkCard,
  stkClose,
  stkDialog,
  stkDialogBody,
  stkDialogFoot,
  stkDialogHead,
  stkEmpty,
  stkField,
  stkGhost,
  stkIconTile,
  stkLabel,
  stkMenu,
  stkOverlay,
  stkPage,
  stkPrimary,
  stkSecondary,
  stkSub,
  stkTitle,
} from '@gitroom/frontend/components/stalker/stalker.chrome';

const field = stkField;

const ZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Calcutta',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

const digestClock = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

const PlusIcon = () => <HugeIcon name="plus" size={16} />;

type Rule = {
  id: string;
  name: string;
  enabled?: boolean;
  filters?: Record<string, string>;
};

const ruleMeta = (filters?: Record<string, string>) => {
  if (!filters) return '';
  const sources = (filters.sources || '')
    .split(',')
    .filter(Boolean)
    .map((source) => sourceLabel(source))
    .join(', ');
  const sentiment = filters.sentiment
    ? `${filters.sentiment[0]}${filters.sentiment.slice(1).toLowerCase()}`
    : '';
  return [sources, sentiment].filter(Boolean).join(' · ');
};

export const StalkerAlerts = () => {
  const fetch = useFetch();
  const toaster = useToaster();
  const { project, projectId, status, sample, refreshProjects } = useStalkerProject();
  const rulesQuery = useStalkerRules(sample ? null : projectId);
  const keywordsQuery = useStalkerKeywords(sample ? null : projectId);
  const authorsQuery = useStalkerAuthors(sample ? null : projectId);
  const [localRules, setLocalRules] = useState<Rule[]>(SAMPLE_RULES);
  const [digestEnabled, setDigestEnabled] = useState(project ? project.digestEnabled !== false : true);
  const [digestDismissed, setDigestDismissed] = useState(!!project?.digestDismissed);
  const [digestHour, setDigestHour] = useState(typeof project?.digestHour === 'number' ? project.digestHour : 8);
  const [digestTimezone, setDigestTimezone] = useState(project?.digestTimezone || 'UTC');
  const [digestGroupName, setDigestGroupName] = useState(project?.digestGroupName || 'My brand');
  const [configure, setConfigure] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('Negative X posts with traction');
  const [filters, setFilters] = useState<MentionFilters>(emptyFilters());
  const [saving, setSaving] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);

  const digestSignature = [
    project?.id || '',
    project?.digestEnabled,
    project?.digestDismissed,
    project?.digestHour,
    project?.digestTimezone,
    project?.digestGroupName,
  ].join('|');
  const [digestSignatureSeen, setDigestSignatureSeen] = useState(digestSignature);
  if (digestSignatureSeen !== digestSignature) {
    setDigestSignatureSeen(digestSignature);
    setDigestEnabled(project?.digestEnabled !== false);
    setDigestDismissed(!!project?.digestDismissed);
    setDigestHour(typeof project?.digestHour === 'number' ? project.digestHour : 8);
    setDigestTimezone(project?.digestTimezone || 'UTC');
    setDigestGroupName(project?.digestGroupName || 'My brand');
  }

  const rules: Rule[] = sample
    ? localRules
    : Array.isArray(rulesQuery.data)
      ? rulesQuery.data
      : [];
  const keywords = sample
    ? SAMPLE_KEYWORDS
    : Array.isArray(keywordsQuery.data)
      ? keywordsQuery.data
      : [];
  const authors = sample
    ? SAMPLE_AUTHORS
    : Array.isArray(authorsQuery.data)
      ? authorsQuery.data
      : [];
  const categories = project?.categories || [];
  const email = project?.alertEmail || status?.ownerEmail || '';
  const cap = status?.emailCap || 3;
  const zones = useMemo(
    () => (ZONES.includes(digestTimezone) ? ZONES : [digestTimezone, ...ZONES]),
    [digestTimezone]
  );

  const saveDigest = async (patch: Record<string, unknown>) => {
    if (!project) return;
    if (sample) {
      if (typeof patch.digestEnabled === 'boolean') setDigestEnabled(patch.digestEnabled);
      if (typeof patch.digestDismissed === 'boolean') setDigestDismissed(patch.digestDismissed);
      if (typeof patch.digestHour === 'number') setDigestHour(patch.digestHour);
      if (typeof patch.digestTimezone === 'string') setDigestTimezone(patch.digestTimezone);
      if (typeof patch.digestGroupName === 'string') setDigestGroupName(patch.digestGroupName);
      toaster.show('Daily digest updated');
      return;
    }
    const response = await fetch(`/stalker/projects/${project.id}`, {
      method: 'POST',
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      toaster.show('Could not update the daily digest', 'warning');
      return;
    }
    refreshProjects();
  };

  const createRule = async () => {
    const clean = name.trim();
    if (clean.length < 2 || !projectId) return;
    const body = { projectId, name: clean, filters: filtersToView(filters) };
    if (sample) {
      setLocalRules((current) => [
        ...current,
        { id: `rule-${Date.now()}`, name: clean, enabled: true, filters: body.filters },
      ]);
      setCreating(false);
      toaster.show(`Alert created. ${clean} is on.`);
      return;
    }
    setSaving(true);
    const response = await fetch('/stalker/rules', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!response.ok) {
      toaster.show('Could not create that alert', 'warning');
      return;
    }
    setCreating(false);
    setFilters(emptyFilters());
    rulesQuery.mutate();
    toaster.show(`Alert created. ${clean} is on.`);
  };

  const removeRule = async (id: string) => {
    if (sample) {
      setLocalRules((current) => current.filter((rule) => rule.id !== id));
      return;
    }
    await fetch(`/stalker/rules/${id}`, { method: 'DELETE' });
    rulesQuery.mutate();
  };

  const openNew = () => {
    setName('Negative X posts with traction');
    setFilters(emptyFilters());
    setCreating(true);
  };

  const keywordLine = (rule: Rule) => {
    const id = rule.filters?.keywordId;
    if (!id) return 'All keywords';
    const keyword = keywords.find((item: { id: string; phrase: string; group?: { name?: string } | null }) => item.id === id);
    return keyword?.group?.name || keyword?.phrase || 'All keywords';
  };

  const bare = digestDismissed && !rules.length;

  return (
    <div className={`${stkPage} stk-alerts`}>
      <div className="stk-al-head">
        <div className="min-w-0">
          <h1 className={stkTitle}>Alerts</h1>
          {project?.name ? <p className={`${stkSub} hidden md:block`}>{project.name}</p> : null}
          {project?.name ? (
            <button
              type="button"
              className="stk-project-sub"
              aria-haspopup="listbox"
              aria-expanded={projectsOpen}
              onClick={() => setProjectsOpen(true)}
            >
              <span className="stk-pdot" style={{ backgroundColor: project.color || '#71717a' }} />
              <span className="truncate">{project.name}</span>
              <span aria-hidden>▾</span>
            </button>
          ) : null}
        </div>
        {bare ? null : (
          <button type="button" className={`${stkPrimary} stk-al-new`} onClick={openNew}>
            <PlusIcon />
            New alert
          </button>
        )}
      </div>
      {projectsOpen ? (
        <>
          <button
            type="button"
            className="stk-sheet-backdrop"
            aria-label="Close"
            onClick={() => setProjectsOpen(false)}
          />
          <div className={`${stkMenu} stk-project-sheet`} role="listbox">
            <StalkerProjectMenu onPick={() => setProjectsOpen(false)} />
          </div>
        </>
      ) : null}
      {bare ? (
        <section className={`${stkCard} stk-al-empty`}>
          <div className={stkEmpty}>
            <span className={stkIconTile} aria-hidden>
              <HugeIcon name="bell" size={24} />
            </span>
            <h3 className="text-[16px] font-[600]">No alerts yet.</h3>
            <p className="max-w-[360px] text-[14px] text-textItemBlur">
              Create an alert and Stalker will email you when a mention matches.
            </p>
            <button type="button" className={`${stkPrimary} stk-al-new`} onClick={openNew}>
              <PlusIcon />
              New alert
            </button>
          </div>
        </section>
      ) : (
        <>
          {digestDismissed ? (
            <button
              type="button"
              className={stkSecondary}
              onClick={() => saveDigest({ digestDismissed: false, digestEnabled: true })}
            >
              Restore daily digest
            </button>
          ) : (
            <section className="stk-al-digest">
              <span className="stk-al-mail" aria-hidden>
                <HugeIcon name="mail" size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-[600]">Daily digest</p>
                <p className="text-[14px] leading-[1.35] text-textItemBlur">
                  A morning summary of the last 24 hours.
                </p>
                <p className="text-[14px] text-textItemBlur">
                  {digestClock(digestHour)} · {digestTimezone}
                </p>
              </div>
              <button
                type="button"
                className={`${stkSecondary} stk-al-config`}
                onClick={() => setConfigure(true)}
              >
                Configure daily digest
              </button>
              <button
                type="button"
                className="stk-al-icon"
                aria-label="Configure daily digest"
                onClick={() => setConfigure(true)}
              >
                <HugeIcon name="settings" size={18} />
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={digestEnabled}
                aria-label="Daily digest"
                className="stk-switch"
                onClick={() => saveDigest({ digestEnabled: !digestEnabled })}
              >
                <span />
              </button>
            </section>
          )}
          <section className="stk-al-list">
            <h2 className="text-[16px] font-[600]">Custom alerts</h2>
            {!rules.length ? (
              <p className="text-[14px] text-textItemBlur">No custom alerts yet.</p>
            ) : (
              <div className="stk-al-board">
                <div className="stk-al-cols" aria-hidden="true">
                  <span>Alert</span>
                  <span>Keywords</span>
                  <span />
                </div>
                <ul>
                  {rules.map((rule) => {
                    const meta = ruleMeta(rule.filters);
                    return (
                      <li key={rule.id} className="stk-al-card">
                        <p className="stk-al-name">{rule.name}</p>
                        <p className="stk-al-kw">
                          <span className="stk-al-kw-label">Keywords · </span>
                          {keywordLine(rule)}
                        </p>
                        {meta ? <p className="stk-al-meta">{meta}</p> : null}
                        <button
                          type="button"
                          aria-label={`Delete ${rule.name}`}
                          className="stk-al-icon stk-al-delete"
                          onClick={() => removeRule(rule.id)}
                        >
                          <HugeIcon name="trash" size={16} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        </>
      )}

      {configure ? (
        <div className={`${stkOverlay} stk-digest-overlay`}>
          <div className={`${stkDialog} max-w-[480px]`}>
            <div className={stkDialogHead}>
              <div className="min-w-0 flex-1">
                <h2 className="text-[18px] font-[600]">Configure daily digest</h2>
                <p className="mt-[4px] text-[14px] text-textItemBlur">A morning summary of the last 24 hours.</p>
              </div>
              <button type="button" aria-label="Close" className={stkClose} onClick={() => setConfigure(false)}>
                ×
              </button>
            </div>
            <div className={stkDialogBody}>
            <label className={stkLabel}>
              Time
              <span className="stk-digest-field">
                <HugeIcon name="clock" size={16} />
                <select
                  className={field}
                  value={digestHour}
                  onChange={(event) => setDigestHour(Number(event.target.value))}
                >
                  {Array.from({ length: 24 }, (_, hour) => (
                    <option key={hour} value={hour}>
                      {digestClock(hour)}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <label className={stkLabel}>
              Timezone
              <span className="stk-digest-field">
                <HugeIcon name="globe" size={16} />
                <select
                  className={field}
                  value={digestTimezone}
                  onChange={(event) => setDigestTimezone(event.target.value)}
                >
                  {zones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <label className={stkLabel}>
              Keywords
              <select
                className={`${field} mt-[6px]`}
                value={digestGroupName}
                onChange={(event) => setDigestGroupName(event.target.value)}
              >
                {['My brand', 'Competitors', 'All keywords'].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            </div>
            <div className={`${stkDialogFoot} stk-digest-foot`}>
              <button
                type="button"
                className={`${stkGhost} stk-digest-remove text-[color:var(--arc-danger)]`}
                onClick={() => {
                  saveDigest({ digestDismissed: true, digestEnabled: false });
                  setConfigure(false);
                }}
              >
                <span className="stk-digest-remove-long">Remove daily digest</span>
                <span className="stk-digest-remove-short">Remove</span>
              </button>
              <span className="flex-1" />
              <button type="button" className={`${stkSecondary} stk-digest-close`} onClick={() => setConfigure(false)}>
                Close
              </button>
              <button
                type="button"
                className={`${stkPrimary} stk-digest-save`}
                onClick={() => {
                  saveDigest({ digestHour, digestTimezone, digestGroupName, digestEnabled: true });
                  setConfigure(false);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {creating ? (
        <div className={stkOverlay}>
          <div className={`${stkDialog} max-w-[640px]`}>
            <div className={stkDialogHead}>
              <div className="min-w-0 flex-1">
                <h2 className="text-[18px] font-[600]">New alert</h2>
                <p className="mt-[4px] text-[14px] text-textItemBlur">
                  Email you the moment a mention matches these filters.
                </p>
              </div>
              <button type="button" aria-label="Close" className={stkClose} onClick={() => setCreating(false)}>
                ×
              </button>
            </div>
            <div className={stkDialogBody}>
            <label className={stkLabel}>
              Name
              <input className={`${field} mt-[6px]`} value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <p className="text-[14px] font-[500]">Filters</p>
            <StalkerFilters
              filters={filters}
              onChange={setFilters}
              keywords={keywords}
              categories={categories}
              authors={authors}
            />
            <label className={stkLabel}>
              Send to
              <input className={`${field} mt-[6px]`} value={email} readOnly />
            </label>
            <p className="text-[13px] text-textItemBlur">
              Alerts are sent to the workspace owner. Digests and alerts share a limit of {cap} emails per day, resetting at midnight UTC.
            </p>
            </div>
            <div className={`${stkDialogFoot} stk-al-foot`}>
              <button type="button" className={stkSecondary} onClick={() => setCreating(false)}>
                Close
              </button>
              <button
                type="button"
                className={`${stkPrimary} stk-al-new`}
                disabled={saving || name.trim().length < 2}
                onClick={createRule}
              >
                <PlusIcon />
                New alert
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
