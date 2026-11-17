'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Login } from '@gitroom/frontend/components/auth/login';
import { AddProviderComponent } from '@gitroom/frontend/components/launches/add.provider.component';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useOpenComposer } from '@gitroom/frontend/components/launches/new.post';
import { gta6clipsProviderAllowed } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';
import {
  LINK_ALREADY_USED,
  clearPartnerHandoff,
  markPartnerHandoff,
  notePartnerToken,
  partnerArrivedWithToken,
  partnerSessionReleased,
  releasePartnerSession,
  runPartnerStep,
  selfStillPending,
  sessionOf,
  sharedPartnerVisit,
  shouldHoldUserSelf,
  subscribePartnerSession,
} from '@gitroom/frontend/components/partner/compose.partner.flow';

const PREFILL = 'crea8.partner.prefill';

function remember(caption: string, video: string | null) {
  try {
    sessionStorage.setItem(PREFILL, JSON.stringify({ caption, video }));
  } catch {
    return;
  }
}

export const ComposePartner = () => {
  const params = useSearchParams();
  const pathname = usePathname() || '';
  const fetch = useFetch();
  const { mutate } = useSWRConfig();
  const user = useUser();
  const openComposer = useOpenComposer();
  // The shell remounts this screen once /user/self resolves, so the guard has to outlive the render.
  const guard = useRef(sharedPartnerVisit);
  const fetchStarted = useRef(false);
  const token = params.get('token') || '';
  const pending = params.get('pending') || '';
  if (typeof window !== 'undefined' && (token || pending)) {
    if (token) {
      notePartnerToken();
    }
    markPartnerHandoff(window.sessionStorage);
  }
  const released = useSyncExternalStore(
    subscribePartnerSession,
    partnerSessionReleased,
    () => false
  );
  const hold = shouldHoldUserSelf({
    pathname,
    arrivedWithToken: !!token || (typeof window !== 'undefined' && partnerArrivedWithToken()),
    released,
  });
  const loadSelf = useCallback(async (path: string) => {
    return await (await fetch(path)).json();
  }, [fetch]);
  const { data, error, isLoading, isValidating } = useSWR<{ id?: string } | null>(
    hold ? null : '/user/self',
    loadSelf
  );
  if (isLoading || isValidating) {
    fetchStarted.current = true;
  }
  const hasUser = !!(user?.id || data?.id);
  const failed = !!error || (!!data && !data.id);
  const session = sessionOf({
    userId: user?.id,
    hasUser,
    failed,
    pending: selfStillPending({
      hold,
      loading: !!isLoading,
      validating: !!isValidating,
      hasUser,
      failed,
      fetchStarted: fetchStarted.current,
    }),
  });
  const [phase, setPhase] = useState<'wait' | 'connect' | 'collision' | 'preview' | 'used' | 'refused'>('wait');
  const [email, setEmail] = useState('');
  const [caption, setCaption] = useState(params.get('caption') || '');
  const [video, setVideo] = useState(params.get('video') || '');
  const [social, setSocial] = useState<any[]>([]);

  useEffect(() => {
    if (session !== 'in' || token || pending || typeof window === 'undefined') {
      return;
    }
    clearPartnerHandoff(window.sessionStorage);
  }, [session, token, pending]);

  useEffect(() => {
    const visit = guard.current;
    let cancelled = false;
    (async () => {
      try {
        const result = await runPartnerStep({
          visit,
          href: window.location.href,
          session,
          post: async (path, body) => {
            const response = await fetch(path, {
              method: 'POST',
              body: JSON.stringify(body),
            });
            try {
              return await response.json();
            } catch {
              return {};
            }
          },
          connectedCount: async () => {
            const list = await (await fetch('/integrations/list')).json();
            const rows = Array.isArray(list) ? list : list?.integrations || [];
            return rows.filter(
              (row: { disabled?: boolean; identifier?: string }) =>
                !row.disabled && !!row.identifier && gta6clipsProviderAllowed(row.identifier)
            ).length;
          },
          replaceTokenUrl: (next) => {
            window.history.replaceState(window.history.state, '', next);
          },
        });
        if (cancelled) {
          return;
        }
        if (result.view === 'navigate' || result.view === 'compose') {
          await mutate('/user/self');
        }
        if (
          (result.view === 'wait' && result.needSession) ||
          result.view === 'used' ||
          result.view === 'preview' ||
          result.view === 'refused' ||
          result.view === 'login' ||
          result.view === 'connect'
        ) {
          releasePartnerSession();
        }
        if (result.view === 'wait') {
          setPhase('wait');
          return;
        }
        if (result.view === 'login') {
          localStorage.setItem('returnUrl', result.returnTo);
          setEmail(result.email);
          setPhase('collision');
          return;
        }
        if (result.view === 'used') {
          setPhase('used');
          return;
        }
        if (result.view === 'refused') {
          setPhase('refused');
          return;
        }
        if (result.caption || result.video) {
          setCaption(result.caption || '');
          setVideo(result.video || '');
          remember(result.caption || '', result.video || null);
        }
        if (result.view === 'navigate') {
          setPhase('wait');
          if (visit.claimNavigate(result.href)) {
            window.location.replace(result.href);
          }
          return;
        }
        if (result.view === 'compose') {
          setPhase('wait');
          if (visit.claimOpen()) {
            openComposer();
          }
          return;
        }
        if (result.view === 'connect') {
          const list = await (await fetch('/integrations')).json();
          if (cancelled) {
            return;
          }
          setSocial(
            (list?.social || []).filter(
              (item: { identifier: string; comingSoon?: boolean }) =>
                gta6clipsProviderAllowed(item.identifier) && !item.comingSoon
            )
          );
          setPhase('connect');
          return;
        }
        setPhase('preview');
      } catch {
        if (!cancelled) {
          setPhase('preview');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, fetch, openComposer, params, mutate]);

  if (phase === 'collision') {
    return <Login email={email} />;
  }

  if (phase === 'connect') {
    return (
      <AddProviderComponent social={social} article={[]} invite={false} />
    );
  }

  if (phase === 'used') {
    return <p className="text-[14px] font-[700]">{LINK_ALREADY_USED}</p>;
  }

  if (phase === 'refused') {
    return <p className="text-[14px] font-[700]">link refused</p>;
  }

  if (phase === 'preview') {
    return (
      <div className="flex flex-col gap-[16px] max-w-[480px]">
        {video ? <video src={video} controls playsInline className="w-full rounded-[12px] bg-black" /> : null}
        {caption ? <p className="whitespace-pre-wrap">{caption}</p> : null}
      </div>
    );
  }

  return null;
};
