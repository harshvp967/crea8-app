'use client';

import React, { FC, useCallback } from 'react';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { setCookie } from '@gitroom/frontend/components/layout/layout.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
export const LogoutComponent: FC<{ isIcon?: boolean }> = ({ isIcon }) => {
  const fetch = useFetch();
  const { isSecured } = useVariables();
  const t = useT();

  const logout = useCallback(async () => {
    if (
      await deleteDialog(
        t(
          'are_you_sure_you_want_to_logout',
          'Are you sure you want to logout?'
        ),
        t('yes_logout', 'Yes logout')
      )
    ) {
      if (!isSecured) {
        setCookie('auth', '', -10);
        setCookie('showorg', '', -10);
        setCookie('impersonate', '', -10);
      } else {
        await fetch('/user/logout', {
          method: 'POST',
        });
      }
      window.location.href = '/';
    }
  }, []);
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
            {t('logout_from', 'Logout from')}
            {' Crea8one'}
          </span>
        )}
      </div>
    </>
  );
};
