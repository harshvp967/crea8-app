'use client';

import { useMemo, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import {
  useStalkerAuthors,
  useStalkerKeywords,
  useStalkerRules,
} from '@gitroom/frontend/components/stalker/stalker.hooks';
import { useStalkerProject } from '@gitroom/frontend/components/stalker/stalker.project';
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
  stkHead,
  stkIconTile,
  stkLabel,
  stkOverlay,
  stkPage,
  stkPrimary,
  stkRow,
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

const hourLabel = (hour: number) => {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const value = hour % 12 || 12;
  return `${value}:00 ${suffix}`;
};

type Rule = {
  id: string;
  name: string;
  enabled?: boolean;
  filters?: Record<string, string>;
};

const summary = (filters?: Record<string, string>) => {
  if (!filters) return '';
  const parts = [
    filters.sources,
    filters.sentiment,
    filters.from ? `from ${filters.from}` : '',
    filters.engagement ? `engagement ${filters.engagement}` : '',
  ].filter(Boolean);
  return parts.join(' · ');
};

export const StalkerAlerts = () => {
  const fetch = useFetch();
  const toaster = useToaster();
  const { project, projectId, status, sample, refreshProjects } = useStalkerProject();
  const rulesQuery = useStalkerRules(sample ? null : projectId);
  const keywordsQuery = useStalkerKeywords(sample ? null : projectId);
  const authorsQuery = useStalkerAuthors(sample ? null : projectId);
  const [localRules, setLocalRules] = useState<Rule[]>(SAMPLE_RULES);
  const [digestEnabled, setDigestEnabled] = useState(true);
  const [digestDismissed, setDigestDismissed] = useState(false);
  const [digestHour, setDigestHour] = useState(8);
  const [digestTimezone, setDigestTimezone] = useState('UTC');
  const [digestGroupName, setDigestGroupName] = useState('My brand');
  const [configure, setConfigure] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('Negative X posts with traction');
  const [filters, setFilters] = useState<MentionFilters>(emptyFilters());
  const [saving, setSaving] = useState(false);

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
  const active = (digestEnabled && !digestDismissed ? 1 : 0) + rules.filter((rule) => rule.enabled !== false).length;
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
      toaster.show('Alert created');
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
    toaster.show('Alert created');
  };

  const removeRule = async (id: string) => {
    if (sample) {
      setLocalRules((current) => current.filter((rule) => rule.id !== id));
      return;
    }
    await fetch(`/stalker/rules/${id}`, { method: 'DELETE' });
    rulesQuery.mutate();
  };

  return (
    <div className={`${stkPage} mx-auto w-full max-w-[860px]`}>
      <div className={stkHead}>
        <div>
          <h1 className={stkTitle}>Alerts</h1>
          <p className={stkSub}>
            {active} active. Digests and alerts share a limit of {cap} emails per day across your workspace. Resets at midnight UTC.
          </p>
        </div>
        <button
          type="button"
          className={stkPrimary}
          onClick={() => {
            setName('Negative X posts with traction');
            setFilters(emptyFilters());
            setCreating(true);
          }}
        >
          + New alert
        </button>
      </div>
      <section>
        <h2 className="text-[16px] font-[600]">Daily digest</h2>
        <p className="mt-[4px] text-[14px] text-textItemBlur">A morning summary of the last 24 hours.</p>
        {digestDismissed ? (
          <button
            type="button"
            className={`${stkSecondary} mt-[12px]`}
            onClick={() => saveDigest({ digestDismissed: false, digestEnabled: true })}
          >
            Restore daily digest
          </button>
        ) : (
          <div className={`${digestEnabled ? 'stk-wave' : ''} mt-[12px] flex flex-wrap items-center justify-between gap-[12px] rounded-[26px] border border-newBorder bg-newBgColorInner px-[16px] py-[14px] shadow-[var(--arc-shadow-resting)]`}>
            <span className={stkIconTile} aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 7l9 7 9-7" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-[600]">Daily digest</p>
              <p className="text-[14px] text-textItemBlur">
                Every day at {hourLabel(digestHour)} · {digestTimezone}
                {email ? ` · ${email}` : ''} · {digestGroupName}
              </p>
            </div>
            <div className="flex items-center gap-[8px]">
              <button
                type="button"
                className={stkSecondary}
                aria-label="Configure daily digest"
                onClick={() => setConfigure(true)}
              >
                Configure
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
              <button
                type="button"
                aria-label="Remove daily digest"
                className={stkGhost}
                onClick={() => saveDigest({ digestDismissed: true, digestEnabled: false })}
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </section>
      <section>
        <h2 className="text-[16px] font-[600]">Custom alerts</h2>
        <p className="mt-[4px] text-[14px] text-textItemBlur">
          Get an email the moment a mention matches your filter.
        </p>
        {!rules.length ? (
          <div className={`${stkCard} mt-[12px]`}>
            <div className={stkEmpty}>
              <span className={stkIconTile} aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 16h12l-1.2-2.2A6 6 0 0012 4a6 6 0 00-4.8 9.8L6 16zM10 18a2 2 0 004 0" />
                </svg>
              </span>
              <h3 className="text-[16px] font-[600]">No custom alerts yet.</h3>
              <p className="max-w-[360px] text-[14px] text-textItemBlur">
                Fire an email when something specific happens — e.g. a negative X post crossing 10 likes.
              </p>
              <button
                type="button"
                className={stkSecondary}
                onClick={() => {
                  setName('Negative X posts with traction');
                  setFilters(emptyFilters());
                  setCreating(true);
                }}
              >
                + New alert
              </button>
            </div>
          </div>
        ) : (
          <ul className="mt-[12px] flex flex-col gap-[8px]">
            {rules.map((rule) => (
              <li key={rule.id} className={stkRow}>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-[600]">{rule.name}</p>
                  <p className="text-[13px] text-textItemBlur">
                    {summary(rule.filters)}
                    {email ? ` · ${email}` : ''}
                  </p>
                </div>
                <button type="button" className={stkGhost} onClick={() => removeRule(rule.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {configure ? (
        <div className={stkOverlay}>
          <div className={`${stkDialog} max-w-[480px]`}>
            <div className={stkDialogHead}>
              <div className="min-w-0 flex-1">
                <h2 className="text-[18px] font-[600]">Daily digest</h2>
                <p className="mt-[4px] text-[14px] text-textItemBlur">A morning summary of the last 24 hours.</p>
              </div>
              <button type="button" aria-label="Close" className={stkClose} onClick={() => setConfigure(false)}>
                ×
              </button>
            </div>
            <div className={stkDialogBody}>
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
            <label className={stkLabel}>
              Delivery time
              <select
                className={`${field} mt-[6px]`}
                value={digestHour}
                onChange={(event) => setDigestHour(Number(event.target.value))}
              >
                {Array.from({ length: 24 }, (_, hour) => (
                  <option key={hour} value={hour}>
                    {hourLabel(hour)}
                  </option>
                ))}
              </select>
            </label>
            <label className={stkLabel}>
              Time zone
              <select
                className={`${field} mt-[6px]`}
                value={digestTimezone}
                onChange={(event) => setDigestTimezone(event.target.value)}
              >
                {zones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
            </label>
            </div>
            <div className={stkDialogFoot}>
              <button
                type="button"
                className={`${stkGhost} text-[color:var(--arc-danger)]`}
                onClick={() => {
                  saveDigest({ digestDismissed: true, digestEnabled: false });
                  setConfigure(false);
                }}
              >
                Remove daily digest
              </button>
              <span className="flex-1" />
              <button type="button" className={stkSecondary} onClick={() => setConfigure(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={stkPrimary}
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
            <div className={stkDialogFoot}>
              <button type="button" className={stkSecondary} onClick={() => setCreating(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={stkPrimary}
                disabled={saving || name.trim().length < 2}
                onClick={createRule}
              >
                Create alert
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
