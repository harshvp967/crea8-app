'use client';

import { useMemo, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import {
  useStalkerGroups,
  useStalkerKeywords,
} from '@gitroom/frontend/components/stalker/stalker.hooks';
import { useStalkerProject } from '@gitroom/frontend/components/stalker/stalker.project';
import { SourceIcon } from '@gitroom/frontend/components/stalker/stalker.icons';
import {
  SAMPLE_GROUPS,
  SAMPLE_KEYWORDS,
} from '@gitroom/frontend/components/stalker/stalker.sample';

const field =
  'w-full rounded-[12px] border border-newBorder bg-newBgColorInner px-[12px] py-[10px] text-[14px] text-newTextColor outline-none focus:border-[#00D9FF]/50';

const SOURCES = [
  { id: 'x', label: 'X', key: 'listenX' as const, icon: 'X' },
  { id: 'reddit', label: 'Reddit', key: 'listenReddit' as const, icon: 'REDDIT' },
  { id: 'youtube', label: 'YouTube', key: 'listenYoutube' as const, icon: 'YOUTUBE' },
  { id: 'linkedin', label: 'LinkedIn', key: 'listenLinkedin' as const, icon: 'LINKEDIN' },
];

type Keyword = {
  id: string;
  phrase: string;
  listenYoutube: boolean;
  listenReddit: boolean;
  listenX: boolean;
  listenLinkedin: boolean;
  groupId?: string | null;
  group?: { id: string; name: string } | null;
  excludeAccounts?: string;
  mentions30d?: number;
  sparkline?: number[];
  lastScan?: string | null;
};

type Group = {
  id: string;
  name: string;
  position?: number;
  _count?: { keywords: number };
};

const ago = (iso?: string | null) => {
  if (!iso) return 'Not yet';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 2) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

const Spark = ({ values }: { values: number[] }) => {
  const series = values.length ? values : [0];
  const max = Math.max(1, ...series);
  const width = 72;
  const height = 22;
  const points = series
    .map((value, index) => {
      const x = (index / Math.max(1, series.length - 1)) * width;
      const y = height - (value / max) * (height - 2) - 1;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} aria-hidden className="text-textItemBlur">
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={points} />
    </svg>
  );
};

const PreviewPost = ({ phrase }: { phrase: string }) => (
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
        {phrase || 'your keyword'}
      </span>{' '}
      and I&apos;m honestly impressed — the product quality is top-tier. Who else has tried it?
    </p>
    <p className="mt-[8px] text-[12px] text-textItemBlur">
      8:38 PM · Apr 17, 2026 · 1.2M Views
    </p>
  </article>
);

export const StalkerKeywords = () => {
  const fetch = useFetch();
  const toaster = useToaster();
  const { projectId, sample, status, addKeywordSignal } = useStalkerProject();
  const groupsQuery = useStalkerGroups(sample ? null : projectId);
  const keywordsQuery = useStalkerKeywords(sample ? null : projectId);
  const [localGroups, setLocalGroups] = useState<Group[]>(SAMPLE_GROUPS);
  const [localKeywords, setLocalKeywords] = useState<Keyword[]>(SAMPLE_KEYWORDS);
  const [addOpen, setAddOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [presetGroup, setPresetGroup] = useState('');
  const [phrase, setPhrase] = useState('');
  const [groupId, setGroupId] = useState('');
  const [exclude, setExclude] = useState('');
  const [sourcesOn, setSourcesOn] = useState({
    youtube: true,
    reddit: false,
    x: false,
    linkedin: false,
  });
  const [sourcesMenu, setSourcesMenu] = useState(false);
  const [filtersMenu, setFiltersMenu] = useState(false);
  const [rowMenu, setRowMenu] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [saving, setSaving] = useState(false);

  const groups: Group[] = sample
    ? localGroups
    : Array.isArray(groupsQuery.data)
      ? groupsQuery.data
      : [];
  const keywords: Keyword[] = sample
    ? localKeywords
    : Array.isArray(keywordsQuery.data)
      ? keywordsQuery.data
      : [];

  const sourceById = useMemo(
    () => new Map((status?.sources || []).map((source) => [source.id, source])),
    [status]
  );

  const note = (id: string) => {
    const source = sourceById.get(id);
    if (id === 'linkedin') return 'Coming soon';
    if (source?.available) return '';
    if (id === 'youtube') return source?.detail || 'Connect a channel';
    return 'Needs API access';
  };

  const [seenSignal, setSeenSignal] = useState(addKeywordSignal);
  if (seenSignal !== addKeywordSignal) {
    setSeenSignal(addKeywordSignal);
    if (addKeywordSignal) {
      setPresetGroup('');
      setGroupId('');
      setPhrase('');
      setExclude('');
      setAddOpen(true);
    }
  }
  const resolvedGroup =
    groupId || groups.find((group) => group.name === 'My brand')?.id || groups[0]?.id || '';

  const openAdd = (group?: string) => {
    setPresetGroup(group || '');
    setGroupId(group || groups.find((item) => item.name === 'My brand')?.id || groups[0]?.id || '');
    setPhrase('');
    setExclude('');
    setSourcesOn({ youtube: true, reddit: false, x: false, linkedin: false });
    setAddOpen(true);
  };

  const refresh = () => {
    keywordsQuery.mutate();
    groupsQuery.mutate();
  };

  const addKeyword = async () => {
    const clean = phrase.trim();
    if (clean.length < 2) return;
    if (sample) {
      setLocalKeywords((current) => [
        ...current,
        {
          id: `kw-${Date.now()}`,
          phrase: clean,
          listenYoutube: sourcesOn.youtube,
          listenReddit: sourcesOn.reddit,
          listenX: sourcesOn.x,
          listenLinkedin: sourcesOn.linkedin,
          groupId: resolvedGroup,
          group: groups.find((group) => group.id === resolvedGroup) || null,
          excludeAccounts: exclude,
          mentions30d: 0,
          sparkline: Array.from({ length: 30 }, () => 0),
          lastScan: null,
        },
      ]);
      setAddOpen(false);
      toaster.show('Keyword added');
      return;
    }
    setSaving(true);
    const response = await fetch('/stalker/keywords', {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        phrase: clean,
        groupId: resolvedGroup,
        excludeAccounts: exclude,
        youtube: sourcesOn.youtube && !note('youtube'),
        reddit: sourcesOn.reddit && !note('reddit'),
        x: sourcesOn.x && !note('x'),
        linkedin: false,
      }),
    });
    setSaving(false);
    if (!response.ok) {
      toaster.show('Could not add that keyword', 'warning');
      return;
    }
    setAddOpen(false);
    refresh();
    toaster.show('Keyword added');
  };

  const patchKeyword = async (keyword: Keyword, body: Record<string, unknown>) => {
    if (sample) {
      setLocalKeywords((current) =>
        current.map((item) => {
          if (item.id !== keyword.id) return item;
          const next = { ...item, ...body } as Keyword;
          if (typeof body.groupId === 'string') {
            next.group = groups.find((group) => group.id === body.groupId) || item.group;
          }
          if (typeof body.youtube === 'boolean') next.listenYoutube = body.youtube;
          if (typeof body.reddit === 'boolean') next.listenReddit = body.reddit;
          if (typeof body.x === 'boolean') next.listenX = body.x;
          if (typeof body.linkedin === 'boolean') next.listenLinkedin = body.linkedin;
          if (typeof body.excludeAccounts === 'string') {
            next.excludeAccounts = body.excludeAccounts;
          }
          return next;
        })
      );
      return;
    }
    const response = await fetch(`/stalker/keywords/${keyword.id}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      toaster.show('Could not update that keyword', 'warning');
      return;
    }
    refresh();
  };

  const removeKeyword = async (id: string) => {
    if (sample) {
      setLocalKeywords((current) => current.filter((item) => item.id !== id));
      return;
    }
    await fetch(`/stalker/keywords/${id}`, { method: 'DELETE' });
    refresh();
  };

  const addGroup = async () => {
    const name = groupName.trim();
    if (name.length < 2 || !projectId) return;
    if (sample) {
      setLocalGroups((current) => [
        ...current,
        { id: `group-${Date.now()}`, name, _count: { keywords: 0 } },
      ]);
      setGroupName('');
      return;
    }
    const response = await fetch('/stalker/groups', {
      method: 'POST',
      body: JSON.stringify({ projectId, name }),
    });
    if (!response.ok) {
      toaster.show('Could not add that group', 'warning');
      return;
    }
    setGroupName('');
    groupsQuery.mutate();
  };

  const removeGroup = async (group: Group) => {
    if (group.name === 'My brand' || group.name === 'Competitors') return;
    if (sample) {
      setLocalGroups((current) => current.filter((item) => item.id !== group.id));
      return;
    }
    const response = await fetch(
      `/stalker/groups/${group.id}?projectId=${encodeURIComponent(projectId || '')}`,
      { method: 'DELETE' }
    );
    if (!response.ok) {
      toaster.show('Move the keywords out of this group first', 'warning');
      return;
    }
    groupsQuery.mutate();
  };

  const ordered = [...groups].sort((left, right) => (left.position || 0) - (right.position || 0));

  return (
    <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-[16px] px-[20px] py-[24px]">
      <div className="flex flex-wrap items-center justify-between gap-[12px]">
        <h1 className="text-[22px] font-[600]">
          Keywords{' '}
          <span className="text-[14px] font-[500] text-textItemBlur">
            {keywords.length} active in this project
          </span>
        </h1>
        <div className="flex items-center gap-[8px]">
          <button
            type="button"
            className="rounded-full border border-newBorder px-[14px] py-[8px] text-[13px] font-[600]"
            onClick={() => setGroupsOpen(true)}
          >
            Manage groups
          </button>
          <button
            type="button"
            className="rounded-full bg-newTextColor px-[14px] py-[8px] text-[13px] font-[600] text-newBgColorInner"
            onClick={() => openAdd(presetGroup)}
          >
            + Add keyword
          </button>
        </div>
      </div>
      {ordered.map((group) => {
        const rows = keywords.filter(
          (keyword) =>
            keyword.groupId === group.id || keyword.group?.id === group.id || keyword.group?.name === group.name
        );
        return (
          <section
            key={group.id}
            className="overflow-hidden rounded-[16px] border border-newBorder bg-newBgColorInner"
          >
            <div className="flex items-center justify-between px-[16px] py-[12px]">
              <h2 className="text-[15px] font-[600]">{group.name}</h2>
              <button
                type="button"
                className="text-[13px] font-[600] text-textItemBlur"
                onClick={() => openAdd(group.id)}
              >
                + Add keyword
              </button>
            </div>
            {rows.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-[13px]">
                  <thead className="text-[11px] uppercase tracking-[0.04em] text-textItemBlur">
                    <tr className="border-t border-newBorder">
                      <th className="px-[16px] py-[8px] font-[600]">Keyword</th>
                      <th className="px-[12px] py-[8px] font-[600]">Sources</th>
                      <th className="px-[12px] py-[8px] font-[600]">Mentions (30d)</th>
                      <th className="px-[12px] py-[8px] font-[600]">Last scan</th>
                      <th className="px-[12px] py-[8px]" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((keyword) => (
                      <tr key={keyword.id} className="border-t border-newBorder">
                        <td className="px-[16px] py-[12px] font-[600]">{keyword.phrase}</td>
                        <td className="px-[12px] py-[12px]">
                          <span className="inline-flex items-center gap-[6px]">
                            {SOURCES.map((source) =>
                              keyword[source.key] ? (
                                <span key={source.id} title={source.label} className="text-newTextColor">
                                  <SourceIcon source={source.icon} />
                                </span>
                              ) : null
                            )}
                            <button
                              type="button"
                              aria-label="Change sources"
                              className="rounded-full border border-newBorder px-[6px] text-[11px] text-textItemBlur"
                              onClick={() =>
                                setRowMenu((current) =>
                                  current === `src-${keyword.id}` ? null : `src-${keyword.id}`
                                )
                              }
                            >
                              ▾
                            </button>
                            <button
                              type="button"
                              aria-label="Exclude accounts"
                              className="text-textItemBlur"
                              onClick={() =>
                                setRowMenu((current) =>
                                  current === `ex-${keyword.id}` ? null : `ex-${keyword.id}`
                                )
                              }
                            >
                              ▽
                            </button>
                          </span>
                          {rowMenu === `src-${keyword.id}` ? (
                            <div className="mt-[6px] w-[220px] rounded-[12px] border border-newBorder bg-newBgColorInner p-[6px] shadow-[var(--menu-shadow)]">
                              {SOURCES.map((source) => {
                                const locked = !!note(source.id) && !keyword[source.key];
                                return (
                                  <label
                                    key={source.id}
                                    className="flex items-center justify-between gap-[8px] px-[8px] py-[6px]"
                                  >
                                    <span className="flex items-center gap-[8px]">
                                      <input
                                        type="checkbox"
                                        checked={keyword[source.key]}
                                        disabled={locked}
                                        onChange={() =>
                                          patchKeyword(keyword, {
                                            youtube: keyword.listenYoutube,
                                            reddit: keyword.listenReddit,
                                            x: keyword.listenX,
                                            linkedin: keyword.listenLinkedin,
                                            [source.id]: !keyword[source.key],
                                          })
                                        }
                                      />
                                      {source.label}
                                    </span>
                                    {note(source.id) ? (
                                      <span className="text-[11px] text-textItemBlur">{note(source.id)}</span>
                                    ) : null}
                                  </label>
                                );
                              })}
                            </div>
                          ) : null}
                          {rowMenu === `ex-${keyword.id}` ? (
                            <div className="mt-[6px] w-[240px] rounded-[12px] border border-newBorder bg-newBgColorInner p-[8px]">
                              <p className="mb-[6px] text-[12px] font-[600]">Exclude accounts</p>
                              <input
                                className={field}
                                placeholder="@handle"
                                defaultValue={keyword.excludeAccounts || ''}
                                onBlur={(event) =>
                                  patchKeyword(keyword, { excludeAccounts: event.target.value })
                                }
                              />
                            </div>
                          ) : null}
                        </td>
                        <td className="px-[12px] py-[12px]">
                          <span className="inline-flex items-center gap-[8px]">
                            <Spark values={keyword.sparkline || []} />
                            <span>{keyword.mentions30d || 0}</span>
                          </span>
                        </td>
                        <td className="px-[12px] py-[12px] text-textItemBlur">{ago(keyword.lastScan)}</td>
                        <td className="px-[12px] py-[12px] text-end">
                          <button
                            type="button"
                            aria-label="Keyword actions"
                            className="text-textItemBlur"
                            onClick={() =>
                              setRowMenu((current) => (current === keyword.id ? null : keyword.id))
                            }
                          >
                            ···
                          </button>
                          {rowMenu === keyword.id ? (
                            <div className="mt-[6px] inline-flex flex-col items-stretch rounded-[12px] border border-newBorder bg-newBgColorInner p-[6px] text-start shadow-[var(--menu-shadow)]">
                              <label className="px-[8px] py-[4px] text-[12px] text-textItemBlur">
                                Group
                                <select
                                  className="mt-[4px] w-full rounded-[8px] border border-newBorder bg-newBgColorInner px-[8px] py-[6px] text-[13px] text-newTextColor"
                                  value={keyword.groupId || keyword.group?.id || ''}
                                  onChange={(event) => {
                                    patchKeyword(keyword, { groupId: event.target.value });
                                    setRowMenu(null);
                                  }}
                                >
                                  {groups.map((item) => (
                                    <option key={item.id} value={item.id}>
                                      {item.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <button
                                type="button"
                                className="rounded-[8px] px-[8px] py-[6px] text-start text-[13px] text-[#eb4747]"
                                onClick={() => {
                                  removeKeyword(keyword.id);
                                  setRowMenu(null);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="border-t border-newBorder px-[16px] py-[28px] text-center text-[13px] text-textItemBlur">
                No keywords in this group yet.
              </p>
            )}
          </section>
        );
      })}

      {addOpen ? (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-auto bg-black/40 p-[24px]">
          <div className="w-full max-w-[520px] rounded-[20px] border border-newBorder bg-newBgColorInner p-[20px] shadow-[var(--menu-shadow)]">
            <div className="mb-[8px] flex items-start justify-between">
              <div>
                <h2 className="text-[18px] font-[600]">Add keyword</h2>
                <p className="mt-[4px] text-[13px] text-textItemBlur">
                  Keywords are matched against posts on the sources you select.
                </p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setAddOpen(false)}>
                ×
              </button>
            </div>
            <label className="mt-[12px] block text-[13px] font-[600]">
              Keyword
              <div className="mt-[6px] flex items-center gap-[8px]">
                <input
                  className={field}
                  placeholder="Your brand, product, or phrase"
                  value={phrase}
                  onChange={(event) => setPhrase(event.target.value)}
                />
                <button
                  type="button"
                  className="shrink-0 rounded-full border border-newBorder px-[10px] py-[8px] text-[12px]"
                  onClick={() => {
                    setSourcesMenu((value) => !value);
                    setFiltersMenu(false);
                  }}
                >
                  Sources
                </button>
                <button
                  type="button"
                  aria-label="Filters"
                  className="shrink-0 rounded-full border border-newBorder px-[10px] py-[8px] text-[12px]"
                  onClick={() => {
                    setFiltersMenu((value) => !value);
                    setSourcesMenu(false);
                  }}
                >
                  ▽
                </button>
              </div>
            </label>
            {sourcesMenu ? (
              <div className="mt-[8px] rounded-[12px] border border-newBorder p-[8px]">
                {SOURCES.map((source) => {
                  const locked = !!note(source.id);
                  const key = source.id as keyof typeof sourcesOn;
                  return (
                    <label
                      key={source.id}
                      className="flex items-center justify-between px-[8px] py-[6px] text-[13px]"
                    >
                      <span className="flex items-center gap-[8px]">
                        <input
                          type="checkbox"
                          checked={sourcesOn[key]}
                          disabled={locked}
                          onChange={() =>
                            setSourcesOn((current) => ({ ...current, [key]: !current[key] }))
                          }
                        />
                        {source.label}
                      </span>
                      {locked ? <span className="text-[11px] text-textItemBlur">{note(source.id)}</span> : null}
                    </label>
                  );
                })}
              </div>
            ) : null}
            {filtersMenu ? (
              <div className="mt-[8px] rounded-[12px] border border-newBorder p-[10px]">
                <p className="mb-[6px] text-[13px] font-[600]">Filters</p>
                <p className="mb-[6px] text-[12px] text-textItemBlur">Exclude accounts</p>
                <input
                  className={field}
                  placeholder="@handle"
                  value={exclude}
                  onChange={(event) => setExclude(event.target.value)}
                />
              </div>
            ) : null}
            <label className="mt-[12px] block text-[13px] font-[600]">
              Group
              <select
                className={`${field} mt-[6px]`}
                value={resolvedGroup}
                onChange={(event) => setGroupId(event.target.value)}
              >
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-[14px]">
              <p className="mb-[6px] text-[11px] uppercase tracking-[0.04em] text-textItemBlur">Preview</p>
              <PreviewPost phrase={phrase.trim()} />
            </div>
            <div className="mt-[14px] flex justify-end">
              <button
                type="button"
                className="rounded-full bg-newTextColor px-[14px] py-[8px] text-[13px] font-[600] text-newBgColorInner disabled:opacity-40"
                disabled={saving || phrase.trim().length < 2}
                onClick={addKeyword}
              >
                Add keyword
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {groupsOpen ? (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-auto bg-black/40 p-[24px]">
          <div className="w-full max-w-[440px] rounded-[20px] border border-newBorder bg-newBgColorInner p-[20px]">
            <div className="mb-[12px] flex items-center justify-between">
              <h2 className="text-[18px] font-[600]">Manage groups</h2>
              <button type="button" aria-label="Close" onClick={() => setGroupsOpen(false)}>
                ×
              </button>
            </div>
            <ul className="flex flex-col gap-[8px]">
              {groups.map((group) => {
                const count = keywords.filter(
                  (keyword) => keyword.groupId === group.id || keyword.group?.name === group.name
                ).length;
                const locked = group.name === 'My brand' || group.name === 'Competitors';
                return (
                  <li
                    key={group.id}
                    className="flex items-center justify-between rounded-[12px] border border-newBorder px-[12px] py-[8px] text-[14px]"
                  >
                    <span>
                      {group.name}{' '}
                      <span className="text-textItemBlur">
                        {count} {count === 1 ? 'keyword' : 'keywords'}
                      </span>
                    </span>
                    {locked ? null : (
                      <button
                        type="button"
                        className="text-[12px] text-textItemBlur"
                        onClick={() => removeGroup(group)}
                      >
                        Remove
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="mt-[12px] flex gap-[8px]">
              <input
                className={field}
                placeholder="New group name"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
              />
              <button
                type="button"
                className="shrink-0 rounded-full border border-newBorder px-[12px] text-[13px] font-[600]"
                onClick={addGroup}
              >
                Add group
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
