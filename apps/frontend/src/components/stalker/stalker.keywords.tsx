'use client';

import { useMemo, useState } from 'react';
import { useSWRConfig } from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import {
  useStalkerGroups,
  useStalkerKeywords,
} from '@gitroom/frontend/components/stalker/stalker.hooks';
import { useStalkerProject } from '@gitroom/frontend/components/stalker/stalker.project';
import { SourceIcon } from '@gitroom/frontend/components/stalker/stalker.icons';
import { ReconnectText, StalkerCheckNow } from '@gitroom/frontend/components/stalker/stalker.check';
import { sourceLabel } from '@gitroom/frontend/components/stalker/stalker.labels';
import {
  SAMPLE_GROUPS,
  SAMPLE_KEYWORDS,
} from '@gitroom/frontend/components/stalker/stalker.sample';
import {
  stkBadge,
  stkBadgeBad,
  stkClose,
  stkDanger,
  stkDialog,
  stkDialogBody,
  stkDialogFoot,
  stkDialogHead,
  stkEmpty,
  stkField,
  stkGhost,
  stkGroup,
  stkHead,
  stkIconTile,
  stkLabel,
  stkMenu,
  stkMenuItem,
  stkOverlay,
  stkPage,
  stkPrimary,
  stkRow,
  stkSecondary,
  stkSub,
  stkTitle,
} from '@gitroom/frontend/components/stalker/stalker.chrome';

const field = stkField;

