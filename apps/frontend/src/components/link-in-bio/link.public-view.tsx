'use client';

import { FormEvent, useState } from 'react';
import { PublicLink } from '@gitroom/frontend/components/link-in-bio/link.api';
import { parseRichText } from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.rules';

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
  onUnlock,
  onContact,
  unlocked = false,
}: {
  data: PublicLink;
  mode?: 'live' | 'preview';
  onClick?: (blockId: string) => void;
  onSubscribe?: (input: { email: string; name: string }) => Promise<'confirmed' | 'pending'>;
  onContinue?: () => Promise<void> | void;
  onUnlock?: (blockId: string, input: { age?: boolean; email?: string; name?: string; password?: string }) => Promise<string>;
  onContact?: (blockId: string, input: { email: string; name: string; message: string; website: string }) => Promise<void>;
  unlocked?: boolean;
}) => {
  const [dismissed, setDismissed] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [done, setDone] = useState<'confirmed' | 'pending' | ''>('');
  const [error, setError] = useState('');
  const [openFaq, setOpenFaq] = useState('');
  const [slide, setSlide] = useState<Record<string, number>>({});
  const [opened, setOpened] = useState<Record<string, string>>({});
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
            if (block.type === 'TEXT') {
              return <RichText key={block.id} value={block.body} />;
            }
            if (block.type === 'EMBED' && block.embed) {
              return (
                <div key={block.id} className="lib-embed" data-provider={block.embed.provider}>
                  <iframe
                    src={block.embed.src}
                    title={block.title || `${block.embed.provider} embed`}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                </div>
              );
            }
            if (block.type === 'FAQ') {
              return (
                <div key={block.id} className="lib-faq">
                  {block.title ? <strong>{block.title}</strong> : null}
                  {block.faq.map((item, index) => {
                    const id = `${block.id}-${index}`;
                    const open = openFaq === id;
                    return (
                      <div key={id}>
                        <button type="button" aria-expanded={open} onClick={() => setOpenFaq(open ? '' : id)}>
                          {item.question}
                        </button>
                        {open ? <p>{item.answer}</p> : null}
                      </div>
                    );
                  })}
                </div>
              );
            }
            if (block.type === 'IMAGE_CAROUSEL' && block.images.length) {
              const index = slide[block.id] || 0;
              const image = block.images[index % block.images.length];
              const move = (delta: number) =>
                setSlide({ ...slide, [block.id]: (index + delta + block.images.length) % block.images.length });
              return (
                <div key={block.id} className="lib-carousel">
                  <img src={image.path} alt={image.alt || ''} />
                  {block.images.length > 1 ? (
                    <div className="lib-carousel-nav">
                      <button type="button" aria-label="Previous image" onClick={() => move(-1)}>
                        ‹
                      </button>
                      <span>
                        {index + 1} / {block.images.length}
                      </span>
                      <button type="button" aria-label="Next image" onClick={() => move(1)}>
                        ›
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            }
            if (block.type === 'CONTACT_FORM' && block.form) {
              return (
                <ContactCard
                  key={block.id}
                  blockId={block.id}
                  form={block.form}
                  preview={mode === 'preview'}
                  onContact={onContact}
                />
              );
            }
            if (block.type === 'LINK') {
              const href = opened[block.id] || block.url;
              const className = ['lib-link', block.priority ? 'priority' : '', block.spotlight ? 'spotlight' : '']
                .filter(Boolean)
                .join(' ');
              const face = (
                <>
                  {block.thumbnail ? <img className="lib-thumb" src={block.thumbnail} alt="" /> : null}
                  <span>{block.title}</span>
                </>
              );
              if (block.lock !== 'NONE' && !href) {
                return (
                  <LockCard
                    key={block.id}
                    blockId={block.id}
                    title={block.title}
                    thumbnail={block.thumbnail}
                    spotlight={block.spotlight}
                    priority={block.priority}
                    lock={block.lock}
                    preview={mode === 'preview'}
                    onUnlock={async (input) => {
                      if (mode === 'preview' || !onUnlock) {
                        setOpened({ ...opened, [block.id]: 'preview' });
                        return;
                      }
                      const url = await onUnlock(block.id, input);
                      setOpened({ ...opened, [block.id]: url });
                    }}
                  />
                );
              }
              return mode === 'preview' || href === 'preview' ? (
                <div key={block.id} className={className}>
                  {face}
                </div>
              ) : (
                <a
                  key={block.id}
                  className={className}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => onClick?.(block.id)}
                >
                  {face}
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

const RichText = ({ value }: { value: string }) => (
  <div className="lib-text">
    {parseRichText(value).map((part, index) => {
      if (part.type === 'break') {
        return <br key={index} />;
      }
      if (part.type === 'bold') {
        return <strong key={index}>{part.text}</strong>;
      }
      if (part.type === 'italic') {
        return <em key={index}>{part.text}</em>;
      }
      if (part.type === 'link') {
        return (
          <a key={index} href={part.href} target="_blank" rel="noreferrer">
            {part.text}
          </a>
        );
      }
      return <span key={index}>{part.text}</span>;
    })}
  </div>
);

const ContactCard = ({
  blockId,
  form,
  preview,
  onContact,
}: {
  blockId: string;
  form: NonNullable<PublicLink['blocks'][number]['form']>;
  preview: boolean;
  onContact?: (blockId: string, input: { email: string; name: string; message: string; website: string }) => Promise<void>;
}) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (preview || !onContact) {
      setDone(true);
      return;
    }
    try {
      await onContact(blockId, { email, name, message, website });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that');
    }
  };
  return (
    <div className="lib-capture">
      <strong>{form.heading}</strong>
      {form.consent ? <p>{form.consent}</p> : null}
      {done ? (
        <p className="lib-ok">Message sent</p>
      ) : (
        <form onSubmit={submit}>
          {form.askName ? (
            <input aria-label="Name" placeholder="Your name" value={name} onChange={(event) => setName(event.target.value)} />
          ) : null}
          <input
            type="email"
            required
            aria-label="Email"
            placeholder="you@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <textarea
            required
            aria-label="Message"
            placeholder="Message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          <label className="lib-honey">
            Website
            <input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
          </label>
          {error ? <p>{error}</p> : null}
          <button className="lib-subscribe" type="submit">
            {form.button || 'Send'}
          </button>
        </form>
      )}
    </div>
  );
};

const LockCard = ({
  blockId,
  title,
  thumbnail,
  spotlight,
  priority,
  lock,
  preview,
  onUnlock,
}: {
  blockId: string;
  title: string;
  thumbnail: string;
  spotlight: boolean;
  priority: boolean;
  lock: 'AGE' | 'EMAIL' | 'PASSWORD';
  preview: boolean;
  onUnlock: (input: { age?: boolean; email?: string; name?: string; password?: string }) => Promise<void>;
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const className = ['lib-link', priority ? 'priority' : '', spotlight ? 'spotlight' : ''].filter(Boolean).join(' ');
  const submit = async (input: { age?: boolean; email?: string; password?: string }) => {
    setError('');
    try {
      await onUnlock(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open that link');
    }
  };
  return (
    <div className="lib-lock">
      <button type="button" className={className} onClick={() => (lock === 'AGE' ? submit({ age: true }) : setOpen(true))}>
        {thumbnail ? <img className="lib-thumb" src={thumbnail} alt="" /> : null}
        <span>{title}</span>
      </button>
      {open && lock === 'EMAIL' ? (
        <form
          className="lib-lock-form"
          onSubmit={(event) => {
            event.preventDefault();
            submit({ email });
          }}
        >
          <input
            type="email"
            required
            aria-label="Email"
            placeholder="you@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button className="lib-subscribe" type="submit">
            Continue
          </button>
        </form>
      ) : null}
      {open && lock === 'PASSWORD' ? (
        <form
          className="lib-lock-form"
          onSubmit={(event) => {
            event.preventDefault();
            submit({ password });
          }}
        >
          <input
            type="password"
            required
            aria-label="Password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button className="lib-subscribe" type="submit">
            Unlock
          </button>
        </form>
      ) : null}
      {preview && open ? <p className="lib-lock-note">Visitors unlock this on the live page.</p> : null}
      {error ? <p className="lib-lock-note">{error}</p> : null}
      <span className="sr-only">{blockId}</span>
    </div>
  );
};
