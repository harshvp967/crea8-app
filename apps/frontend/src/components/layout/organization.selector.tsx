'use client';

import React, { FC, useCallback, useMemo, useState } from 'react';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { createPortal } from 'react-dom';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useToaster } from '@gitroom/react/toaster/toaster';
import clsx from 'clsx';

async function readMessage(response: Response) {
  const text = await response.text();
  try {
    const body = JSON.parse(text);
    if (typeof body?.message === 'string') {
      return body.message;
    }
    if (Array.isArray(body?.message)) {
      return body.message.join(', ');
    }
  } catch {
    return text;
  }
  return text || 'Something went wrong';
}

const NewWorkspaceForm = () => {
  const fetch = useFetch();
  const toast = useToaster();
  const t = useT();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.show(t('enter_workspace_name', 'Enter a workspace name'), 'error');
      return;
    }
    setSaving(true);
    const response = await fetch('/user/workspace', {
      method: 'POST',
      body: JSON.stringify({ name: trimmed }),
    });
    if (!response.ok) {
      toast.show(await readMessage(response), 'error');
      setSaving(false);
      return;
    }
    window.location.reload();
  };
  return (
    <form
      className="org-new-form"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <input
        className="org-new-input"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={t('workspace_name', 'Workspace name')}
        aria-label={t('workspace_name', 'Workspace name')}
      />
      <button className="org-new" type="submit" disabled={saving}>
        {t('new_workspace', 'New workspace')}
      </button>
    </form>
  );
};

const orgRole = (role?: 'SUPERADMIN' | 'ADMIN' | 'USER') =>
  role === 'SUPERADMIN'
    ? 'Super-Admin'
    : role === 'ADMIN'
    ? 'Admin'
    : role === 'USER'
    ? 'User'
    : '';

export const OrganizationSelector: FC<{
  asOpenSelect?: boolean;
  menuOpen?: boolean;
  onClose?: () => void;
}> = ({ asOpenSelect, menuOpen, onClose }) => {
  const fetch = useFetch();
  const user = useUser();
  const t = useT();
  const modals = useModals();
  const openNewWorkspace = useCallback(() => {
    onClose?.();
    modals.openModal({
      title: t('new_workspace', 'New workspace'),
      withCloseButton: true,
      size: '420px',
      children: <NewWorkspaceForm />,
    });
  }, [modals, onClose, t]);
  const load = useCallback(async () => {
    return await (await fetch('/user/organizations')).json();
  }, []);
  const { isLoading, data } = useSWR('organizations', load, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    refreshWhenOffline: false,
    refreshWhenHidden: false,
    revalidateOnReconnect: false,
  });
  const current = useMemo(() => {
    return data?.find((d: any) => d.id === user?.orgId);
  }, [data]);
  const withoutCurrent = useMemo(() => {
    return data?.filter((d: any) => d.id !== user?.orgId);
  }, [current, data]);
  const changeOrg = useCallback(
    (org: { name: string; id: string }) => async () => {
      await fetch('/user/change-org', {
        method: 'POST',
        body: JSON.stringify({
          id: org.id,
        }),
      });
      window.location.reload();
    },
    []
  );
  if (asOpenSelect) {
    const options = data || [];
    return (
      <div className="account-org-wrap">
      <label className="account-org">
        <span>{t('organization', 'Organization')}</span>
        <select
          className="account-org-select"
          aria-label={t('organization', 'Organization')}
          disabled={isLoading || options.length === 0}
          value={current?.id || ''}
          onChange={(event) => {
            const next = options.find(
              (org: { id: string }) => org.id === event.target.value
            );
            if (next && next.id !== user?.orgId) changeOrg(next)();
          }}
        >
          {isLoading ? <option value="">Loading…</option> : null}
          {!isLoading && options.length === 0 ? (
            <option value="">{t('no_organization', 'No organization')}</option>
          ) : null}
          {options.map(
            (org: {
              name: string;
              id: string;
              users: { role: 'SUPERADMIN' | 'ADMIN' | 'USER' }[];
            }) => {
              const role = orgRole(org?.users?.[0]?.role);
              return (
                <option key={org.id} value={org.id}>
                  {org.name}
                  {role ? ` (${role})` : ''}
                </option>
              );
            }
          )}
        </select>
      </label>
      <button
        type="button"
        className="account-new-workspace"
        onClick={openNewWorkspace}
      >
        {t('new_workspace', 'New workspace')}
      </button>
      </div>
    );
  }
  if (isLoading || !data) {
    return null;
  }
  return (
    <>
      <div className="hover:text-newTextColor">
        <div className="group text-[12px] relative">
          <div className="flex items-center gap-[6px]">
            <HugeIcon
              name="user"
              size={24}
              className={`org-glyph ${user?.tier.current === 'FREE' ? 'animate-bounce' : ''}`}
            />
            {!!current?.name && (
              <div className="org-name max-w-[240px] truncate">{current?.name}</div>
            )}
          </div>
          {!menuOpen && (
            <div
              className={clsx(
                'org-menu hidden py-[12px] px-[12px] group-hover:flex absolute top-[100%] end-0 w-max max-w-[400px] bg-third border-tableBorder border gap-[12px] cursor-pointer flex-col'
              )}
            >
              {withoutCurrent?.map(
                (org: {
                  name: string;
                  id: string;
                  users: { role: 'SUPERADMIN' | 'ADMIN' | 'USER' }[];
                }) => (
                  <div
                    key={org?.id}
                    onClick={changeOrg(org)}
                    className="whitespace-nowrap truncate"
                  >
                    {org?.name}
                    {!!org?.users?.[0]?.role && (
                      <span className="text-customColor18">
                        {' '}
                        (
                        {org?.users?.[0]?.role === 'SUPERADMIN'
                          ? 'Super-Admin'
                          : org?.users?.[0]?.role === 'ADMIN'
                          ? 'Admin'
                          : 'User'}
                        )
                      </span>
                    )}
                  </div>
                )
              )}
              <button type="button" className="org-new" onClick={openNewWorkspace}>
                {t('new_workspace', 'New workspace')}
              </button>
            </div>
          )}
          {menuOpen &&
            typeof document !== 'undefined' &&
            createPortal(
              <>
                <div
                  className="sheet-backdrop"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onClose?.();
                  }}
                />
                <div className="org-sheet" role="menu" aria-label="Organization">
                  {!!current?.name && (
                    <div className="org-sheet-current">{current.name}</div>
                  )}
                  {withoutCurrent?.map(
                    (org: {
                      name: string;
                      id: string;
                      users: { role: 'SUPERADMIN' | 'ADMIN' | 'USER' }[];
                    }) => (
                      <button
                        key={org?.id}
                        type="button"
                        role="menuitem"
                        onClick={changeOrg(org)}
                      >
                        <span className="truncate">{org?.name}</span>
                        {!!org?.users?.[0]?.role && (
                          <span className="org-sheet-role">
                            {org?.users?.[0]?.role === 'SUPERADMIN'
                              ? 'Super-Admin'
                              : org?.users?.[0]?.role === 'ADMIN'
                              ? 'Admin'
                              : 'User'}
                          </span>
                        )}
                      </button>
                    )
                  )}
                  <button type="button" className="org-new" onClick={openNewWorkspace}>
                    {t('new_workspace', 'New workspace')}
                  </button>
                </div>
              </>,
              document.body
            )}
        </div>
      </div>
      <div className="w-[1px] h-[20px] bg-blockSeparator" />
    </>
  );
};

