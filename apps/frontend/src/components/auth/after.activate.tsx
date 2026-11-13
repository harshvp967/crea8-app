'use client';

import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import useCookie from 'react-use-cookie';
export const AfterActivate = () => {
  const fetch = useFetch();
  const params = useParams();
  const [showLoader, setShowLoader] = useState(true);
  const run = useRef(false);
  const t = useT();
  const [datafast_visitor_id] = useCookie('datafast_visitor_id');

  useEffect(() => {
    if (!run.current) {
      run.current = true;
      loadCode();
    }
  }, []);
  const loadCode = useCallback(async () => {
    if (params.code) {
      const { can } = await (
        await fetch(`/auth/activate`, {
          method: 'POST',
          body: JSON.stringify({
            code: params.code,
            datafast_visitor_id,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        })
      ).json();
      if (!can) {
        setShowLoader(false);
      }
    }
  }, []);
  return showLoader ? (
    <LoadingComponent />
  ) : (
    <div className="auth-form flex flex-1 flex-col">
      <h1 className="text-[26px] font-[600] tracking-[-0.02em] text-start">
        {t('user_already_activated', 'Already activated')}
      </h1>
      <p className="mt-[12px] text-[14px]">
        <Link href="/login" className="cursor-pointer text-[color:var(--arc-accent-text)]">
          {t('log_in', 'Log in')}
        </Link>
      </p>
    </div>
  );
};
