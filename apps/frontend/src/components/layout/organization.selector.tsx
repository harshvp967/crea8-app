'use client';

import React, { FC, useCallback, useMemo } from 'react';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { createPortal } from 'react-dom';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import clsx from 'clsx';

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
    );
  }
  if (isLoading || (!menuOpen && data?.length === 1)) {
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
          {data?.length > 1 && !menuOpen && (
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
