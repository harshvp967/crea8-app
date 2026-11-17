'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Login } from '@gitroom/frontend/components/auth/login';
import { AddProviderComponent } from '@gitroom/frontend/components/launches/add.provider.component';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useOpenComposer } from '@gitroom/frontend/components/launches/new.post';
import { gta6clipsProviderAllowed } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/billing.config';

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
  const fetch = useFetch();
  const user = useUser();
  const openComposer = useOpenComposer();
  const [phase, setPhase] = useState<'wait' | 'connect' | 'collision' | 'preview'>('wait');
  const [email, setEmail] = useState('');
  const [caption, setCaption] = useState(params.get('caption') || '');
  const [video, setVideo] = useState(params.get('video') || '');
  const [social, setSocial] = useState<any[]>([]);

  useEffect(() => {
    const token = params.get('token') || '';
    const pending = params.get('pending') || '';
    const captionValue = params.get('caption') || '';
    const videoValue = params.get('video') || '';
    let cancelled = false;
    (async () => {
      try {
        if (token) {
          const response = await fetch('/partner/gta6clips/exchange', {
            method: 'POST',
            body: JSON.stringify({
              token,
              caption: captionValue,
              video: videoValue,
            }),
          });
          const body = await response.json();
          if (cancelled) {
            return;
          }
          const nextCaption = typeof body.caption === 'string' ? body.caption : captionValue;
          const nextVideo = typeof body.video === 'string' ? body.video : '';
          setCaption(nextCaption);
          setVideo(nextVideo);
          remember(nextCaption, nextVideo || null);
          if (body.status === 'collision') {
            setEmail(body.email || '');
            const back = new URL('/compose', window.location.origin);
            back.searchParams.set('pending', body.pendingId);
            if (nextCaption) {
              back.searchParams.set('caption', nextCaption);
            }
            if (nextVideo) {
              back.searchParams.set('video', nextVideo);
            }
            localStorage.setItem('returnUrl', back.toString());
            setPhase('collision');
            return;
          }
          if (body.status === 'session') {
            const next = new URL('/compose', window.location.origin);
            next.searchParams.set('connect', '1');
            if (nextCaption) {
              next.searchParams.set('caption', nextCaption);
            }
            if (nextVideo) {
              next.searchParams.set('video', nextVideo);
            }
            window.location.replace(next.toString());
            return;
          }
          setPhase('preview');
          return;
        }
        if (pending && user?.id) {
          const response = await fetch('/partner/gta6clips/link', {
            method: 'POST',
            body: JSON.stringify({ pendingId: pending }),
          });
          const body = await response.json();
          if (cancelled) {
            return;
          }
          if (typeof body.caption === 'string') {
            setCaption(body.caption);
          }
          if (typeof body.video === 'string') {
            setVideo(body.video);
          }
          remember(body.caption || captionValue, body.video || videoValue || null);
          if (body.status === 'session') {
            const next = new URL('/compose', window.location.origin);
            next.searchParams.set('connect', '1');
            window.location.replace(next.toString());
            return;
          }
        }
        if (params.get('connect') === '1') {
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
        if (user?.id) {
          openComposer();
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
  }, [params, fetch, user?.id, openComposer]);

  if (phase === 'collision') {
    return <Login email={email} />;
  }

  if (phase === 'connect') {
    return (
      <AddProviderComponent social={social} article={[]} invite={false} />
    );
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
