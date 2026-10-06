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

const field =
  'w-full rounded-[12px] border border-newBorder bg-newBgColorInner px-[12px] py-[10px] text-[14px] text-newTextColor outline-none focus:border-[#00D9FF]/50';

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
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-[18px] px-[20px] py-[24px]">
      <div>
        <h1 className="text-[22px] font-[600]">
          Alerts <span className="text-[14px] font-[500] text-textItemBlur">{active} active</span>
        </h1>
        <p className="mt-[6px] text-[14px] text-textItemBlur">
          Digests and alerts share a limit of {cap} emails per day across your workspace. Resets at midnight UTC.
        </p>
      </div>
      <section>
        <h2 className="text-[16px] font-[600]">Daily digest</h2>
        <p className="mt-[4px] text-[13px] text-textItemBlur">A morning summary of the last 24 hours.</p>
        {digestDismissed ? (
          <button
            type="button"
            className="mt-[12px] rounded-[16px] border border-dashed border-newBorder px-[16px] py-[18px] text-[14px]"
            onClick={() => saveDigest({ digestDismissed: false, digestEnabled: true })}
          >
            Restore daily digest
          </button>
        ) : (
          <div className="mt-[12px] flex flex-wrap items-center justify-between gap-[12px] rounded-[16px] border border-newBorder bg-newBgColorInner px-[16px] py-[14px]">
            <div>
              <p className="text-[14px] font-[600]">Daily digest</p>
              <p className="text-[13px] text-textItemBlur">
                Every day at {hourLabel(digestHour)} · {digestTimezone}
                {email ? ` · ${email}` : ''} · {digestGroupName}
              </p>
            </div>
            <div className="flex items-center gap-[8px]">
              <button
                type="button"
                role="switch"
                aria-checked={digestEnabled}
                aria-label="Daily digest"
                className={`relative h-[24px] w-[42px] rounded-full border ${
                  digestEnabled ? 'border-[#00D9FF]/50 bg-[#00D9FF]/20' : 'border-newBorder'
                }`}
                onClick={() => saveDigest({ digestEnabled: !digestEnabled })}
              >
                <span
                  className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-newTextColor transition-all ${
                    digestEnabled ? 'start-[20px]' : 'start-[2px]'
                  }`}
                />
              </button>
              <button
                type="button"
                aria-label="Configure daily digest"
                className="rounded-full border border-newBorder px-[10px] py-[6px] text-[12px]"
                onClick={() => setConfigure(true)}
              >
                Configure
              </button>
              <button
                type="button"
                aria-label="Remove daily digest"
                className="rounded-full border border-newBorder px-[10px] py-[6px] text-[12px] text-textItemBlur"
                onClick={() => saveDigest({ digestDismissed: true, digestEnabled: false })}
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </section>
      <section>
        <div className="flex items-center justify-between gap-[12px]">
          <h2 className="text-[16px] font-[600]">Custom alerts</h2>
          <button
            type="button"
            className="rounded-full bg-newTextColor px-[14px] py-[8px] text-[13px] font-[600] text-newBgColorInner"
            onClick={() => {
              setName('Negative X posts with traction');
              setFilters(emptyFilters());
              setCreating(true);
            }}
          >
            + New alert
          </button>
        </div>
        <p className="mt-[4px] text-[13px] text-textItemBlur">
          Get an email the moment a mention matches your filter.
        </p>
        {!rules.length ? (
          <div className="mt-[12px] rounded-[16px] border border-dashed border-newBorder px-[16px] py-[28px] text-center">
            <p className="text-[14px] font-[600]">No custom alerts yet.</p>
            <p className="mt-[6px] text-[13px] text-textItemBlur">
              Fire an email when something specific happens — e.g. a negative X post crossing 10 likes.
            </p>
          </div>
        ) : (
          <ul className="mt-[12px] flex flex-col gap-[8px]">
            {rules.map((rule) => (
              <li
                key={rule.id}
                className="flex items-center justify-between gap-[12px] rounded-[16px] border border-newBorder bg-newBgColorInner px-[16px] py-[12px]"
              >
                <div>
                  <p className="text-[14px] font-[600]">{rule.name}</p>
                  <p className="text-[12px] text-textItemBlur">
                    {summary(rule.filters)}
                    {email ? ` · ${email}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-[13px] text-textItemBlur"
                  onClick={() => removeRule(rule.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {configure ? (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-auto bg-black/40 p-[24px]">
          <div className="w-full max-w-[440px] rounded-[20px] border border-newBorder bg-newBgColorInner p-[20px]">
            <div className="mb-[12px] flex items-center justify-between">
              <h2 className="text-[18px] font-[600]">Daily digest</h2>
              <button type="button" aria-label="Close" onClick={() => setConfigure(false)}>
                ×
              </button>
            </div>
            <label className="block text-[13px] font-[600]">
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
            <label className="mt-[12px] block text-[13px] font-[600]">
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
            <label className="mt-[12px] block text-[13px] font-[600]">
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
            <div className="mt-[16px] flex justify-end gap-[8px]">
              <button
                type="button"
                className="rounded-full border border-newBorder px-[14px] py-[8px] text-[13px]"
                onClick={() => setConfigure(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full bg-newTextColor px-[14px] py-[8px] text-[13px] font-[600] text-newBgColorInner"
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
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-auto bg-black/40 p-[24px]">
          <div className="w-full max-w-[640px] rounded-[20px] border border-newBorder bg-newBgColorInner p-[20px]">
            <div className="mb-[8px] flex items-start justify-between">
              <div>
                <h2 className="text-[18px] font-[600]">New alert</h2>
                <p className="mt-[4px] text-[13px] text-textItemBlur">
                  Email you the moment a mention matches these filters.
                </p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setCreating(false)}>
                ×
              </button>
            </div>
            <label className="mt-[12px] block text-[13px] font-[600]">
              Name
              <input className={`${field} mt-[6px]`} value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <p className="mb-[8px] mt-[14px] text-[13px] font-[600]">Filters</p>
            <StalkerFilters
              filters={filters}
              onChange={setFilters}
              keywords={keywords}
              categories={categories}
              authors={authors}
            />
            <label className="mt-[14px] block text-[13px] font-[600]">
              Send to
              <input className={`${field} mt-[6px]`} value={email} readOnly />
            </label>
            <p className="mt-[8px] text-[12px] text-textItemBlur">
              Alerts are sent to the workspace owner. Digests and alerts share a limit of {cap} emails per day, resetting at midnight UTC.
            </p>
            <div className="mt-[16px] flex justify-end gap-[8px]">
              <button
                type="button"
                className="rounded-full border border-newBorder px-[14px] py-[8px] text-[13px]"
                onClick={() => setCreating(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full bg-newTextColor px-[14px] py-[8px] text-[13px] font-[600] text-newBgColorInner disabled:opacity-40"
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
