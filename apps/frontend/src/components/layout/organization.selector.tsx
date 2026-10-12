'use client';

import React, { FC, useCallback, useMemo } from 'react';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { createPortal } from 'react-dom';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import clsx from 'clsx';
export const OrganizationSelector: FC<{
  asOpenSelect?: boolean;
  menuOpen?: boolean;
  onClose?: () => void;
}> = ({ asOpenSelect, menuOpen, onClose }) => {
  const fetch = useFetch();
  const user = useUser();
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
  if (isLoading || (!menuOpen && !asOpenSelect && data?.length === 1)) {
    return null;
  }
  return (
    <>
      <div className="hover:text-newTextColor">
        <div className="group text-[12px] relative">
          {asOpenSelect && (
            <div className="bg-btnPrimary !flex !relative max-w-[500px] mx-auto py-[12px] px-[12px]">Select Organization</div>
          )}
          {!asOpenSelect && (
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
          )}
          {(data?.length > 1 || asOpenSelect) && !menuOpen && (
            <div
              className={clsx(
                'org-menu hidden py-[12px] px-[12px] group-hover:flex absolute top-[100%] end-0 w-max max-w-[400px] bg-third border-tableBorder border gap-[12px] cursor-pointer flex-col',
                asOpenSelect ? '!flex !relative max-w-[500px] mx-auto mb-[10px]' : ''
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
      {!asOpenSelect && <div className="w-[1px] h-[20px] bg-blockSeparator" />}
    </>
  );
};