export type WorkspaceRow = {
  name: string;
  id: string;
  users: { role: 'SUPERADMIN' | 'ADMIN' | 'USER' }[];
};

// Same POST /user/change-org and reload as OrganizationSelector.changeOrg.
export const useWorkspaceSwitch = () => {
  const fetch = useFetch();
  const user = useUser();
  const t = useT();
  const modals = useModals();
  const load = useCallback(async () => {
    return await (await fetch('/user/organizations')).json();
  }, [fetch]);
  const { isLoading, data } = useSWR('organizations', load, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    refreshWhenOffline: false,
    refreshWhenHidden: false,
    revalidateOnReconnect: false,
  });
  const orgs = (data || []) as WorkspaceRow[];
  const current = orgs.find((org) => org.id === user?.orgId);
  const changeOrg = useCallback(
    (org: { name: string; id: string }) => async () => {
      await fetch('/user/change-org', {
        method: 'POST',
        body: JSON.stringify({
          id: org.id,
        }),
      });
      window.location.reload();
    },
    [fetch]
  );
  const openNewWorkspace = useCallback(() => {
    modals.openModal({
      title: t('new_workspace', 'New workspace'),
      withCloseButton: true,
      size: '420px',
      children: <NewWorkspaceForm />,
    });
  }, [modals, t]);
  return {
    isLoading: isLoading || !data,
    orgs,
    current,
    orgId: user?.orgId,
    changeOrg,
    openNewWorkspace,
  };
};

export const WorkspaceSwitchList = ({
  onDone,
  showLabel,
}: {
  onDone?: () => void;
  showLabel?: boolean;
}) => {
  const { isLoading, orgs, current, orgId, changeOrg, openNewWorkspace } =
    useWorkspaceSwitch();
  if (isLoading || orgs.length === 0) return null;
  const line = current?.name ? `Workspace - ${current.name}` : '';
  return (
    <div className="c8-account-workspaces" role="group" aria-label="Workspaces">
      {line ? (
        <div
          className={
            showLabel
              ? 'c8-account-workspace-label is-visible'
              : 'c8-account-workspace-label'
          }
          title={line}
        >
          {line}
        </div>
      ) : null}
      <div className="c8-account-workspaces-title">Workspaces</div>
      {orgs.map((org) => {
        const role = orgRole(org?.users?.[0]?.role);
        const selected = org.id === orgId;
        return (
          <button
            key={org.id}
            type="button"
            className="c8-account-workspace"
            role="menuitemradio"
            aria-checked={selected}
            onClick={() => {
              if (selected) {
                onDone?.();
                return;
              }
              changeOrg(org)();
            }}
          >
            <span className="c8-account-workspace-name">{org.name}</span>
            {role ? <span className="c8-account-workspace-role">{role}</span> : null}
            <span className="c8-account-workspace-check">
              {selected ? <HugeIcon name="check" size={16} /> : null}
            </span>
          </button>
        );
      })}
      <button
        type="button"
        className="c8-account-workspace-new"
        role="menuitem"
        onClick={() => {
          onDone?.();
          openNewWorkspace();
        }}
      >
        New workspace
      </button>
      <div className="c8-account-rule" />
    </div>
  );
};
