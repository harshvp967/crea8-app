'use client';

import { FormEvent, useState } from 'react';
import { PublicLink } from '@gitroom/frontend/components/link-in-bio/link.api';

const SOCIAL: Record<string, string> = {
  instagram: 'Ig',
  x: 'X',
  youtube: 'Yt',
  linkedin: 'In',
  tiktok: 'Tk',
  website: 'W',
};

export const LinkPublicView = ({
  data,
  mode = 'live',
  onClick,
  onSubscribe,
  onContinue,
  unlocked = false,
}: {
  data: PublicLink;
  mode?: 'live' | 'preview';
  onClick?: (blockId: string) => void;
  onSubscribe?: (input: { email: string; name: string }) => Promise<'confirmed' | 'pending'>;
  onContinue?: () => Promise<void> | void;
  unlocked?: boolean;
}) => {
  const [dismissed, setDismissed] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [done, setDone] = useState<'confirmed' | 'pending' | ''>('');
  const [error, setError] = useState('');
  const open = unlocked || dismissed || !data.sensitive || !data.isPublic;

  const style =
    data.backgroundMode === 'image' && data.backgroundImage
      ? {
          backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.35), rgba(0,0,0,.72)), url(${data.backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : data.backgroundMode === 'colour' && data.backgroundColor
      ? { background: data.backgroundColor }
      : undefined;

  const subscribe = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (mode === 'preview' || !onSubscribe) {
      setDone('confirmed');
      return;
    }
    try {
      setDone(await onSubscribe({ email, name }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not subscribe');
    }
  };

  return (
    <div
      className="lib-public"
      data-theme={data.theme || 'midnight'}
      data-buttons={data.buttonStyle || 'pill'}
      style={style}
    >
      <div className="lib-stack">
        <div className="lib-avatar">
          {data.avatarPath ? <img src={data.avatarPath} alt="" /> : (data.name || data.slug || 'c').slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h1 className="lib-name">{data.name || data.slug}</h1>
          {data.bio ? <p className="lib-bio">{data.bio}</p> : null}
        </div>
        {data.socials.length ? (
          <div className="lib-socials">
            {data.socials.map((item) =>
              mode === 'preview' ? (
                <span key={item.network}>{SOCIAL[item.network] || '•'}</span>
              ) : (
                <a key={item.network} href={item.url} target="_blank" rel="noreferrer">
                  {SOCIAL[item.network] || '•'}
                </a>
              )
            )}
          </div>
        ) : null}
        {!data.isPublic ? (
          <div className="lib-soon">
            <strong>Coming soon</strong>
            <p>This page isn&apos;t public yet.</p>
          </div>
        ) : data.sensitive && !open ? (
          <div className="lib-sensitive">
            <strong>Sensitive content</strong>
            <p>This page may contain content some people find sensitive.</p>
            <button
              type="button"
              className="lib-continue"
              onClick={async () => {
                if (onContinue) {
                  try {
                    await onContinue();
                  } catch {
                    return;
                  }
                }
                setDismissed(true);
              }}
            >
              Continue
            </button>
          </div>
        ) : (
          data.blocks.map((block) => {
            if (block.type === 'HEADING') {
              return (
                <h2 key={block.id} className="lib-heading">
                  {block.title}
                </h2>
              );
            }
            if (block.type === 'FEATURED_POST' && block.post) {
              const inner = (
                <>
                  <div className="lib-feature-media">
                    {block.post.image ? <img src={block.post.image} alt="" /> : null}
                  </div>
                  <div>
                    <small>
                      Featured post · {block.post.platform} · {block.post.dateLabel}
                    </small>
                    <strong>{block.post.title}</strong>
                  </div>
                </>
              );
              return mode === 'preview' ? (
                <div key={block.id} className="lib-feature">
                  {inner}
                </div>
              ) : (
                <a
                  key={block.id}
                  className="lib-feature"
                  href={block.post.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => onClick?.(block.id)}
                >
                  {inner}
                </a>
              );
            }
            if (block.type === 'EMAIL_CAPTURE' && data.capture) {
              return (
                <div key={block.id} className="lib-capture">
                  <strong>{data.capture.heading}</strong>
                  <p>{data.capture.consent}</p>
                  {done ? (
                    <p className="lib-ok">
                      {done === 'pending' ? 'Check your email to confirm' : "You're subscribed"}
                    </p>
                  ) : (
                    <form onSubmit={subscribe}>
                      {data.capture.askName ? (
                        <input
                          aria-label="Name"
                          placeholder="Your name"
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                        />
                      ) : null}
                      <div className="lib-row">
                        <input
                          type="email"
                          required
                          aria-label="Email"
                          placeholder="you@email.com"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                        />
                        <button className="lib-subscribe" type="submit">
                          {data.capture.button || 'Subscribe'}
                        </button>
                      </div>
                      {error ? <p>{error}</p> : null}
                    </form>
                  )}
                </div>
              );
            }
            if (block.type === 'LINK') {
              return mode === 'preview' ? (
                <div key={block.id} className={block.priority ? 'lib-link priority' : 'lib-link'}>
                  {block.title}
                </div>
              ) : (
                <a
                  key={block.id}
                  className={block.priority ? 'lib-link priority' : 'lib-link'}
                  href={block.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => onClick?.(block.id)}
                >
                  {block.title}
                </a>
              );
            }
            return null;
          })
        )}
        {data.showBadge ? (
          <a className="lib-made" href="https://crea8.one">
            made with crea8.one
          </a>
        ) : null}
      </div>
    </div>
  );
};
