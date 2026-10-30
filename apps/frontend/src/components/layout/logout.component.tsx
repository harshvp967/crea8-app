'use client';

import React, { FC, useCallback } from 'react';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { setCookie } from '@gitroom/frontend/components/layout/layout.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
export const LogoutComponent: FC<{ isIcon?: boolean; label?: string }> = ({
  isIcon,
  label,
}) => {
  const { isSecured, backendUrl } = useVariables();
  const t = useT();

  const logout = useCallback(async () => {
    if (
      await deleteDialog(
        '',
        t('log_out', 'Log out'),
        t('log_out_question', 'Log out?'),
        t('cancel', 'Cancel'),
        'primary'
      )
    ) {
      if (!isSecured) {
        setCookie('auth', '', -10);
        setCookie('showorg', '', -10);
        setCookie('impersonate', '', -10);
      } else {
        // Raw fetch, not useFetch: the shared afterRequest handler navigates
        // to / when it sees the logout header, which skips /auth/logout.
        await fetch(`${backendUrl}/user/logout`, {
          method: 'POST',
          credentials: 'include',
        }).catch(() => undefined);
      }
      window.location.href = '/auth/logout';
    }
  }, [backendUrl, isSecured, t]);
  return (
    <>
      <div className="cursor-pointer" onClick={logout}>
        {isIcon ? (
          <HugeIcon
            name="logout"
            size={24}
            data-tooltip-id="tooltip"
            data-tooltip-content={`
            ${t('logout_from', 'Logout from')}${' '}
            Crea8one
            `}
          />
        ) : (
          <span className="text-red-400">
            {label || (
              <>
                {t('logout_from', 'Logout from')}
                {' Crea8one'}
              </>
            )}
          </span>
        )}
      </div>
    </>
  );
};