const SOURCES = [
  { id: 'x', label: sourceLabel('x'), key: 'listenX' as const, icon: 'X' },
  { id: 'reddit', label: sourceLabel('reddit'), key: 'listenReddit' as const, icon: 'REDDIT' },
  { id: 'youtube', label: sourceLabel('youtube'), key: 'listenYoutube' as const, icon: 'YOUTUBE' },
  { id: 'linkedin', label: sourceLabel('linkedin'), key: 'listenLinkedin' as const, icon: 'LINKEDIN' },
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
  lastError?: string | null;
  nextScanAt?: string | null;
  paused?: boolean;
  brand?: boolean;
  scanning?: boolean;
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

const nextScanLabel = (iso?: string | null) => {
  if (!iso) return '';
  const delta = new Date(iso).getTime() - Date.now();
  if (delta < 2 * 60 * 1000) return 'Next scan soon';
  const minutes = Math.round(delta / 60000);
  if (minutes < 60) return `Next scan in ${Math.max(1, minutes)}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `Next scan in ${hours}h`;
  return `Next scan in ${Math.round(hours / 24)}d`;
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
  <article className="rounded-[20px] border border-newBorder bg-newBoxHover p-[14px]">
    <div className="flex items-center gap-[10px]">
      <span className="flex h-[36px] w-[36px] items-center justify-center rounded-full bg-newBoxHover text-[12px] font-[600]">
        AC
      </span>
      <div>
        <p className="text-[14px] font-[600]">
          Alex Chen <span className="text-[color:var(--arc-accent-text)]">✓</span>
        </p>
        <p className="text-[12px] text-textItemBlur">@alexchen</p>
      </div>
    </div>
    <p className="mt-[10px] text-[14px] leading-[1.5]">
      Just tried{' '}
      <span className="rounded-[6px] bg-[var(--arc-selected)] px-[4px] font-[600]">
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
  const { projectId, sample, status, addKeywordSignal, scanning, watchScan, previewScan } =
    useStalkerProject();
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
  const [confirmDelete, setConfirmDelete] = useState<Keyword | null>(null);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const { mutate: mutateKeys } = useSWRConfig();

  const groups: Group[] = sample
    ? localGroups
    : Array.isArray(groupsQuery.data)
      ? groupsQuery.data
      : [];
  const keywords: Keyword[] = (
    sample ? localKeywords : Array.isArray(keywordsQuery.data) ? keywordsQuery.data : []
  ).filter((keyword: Keyword) => !hiddenIds.includes(keyword.id));

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
  // The group is an explicit choice (no silent "My brand" default).
  const resolvedGroup = groups.some((group) => group.id === groupId) ? groupId : '';

  const openAdd = (group?: string) => {
    setPresetGroup(group || '');
    setGroupId(group || '');
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
    if (!resolvedGroup) {
      toaster.show('Choose a group for this keyword', 'warning');
      return;
    }
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
      const body = await response.json().catch(() => null);
      const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
      toaster.show(message || 'Could not add that keyword', 'warning');
      return;
    }
    setAddOpen(false);
    refresh();
    toaster.show('Scanning now…');
    watchScan();
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
    if (
      ['youtube', 'reddit', 'x', 'linkedin'].some(
        (key) => typeof body[key] === 'boolean' && body[key] === true
      )
    ) {
      watchScan();
    }
  };

  const revalidateFeeds = () =>
    mutateKeys(
      (key) =>
        typeof key === 'string' &&
        (key.startsWith('/stalker/mentions') ||
          key.startsWith('/stalker/keywords') ||
          key.startsWith('/stalker/analytics'))
    );

  const removeKeyword = async (id: string) => {
    setConfirmDelete(null);
    if (sample) {
      setLocalKeywords((current) => current.filter((item) => item.id !== id));
      return;
    }
    // Optimistic: hide the row now, restore it if the delete fails.
    setHiddenIds((current) => [...current, id]);
    const response = await fetch(`/stalker/keywords/${id}`, { method: 'DELETE' }).catch(
      () => null
    );
    if (!response || (!response.ok && response.status !== 404)) {
      setHiddenIds((current) => current.filter((item) => item !== id));
      toaster.show('Could not delete that keyword. Try again', 'warning');
      return;
    }
    toaster.show('Keyword deleted');
    await revalidateFeeds();
    setHiddenIds((current) => current.filter((item) => item !== id));
  };

  const resumeKeyword = (keyword: Keyword) => {
    const first = ['youtube', 'x', 'reddit'].find((id) => !note(id)) || 'youtube';
    patchKeyword(keyword, {
      youtube: first === 'youtube',
      reddit: first === 'reddit',
      x: first === 'x',
      linkedin: false,
    });
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
    <div className={`${stkPage} mx-auto w-full max-w-[1080px]`}>
      <div className={stkHead}>
        <div>
          <h1 className={stkTitle}>Keywords</h1>
          <p className={stkSub}>{keywords.length} active in this project</p>
        </div>
        <div className="flex flex-wrap items-center gap-[8px]">
          <button type="button" className={stkSecondary} onClick={() => setGroupsOpen(true)}>
            Manage groups
          </button>
          <StalkerCheckNow />
          <button type="button" className={stkPrimary} onClick={() => openAdd(presetGroup)}>
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
          <section key={group.id} className="flex flex-col gap-[8px]">
            <div className="flex items-center justify-between">
              <h2 className={stkGroup}>{group.name}</h2>
              <button type="button" className={stkGhost} onClick={() => openAdd(group.id)}>
                + Add keyword
              </button>
            </div>
            {rows.length ? (
              <div className="stk-table-wrap overflow-x-auto">
                <table className="stk-table min-w-[720px] text-left">
                  <thead>
                    <tr>
                      <th>Keyword</th>
                      <th>Sources</th>
                      <th>Mentions (30d)</th>
                      <th>Last scan</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((keyword) => (
                      <tr key={keyword.id}>
                        <td data-label="Keyword" className="font-[600]">
                          {keyword.phrase}
                          {keyword.paused ? (
                            <span className="ms-[8px] inline-flex items-center gap-[6px] align-middle text-[13px] font-[500] text-textItemBlur">
                              <span className={stkBadge}>Paused</span>
                              <button
                                type="button"
                                className="font-[600] text-[color:var(--arc-accent-text)] underline underline-offset-[3px]"
                                onClick={() => resumeKeyword(keyword)}
                              >
                                Resume
                              </button>
                            </span>
                          ) : null}
                        </td>
                        <td data-label="Sources">
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
                              className="flex h-[28px] w-[28px] items-center justify-center rounded-[10px] border border-newBorder text-[13px] text-textItemBlur"
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
                            <div className={`${stkMenu} mt-[6px] w-[240px]`}>
                              {SOURCES.map((source) => {
                                const locked = !!note(source.id) && !keyword[source.key];
                                return (
                                  <label
                                    key={source.id}
                                    className={`${stkMenuItem} justify-between`}
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
                                      <span className="text-[13px] text-textItemBlur">{note(source.id)}</span>
                                    ) : null}
                                  </label>
                                );
                              })}
                            </div>
                          ) : null}
                          {rowMenu === `ex-${keyword.id}` ? (
                            <div className={`${stkMenu} mt-[6px] w-[260px] p-[12px]`}>
                              <p className="mb-[6px] text-[14px] font-[500]">Exclude accounts</p>
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
                        <td data-label="Mentions (30d)">
                          <span className="inline-flex items-center gap-[8px]">
                            <Spark values={keyword.sparkline || []} />
                            <span>{keyword.mentions30d || 0}</span>
                          </span>
                        </td>
                        <td data-label="Last scan" className="text-textItemBlur">
                          {scanning || keyword.scanning || previewScan === 'running' ? (
                            <span className="inline-flex items-center gap-[8px] text-[color:var(--arc-accent-text)]">
                              <span className="h-[14px] w-[14px] animate-spin rounded-full border border-current border-t-transparent" />
                              Scanning…
                            </span>
                          ) : (
                            <span>Last scan: {ago(keyword.lastScan)}</span>
                          )}
                          {keyword.lastError && !(scanning || keyword.scanning || previewScan === 'running') ? (
                            <span
                              title={keyword.lastError}
                              className={`${stkBadgeBad} mt-[4px] max-w-[240px]`}
                            >
                              <ReconnectText text={keyword.lastError} />
                            </span>
                          ) : null}
                          {scanning || keyword.scanning || previewScan === 'running' ? null : (
                            <span className="mt-[4px] block text-[13px]">
                              {keyword.paused
                                ? 'Paused — no sources'
                                : nextScanLabel(keyword.nextScanAt)}
                            </span>
                          )}
                        </td>
                        <td className="text-end">
                          <button
                            type="button"
                            aria-label="Keyword actions"
                            className="arc-icon-btn !h-[36px] !w-[36px] rounded-[14px] border border-newBorder"
                            onClick={() =>
                              setRowMenu((current) => (current === keyword.id ? null : keyword.id))
                            }
                          >
                            ···
                          </button>
                          {rowMenu === keyword.id ? (
                            <div className={`${stkMenu} mt-[6px] inline-flex w-[220px] flex-col items-stretch text-start`}>
                              <label className="px-[11px] py-[6px] text-[13px] text-textItemBlur">
                                Group
                                <select
                                  className={`${field} mt-[4px]`}
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
                                className={`${stkMenuItem} text-[color:var(--arc-danger)]`}
                                onClick={() => {
                                  setConfirmDelete(keyword);
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
              <div className={stkEmpty}>
                <span className={stkIconTile} aria-hidden>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M5 9h6M5 15h10" />
                  </svg>
                </span>
                <h3 className="text-[16px] font-[600]">No keywords in this group yet.</h3>
              </div>
            )}
          </section>
        );
      })}

      {addOpen ? (
        <div className={stkOverlay}>
          <div className={`${stkDialog} max-w-[560px]`}>
            <div className={stkDialogHead}>
              <div className="min-w-0 flex-1">
                <h2 className="text-[18px] font-[600]">Add keyword</h2>
                <p className="mt-[4px] text-[14px] text-textItemBlur">
                  Keywords are matched against posts on the sources you select.
                </p>
              </div>
              <button type="button" aria-label="Close" className={stkClose} onClick={() => setAddOpen(false)}>
                ×
              </button>
            </div>
            <div className={stkDialogBody}>
            <label className={stkLabel}>
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
                  className={stkSecondary}
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
                  className={`${stkSecondary} !w-[44px] !px-0`}
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
              <div className="rounded-[18px] border border-newBorder p-[8px]">
                {SOURCES.map((source) => {
                  const locked = !!note(source.id);
                  const key = source.id as keyof typeof sourcesOn;
                  return (
                    <label
                      key={source.id}
                      className={`${stkRow} border-0 bg-transparent px-[8px]`}
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
                      {locked ? <span className={stkBadge}>{note(source.id)}</span> : null}
                    </label>
                  );
                })}
              </div>
            ) : null}
            {filtersMenu ? (
              <div className="rounded-[18px] border border-newBorder p-[12px]">
                <p className="mb-[6px] text-[14px] font-[500]">Filters</p>
                <p className="mb-[6px] text-[13px] text-textItemBlur">Exclude accounts</p>
                <input
                  className={field}
                  placeholder="@handle"
                  value={exclude}
                  onChange={(event) => setExclude(event.target.value)}
                />
              </div>
            ) : null}
            <label className={stkLabel}>
              Group
              <select
                className={`${field} mt-[6px]`}
                value={resolvedGroup}
                onChange={(event) => setGroupId(event.target.value)}
              >
                <option value="" disabled>
                  Choose a group (My brand, Competitors…)
                </option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-[14px]">
              <p className="mb-[6px] text-[14px] font-[500]">Preview</p>
              <PreviewPost phrase={phrase.trim()} />
            </div>
            </div>
            <div className={stkDialogFoot}>
              <button type="button" className={stkSecondary} onClick={() => setAddOpen(false)}>
                Close
              </button>
              <button
                type="button"
                className={stkPrimary}
                disabled={saving || phrase.trim().length < 2 || !resolvedGroup}
                onClick={addKeyword}
              >
                Add keyword
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmDelete ? (
        <div
          role="dialog"
          aria-modal="true"
          className={`${stkOverlay} z-50`}
        >
          <div className={`${stkDialog} max-w-[460px]`}>
            <div className={`${stkDialogHead} border-b-0 pb-[8px]`}>
              <span className="stk-ic-bad flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[16px] border" aria-hidden>
                !
              </span>
              <div>
                <h2 className="text-[18px] font-[600]">Delete “{confirmDelete.phrase}”?</h2>
                <p className="mt-[4px] text-[14px] text-textItemBlur">
                  Stalker stops tracking it and removes the mentions it found. Adding the same phrase
                  later starts a fresh keyword.
                </p>
              </div>
            </div>
            <div className={stkDialogFoot}>
              <button type="button" className={stkSecondary} onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button type="button" className={stkDanger} onClick={() => removeKeyword(confirmDelete.id)}>
                Delete keyword
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {groupsOpen ? (
        <div className={stkOverlay}>
          <div className={`${stkDialog} max-w-[480px]`}>
            <div className={stkDialogHead}>
              <h2 className="flex-1 text-[18px] font-[600]">Manage groups</h2>
              <button type="button" aria-label="Close" className={stkClose} onClick={() => setGroupsOpen(false)}>
                ×
              </button>
            </div>
            <div className={stkDialogBody}>
            <ul className="flex flex-col gap-[8px]">
              {groups.map((group) => {
                const count = keywords.filter(
                  (keyword) => keyword.groupId === group.id || keyword.group?.name === group.name
                ).length;
                const locked = group.name === 'My brand' || group.name === 'Competitors';
                return (
                  <li
                    key={group.id}
                    className={stkRow}
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
                        className={stkGhost}
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
                className={stkSecondary}
                onClick={addGroup}
              >
                Add group
              </button>
            </div>
            </div>
            <div className={stkDialogFoot}>
              <button type="button" className={stkSecondary} onClick={() => setGroupsOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
