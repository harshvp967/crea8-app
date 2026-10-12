'use client';

import { useEffect, useRef, useState } from 'react';
import { PublicLink } from '@gitroom/frontend/components/link-in-bio/link.api';
import { LinkPublicView } from '@gitroom/frontend/components/link-in-bio/link.public-view';

const context = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    referrer: document.referrer || '',
    utmSource: params.get('utm_source') || '',
  };
};

export const LinkLive = ({ initial, gated }: { initial: PublicLink; gated: boolean }) => {
  const [data, setData] = useState(initial);
  const [unlocked, setUnlocked] = useState(!gated);
  const [error, setError] = useState('');
  const tracked = useRef(false);
  const shown = data.isPublic && (!gated || unlocked);

  useEffect(() => {
    if (!shown || tracked.current) {
      return;
    }
    tracked.current = true;
    fetch('/api/link/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: data.slug, ...context() }),
    }).catch(() => undefined);
  }, [shown, data.slug]);

  const reveal = async () => {
    setError('');
    const response = await fetch(`/api/link/open?slug=${encodeURIComponent(data.slug)}`, { cache: 'no-store' });
    const next = await response.json().catch(() => null);
    if (!response.ok || !next?.slug) {
      setError('Could not open this page');
      throw new Error('Could not open this page');
    }
    setData(next);
    setUnlocked(true);
  };

  return (
    <>
      <LinkPublicView
        key={data.slug}
        data={data}
        unlocked={unlocked}
        onContinue={gated ? reveal : undefined}
        onClick={(blockId) => {
          fetch('/api/link/click', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: data.slug, blockId, ...context() }),
          }).catch(() => undefined);
        }}
        onSubscribe={async (input) => {
          const response = await fetch('/api/link/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: data.slug, ...input, ...context() }),
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) {
            const message = Array.isArray(body.message) ? body.message[0] : body.message;
            throw new Error(message || 'Could not subscribe');
          }
          return body.status === 'pending' ? 'pending' : 'confirmed';
        }}
      />
      {error ? <p className="sr-only">{error}</p> : null}
    </>
  );
};
