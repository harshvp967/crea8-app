'use client';

import { useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import {
  LinkEditor,
  LinkBlock,
  linkSend,
  toPublic,
  useLinkPage,
  useLinkPosts,
} from '@gitroom/frontend/components/link-in-bio/link.api';
import { LinkField, LinkModal, LinkToggle, linkDanger, linkPrimary, linkSecondary } from '@gitroom/frontend/components/link-in-bio/link.chrome';
import { LinkPreview, LinkSplit } from '@gitroom/frontend/components/link-in-bio/link.shell';
import { LinkPublicView } from '@gitroom/frontend/components/link-in-bio/link.public-view';
import { scheduleLabel, utcToZonedInput } from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.rules';

type Modal =
  | { kind: 'link'; block?: LinkBlock }
  | { kind: 'heading'; block?: LinkBlock }
  | { kind: 'post'; block?: LinkBlock }
  | { kind: 'embed'; block?: LinkBlock }
  | { kind: 'text'; block?: LinkBlock }
  | { kind: 'faq'; block?: LinkBlock }
  | { kind: 'carousel'; block?: LinkBlock }
  | { kind: 'contact'; block?: LinkBlock }
  | { kind: 'delete'; block: LinkBlock }
  | { kind: 'capture' }
  | null;

const emptyLink = {
  title: '',
  url: '',
  scheduleOn: false,
  startsLocal: '',
  endsLocal: '',
  priority: false,
  thumbnail: '',
  iconMode: '' as '' | 'upload' | 'favicon',
  spotlight: false,
  lockType: 'NONE' as 'NONE' | 'AGE' | 'EMAIL' | 'PASSWORD',
  password: '',
};

const blockName = (block: LinkBlock) => {
  if (block.type === 'FEATURED_POST') return 'Featured post';
  if (block.type === 'EMAIL_CAPTURE') return block.title || 'Email capture';
  if (block.type === 'EMBED') return block.title || 'Embed';
  if (block.type === 'TEXT') return block.title || 'Text';
  if (block.type === 'FAQ') return block.title || 'FAQ';
  if (block.type === 'IMAGE_CAROUSEL') return block.title || 'Image carousel';
  if (block.type === 'CONTACT_FORM') return block.form?.heading || block.title || 'Contact form';
  return block.title || 'Heading';
};

export const LinkEditorScreen = () => {
  const fetch = useFetch();
  const toast = useToaster();
  const { data, error, isLoading, mutate } = useLinkPage();
  const posts = useLinkPosts();
  const [modal, setModal] = useState<Modal>(null);
  const [menu, setMenu] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [draft, setDraft] = useState(emptyLink);
  const [heading, setHeading] = useState('');
  const [postId, setPostId] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [embedTitle, setEmbedTitle] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [textBody, setTextBody] = useState('');
  const [faqTitle, setFaqTitle] = useState('');
  const [faq, setFaq] = useState<Array<{ question: string; answer: string }>>([{ question: '', answer: '' }]);
  const [images, setImages] = useState<Array<{ path: string; alt: string }>>([]);
  const [contact, setContact] = useState({ title: 'Get in touch', body: '', button: 'Send', askName: false });
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    form.append('preventSave', 'true');
    const response = await fetch('/media/upload-simple', { method: 'POST', body: form });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.path) {
      throw new Error('Could not upload that image');
    }
    return String(body.path);
  };

  const save = async (path: string, method: string, body?: unknown, note?: string, close = true) => {
    setBusy(true);
    try {
      const next = await linkSend(fetch, path, method, body);
      await mutate(next, { revalidate: false });
      if (close) {
        setModal(null);
        setMenu('');
        setAddOpen(false);
      }
      if (note) {
        toast.show(note, 'success');
      }
      return true;
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Something went wrong', 'warning');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openLink = (block?: LinkBlock) => {
    setDraft(
      block
        ? {
            title: block.title,
            url: block.url,
            scheduleOn: block.scheduleOn,
            startsLocal: block.startsAt ? utcToZonedInput(new Date(block.startsAt), data?.timezone || 'UTC') : '',
            endsLocal: block.endsAt ? utcToZonedInput(new Date(block.endsAt), data?.timezone || 'UTC') : '',
            priority: block.priority,
            thumbnail: block.thumbnail || '',
            iconMode: block.iconMode === 'upload' || block.iconMode === 'favicon' ? block.iconMode : '',
            spotlight: block.spotlight,
            lockType: block.lock?.type || 'NONE',
            password: '',
          }
        : emptyLink
    );
    setModal({ kind: 'link', block });
  };

  if (isLoading || !data) {
    return (
      <div className="p-[8px] text-[14px] text-textItemBlur">
        {error ? 'Could not load your page.' : 'Loading your page…'}
      </div>
    );
  }

  const reorder = (fromId: string, toId: string) => {
    if (!fromId || fromId === toId) {
      return;
    }
    const ids = data.blocks.map((block) => block.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0) {
      return;
    }
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    save('/link-in-bio/blocks/reorder', 'PUT', { ids });
  };

  return (
    <LinkSplit
      previewOpen={preview}
      onPreviewClose={() => setPreview(false)}
      preview={
        <LinkPreview
          onCopy={() => {
            navigator.clipboard?.writeText(data.publicUrl);
            toast.show('Link copied', 'success');
          }}
        >
          <LinkPublicView key={`${data.slug}-${data.isPublic}-${data.sensitive}`} data={toPublic(data)} mode="preview" />
        </LinkPreview>
      }
    >
      <div className="flex min-w-0 flex-col gap-[12px] pb-[24px]">
        <div className="flex flex-col gap-[12px] sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-[22px] font-[600]">Editor</h1>
            <p className="truncate text-[14px] text-textItemBlur">
              {data.publicOrigin.replace(/^https?:\/\//, '')}/{data.slug}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-[8px] sm:justify-end">
            <button type="button" className={`${linkSecondary} min-[1200px]:hidden`} onClick={() => setPreview((value) => !value)}>
              {preview ? 'Close preview' : 'Preview'}
            </button>
            <div className="relative">
              <button type="button" className={linkSecondary} onClick={() => setAddOpen((value) => !value)}>
                + Add block
              </button>
              {addOpen ? (
                <div className="lib-menu">
                  <button type="button" onClick={() => openLink()}>
                    Link
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPostId('');
                      setModal({ kind: 'post' });
                      setAddOpen(false);
                    }}
                  >
                    Featured post
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModal({ kind: 'capture' });
                      setAddOpen(false);
                    }}
                  >
                    Email capture
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHeading('');
                      setModal({ kind: 'heading' });
                      setAddOpen(false);
                    }}
                  >
                    Heading
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmbedTitle('');
                      setEmbedUrl('');
                      setModal({ kind: 'embed' });
                      setAddOpen(false);
                    }}
                  >
                    Embed
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTextTitle('');
                      setTextBody('');
                      setModal({ kind: 'text' });
                      setAddOpen(false);
                    }}
                  >
                    Text
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFaqTitle('');
                      setFaq([{ question: '', answer: '' }]);
                      setModal({ kind: 'faq' });
                      setAddOpen(false);
                    }}
                  >
                    FAQ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImages([]);
                      setModal({ kind: 'carousel' });
                      setAddOpen(false);
                    }}
                  >
                    Image carousel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setContact({ title: 'Get in touch', body: '', button: 'Send', askName: false });
                      setModal({ kind: 'contact' });
                      setAddOpen(false);
                    }}
                  >
                    Contact form
                  </button>
                </div>
              ) : null}
            </div>
            <button type="button" className={linkPrimary} onClick={() => openLink()}>
              + Add link
            </button>
          </div>
        </div>

        {!data.blocks.length ? (
          <div className="flex flex-col items-center gap-[8px] py-[80px] text-center">
            <div className="grid h-[44px] w-[44px] place-items-center rounded-[14px] border border-newBorder text-textItemBlur">
              ↗
            </div>
            <h2 className="text-[16px] font-[600]">No links yet</h2>
            <p className="max-w-[320px] text-[14px] text-textItemBlur">Add your first link or block to start your page.</p>
            <button type="button" className={linkPrimary} onClick={() => openLink()}>
              + Add link
            </button>
          </div>
        ) : (
          data.blocks.map((block) => (
            <article
              key={block.id}
              className={`lib-editor-row flex items-center gap-[10px] rounded-[18px] border border-newBorder px-[12px] py-[12px]${
                block.type === 'FEATURED_POST' ? ' is-feature' : ''
              }`}
              draggable
              onDragStart={(event) => event.dataTransfer.setData('text/plain', block.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                reorder(event.dataTransfer.getData('text/plain'), block.id);
              }}
            >
              <span className="cursor-grab text-textItemBlur" aria-hidden>
                ⋮⋮
              </span>
              {block.type === 'FEATURED_POST' ? (
                <div className="h-[42px] w-[42px] shrink-0 overflow-hidden rounded-[10px] bg-newBgLineColor">
                  {block.post?.image ? <img src={block.post.image} alt="" className="h-full w-full object-cover" /> : null}
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-[6px]">
                  <strong className="truncate text-[14px] font-[600]">{blockName(block)}</strong>
                  {block.type === 'FEATURED_POST' ? <span className="lib-pill lib-pill-cyan">From Schedule</span> : null}
                  {block.priority ? <span className="lib-pill lib-pill-cyan">Priority</span> : null}
                  {block.spotlight ? <span className="lib-pill lib-pill-cyan">Spotlight</span> : null}
                  {block.lock?.type && block.lock.type !== 'NONE' ? <span className="lib-pill">Locked</span> : null}
                  {block.state === 'scheduled' ? <span className="lib-pill lib-pill-amber">Scheduled</span> : null}
                  {block.state === 'ended' ? <span className="lib-pill">Ended</span> : null}
                  {block.state === 'hidden' ? <span className="lib-pill">Hidden</span> : null}
                </div>
                <p className="truncate text-[13px] text-textItemBlur">
                  {block.type === 'FEATURED_POST'
                    ? block.post
                      ? `${block.post.title} · ${block.post.platform} · ${block.post.dateLabel}`
                      : 'Pick a published post'
                    : block.type === 'LINK'
                    ? block.url
                    : block.type === 'EMAIL_CAPTURE'
                    ? 'Collects subscribers on your page'
                    : block.type === 'EMBED'
                    ? block.url || 'YouTube, Spotify, SoundCloud or Vimeo'
                    : block.type === 'TEXT'
                    ? block.body || 'Text'
                    : block.type === 'FAQ'
                    ? `${block.faq.length} questions`
                    : block.type === 'IMAGE_CAROUSEL'
                    ? `${block.images.length} images`
                    : block.type === 'CONTACT_FORM'
                    ? 'Collects messages on your page'
                    : 'Heading'}
                </p>
                {block.scheduleOn && block.startsAt && block.state === 'scheduled' ? (
                  <p className="text-[13px] text-textItemBlur">
                    {scheduleLabel('Starts', new Date(block.startsAt), data.timezone)}
                  </p>
                ) : null}
              </div>
              {block.type === 'LINK' ? (
                <span className="lib-editor-meta shrink-0 text-[13px] text-textItemBlur">
                  {block.clicks.toLocaleString('en-US')} clicks
                </span>
              ) : null}
              {block.type === 'FEATURED_POST' ? (
                <button
                  type="button"
                  className={`${linkSecondary} lib-editor-wide`}
                  onClick={() => {
                    setPostId(block.postId || '');
                    setModal({ kind: 'post', block });
                  }}
                >
                  Change post
                </button>
              ) : (
                <span className="lib-editor-meta shrink-0">
                  <LinkToggle
                    checked={block.enabled}
                    label={block.enabled ? 'Hide block' : 'Show block'}
                    onChange={(enabled) => save(`/link-in-bio/blocks/${block.id}`, 'PUT', { enabled })}
                  />
                </span>
              )}
              <div className="relative shrink-0">
                <button type="button" className="px-[6px] text-[18px]" aria-label="Block actions" onClick={() => setMenu(menu === block.id ? '' : block.id)}>
                  …
                </button>
                {menu === block.id ? (
                  <div className="lib-menu">
                    {block.type === 'LINK' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(block.url);
                            toast.show('Link copied', 'success');
                            setMenu('');
                          }}
                        >
                          Copy link
                        </button>
                        <button type="button" onClick={() => save(`/link-in-bio/blocks/${block.id}`, 'PUT', { priority: !block.priority })}>
                          {block.priority ? 'Remove priority' : 'Make priority'}
                        </button>
                        <button type="button" onClick={() => openLink(block)}>
                          Schedule
                        </button>
                        <button type="button" onClick={() => save(`/link-in-bio/blocks/${block.id}`, 'PUT', { enabled: !block.enabled })}>
                          {block.enabled ? 'Hidden' : 'Show'}
                        </button>
                      </>
                    ) : null}
                    {block.type === 'HEADING' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setHeading(block.title);
                          setModal({ kind: 'heading', block });
                        }}
                      >
                        Edit
                      </button>
                    ) : null}
                    {block.type === 'EMBED' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEmbedTitle(block.title);
                          setEmbedUrl(block.url);
                          setModal({ kind: 'embed', block });
                        }}
                      >
                        Edit
                      </button>
                    ) : null}
                    {block.type === 'TEXT' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setTextTitle(block.title);
                          setTextBody(block.body);
                          setModal({ kind: 'text', block });
                        }}
                      >
                        Edit
                      </button>
                    ) : null}
                    {block.type === 'FAQ' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setFaqTitle(block.title);
                          setFaq(block.faq.length ? block.faq : [{ question: '', answer: '' }]);
                          setModal({ kind: 'faq', block });
                        }}
                      >
                        Edit
                      </button>
                    ) : null}
                    {block.type === 'IMAGE_CAROUSEL' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setImages(block.images);
                          setModal({ kind: 'carousel', block });
                        }}
                      >
                        Edit
                      </button>
                    ) : null}
                    {block.type === 'CONTACT_FORM' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setContact({
                            title: block.title || block.form?.heading || '',
                            body: block.body || block.form?.consent || '',
                            button: block.form?.button || 'Send',
                            askName: !!block.form?.askName,
                          });
                          setModal({ kind: 'contact', block });
                        }}
                      >
                        Edit
                      </button>
                    ) : null}
                    {block.type === 'FEATURED_POST' ? (
                      <button type="button" onClick={() => save(`/link-in-bio/blocks/${block.id}`, 'PUT', { enabled: !block.enabled })}>
                        {block.enabled ? 'Hidden' : 'Show'}
                      </button>
                    ) : null}
                    {block.type === 'EMAIL_CAPTURE' ? (
                      <button type="button" onClick={() => setModal({ kind: 'capture' })}>
                        Edit
                      </button>
                    ) : null}
                    <button type="button" className="danger" onClick={() => setModal({ kind: 'delete', block })}>
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            </article>
          ))
        )}
      </div>

      {modal?.kind === 'link' ? (
        <LinkModal title={modal.block ? 'Edit link' : 'Add link'} onClose={() => setModal(null)}>
          <div className="flex flex-col gap-[14px]">
            <LinkField label="Title">
              <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
            </LinkField>
            <LinkField label="URL">
              <input value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} placeholder="https://" />
            </LinkField>
            <div className="flex items-center justify-between gap-[12px]">
              <div>
                <div className="text-[14px] font-[500]">Schedule</div>
                <p className="text-[13px] text-textItemBlur">Hidden until it starts, removed after it ends · {data.timezone}</p>
              </div>
              <LinkToggle checked={draft.scheduleOn} label="Schedule" onChange={(scheduleOn) => setDraft({ ...draft, scheduleOn })} />
            </div>
            {draft.scheduleOn ? (
              <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-2">
                <LinkField label="Starts">
                  <input type="datetime-local" value={draft.startsLocal} onChange={(event) => setDraft({ ...draft, startsLocal: event.target.value })} />
                </LinkField>
                <LinkField label="Ends">
                  <input type="datetime-local" value={draft.endsLocal} onChange={(event) => setDraft({ ...draft, endsLocal: event.target.value })} />
                </LinkField>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-[12px]">
              <div>
                <div className="text-[14px] font-[500]">Priority</div>
                <p className="text-[13px] text-textItemBlur">Highlight this link at the top</p>
              </div>
              <LinkToggle checked={draft.priority} label="Priority" onChange={(priority) => setDraft({ ...draft, priority })} />
            </div>
            <div className="flex items-center justify-between gap-[12px]">
              <div>
                <div className="text-[14px] font-[500]">Thumbnail</div>
                <p className="text-[13px] text-textItemBlur">Upload an icon or use the site favicon</p>
              </div>
              <LinkToggle
                checked={draft.iconMode === 'favicon'}
                label="Use favicon"
                onChange={(favicon) => setDraft({ ...draft, iconMode: favicon ? 'favicon' : draft.thumbnail ? 'upload' : '' })}
              />
            </div>
            {draft.iconMode !== 'favicon' ? (
              <div className="flex items-center gap-[10px]">
                {draft.thumbnail ? <img src={draft.thumbnail} alt="" className="h-[36px] w-[36px] rounded-full object-cover" /> : null}
                <label className={linkSecondary}>
                  Upload icon
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (!file) return;
                      try {
                        setDraft({ ...draft, thumbnail: await upload(file), iconMode: 'upload' });
                      } catch (err) {
                        toast.show(err instanceof Error ? err.message : 'Could not upload that image', 'warning');
                      }
                    }}
                  />
                </label>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-[12px]">
              <div>
                <div className="text-[14px] font-[500]">Spotlight</div>
                <p className="text-[13px] text-textItemBlur">
                  {data.paid ? 'Animated highlight on this link' : 'Spotlight is on a paid plan'}
                </p>
              </div>
              <LinkToggle
                checked={draft.spotlight}
                label="Spotlight"
                onChange={(spotlight) => {
                  if (spotlight && !data.paid) {
                    toast.show('Spotlight is on a paid plan', 'warning');
                    return;
                  }
                  setDraft({ ...draft, spotlight });
                }}
              />
            </div>
            <LinkField label="Lock">
              <select
                value={draft.lockType}
                onChange={(event) => {
                  const lockType = event.target.value as typeof draft.lockType;
                  if (lockType !== 'NONE' && !data.paid) {
                    toast.show('Locked links are on a paid plan', 'warning');
                    return;
                  }
                  setDraft({ ...draft, lockType });
                }}
              >
                <option value="NONE">No lock</option>
                <option value="AGE">Age gate, 18+</option>
                <option value="EMAIL">Email required</option>
                <option value="PASSWORD">Password</option>
              </select>
            </LinkField>
            {draft.lockType === 'PASSWORD' ? (
              <LinkField label={modal.block?.lock.hasPassword ? 'New password' : 'Password'}>
                <input
                  type="password"
                  value={draft.password}
                  placeholder={modal.block?.lock.hasPassword ? 'Leave blank to keep the current password' : ''}
                  onChange={(event) => setDraft({ ...draft, password: event.target.value })}
                />
              </LinkField>
            ) : null}
            <div className="flex justify-end gap-[8px]">
              <button type="button" className={linkSecondary} onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={linkPrimary}
                disabled={busy}
                onClick={() =>
                  save(
                    modal.block ? `/link-in-bio/blocks/${modal.block.id}` : '/link-in-bio/blocks',
                    modal.block ? 'PUT' : 'POST',
                    modal.block
                      ? {
                          title: draft.title,
                          url: draft.url,
                          scheduleOn: draft.scheduleOn,
                          startsLocal: draft.startsLocal,
                          endsLocal: draft.endsLocal,
                          priority: draft.priority,
                          thumbnail: draft.thumbnail,
                          iconMode: draft.iconMode,
                          spotlight: draft.spotlight,
                          lockType: draft.lockType,
                          ...(draft.password ? { password: draft.password } : {}),
                        }
                      : { type: 'LINK', ...draft },
                    modal.block ? 'Link saved' : 'Link added'
                  )
                }
              >
                {modal.block ? 'Save changes' : 'Add link'}
              </button>
            </div>
          </div>
        </LinkModal>
      ) : null}

      {modal?.kind === 'heading' ? (
        <LinkModal title={modal.block ? 'Edit heading' : 'Add heading'} onClose={() => setModal(null)}>
          <div className="flex flex-col gap-[14px]">
            <LinkField label="Heading">
              <input value={heading} onChange={(event) => setHeading(event.target.value)} />
            </LinkField>
            <div className="flex justify-end gap-[8px]">
              <button type="button" className={linkSecondary} onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={linkPrimary}
                disabled={busy}
                onClick={() =>
                  save(
                    modal.block ? `/link-in-bio/blocks/${modal.block.id}` : '/link-in-bio/blocks',
                    modal.block ? 'PUT' : 'POST',
                    modal.block ? { title: heading } : { type: 'HEADING', title: heading },
                    'Heading saved'
                  )
                }
              >
                Save
              </button>
            </div>
          </div>
        </LinkModal>
      ) : null}

      {modal?.kind === 'post' ? (
        <LinkModal title="Change post" onClose={() => setModal(null)}>
          <p className="mb-[10px] text-[14px] text-textItemBlur">Pick a published post from Schedule</p>
          <div className="flex max-h-[320px] flex-col gap-[8px] overflow-auto">
            {(posts.data || []).map((post) => (
              <button
                key={post.id}
                type="button"
                className={postId === post.id ? 'rounded-[16px] border border-[rgba(0,217,255,.45)] bg-[rgba(0,217,255,.08)] px-[12px] py-[10px] text-left' : 'rounded-[16px] border border-newBorder px-[12px] py-[10px] text-left'}
                onClick={() => setPostId(post.id)}
              >
                <strong className="block text-[14px]">{post.title}</strong>
                <span className="text-[13px] text-textItemBlur">
                  {post.platform} · {post.dateLabel}
                </span>
              </button>
            ))}
            {!posts.data?.length ? <p className="text-[14px] text-textItemBlur">No published posts yet.</p> : null}
          </div>
          <p className="mt-[8px] text-[13px] text-textItemBlur">Posts are from your Schedule.</p>
          <div className="mt-[12px] flex justify-end gap-[8px]">
            <button type="button" className={linkSecondary} onClick={() => setModal(null)}>
              Cancel
            </button>
            <button
              type="button"
              className={linkPrimary}
              disabled={busy || !postId}
              onClick={() =>
                save(
                  modal.block ? `/link-in-bio/blocks/${modal.block.id}` : '/link-in-bio/blocks',
                  modal.block ? 'PUT' : 'POST',
                  modal.block ? { postId } : { type: 'FEATURED_POST', postId },
                  'Featured post updated'
                )
              }
            >
              Change post
            </button>
          </div>
        </LinkModal>
      ) : null}

      {modal?.kind === 'delete' ? (
        <LinkModal title="Delete link?" onClose={() => setModal(null)}>
          <p className="text-[14px]">“{modal.block.title || 'This block'}” will be removed from your page.</p>
          <div className="mt-[16px] flex justify-end gap-[8px]">
            <button type="button" className={linkSecondary} onClick={() => setModal(null)}>
              No, cancel!
            </button>
            <button
              type="button"
              className={linkDanger}
              disabled={busy}
              onClick={() => save(`/link-in-bio/blocks/${modal.block.id}`, 'DELETE', undefined, 'Deleted')}
            >
              Yes, delete it!
            </button>
          </div>
        </LinkModal>
      ) : null}

      {modal?.kind === 'embed' ? (
        <LinkModal title={modal.block ? 'Edit embed' : 'Add embed'} onClose={() => setModal(null)}>
          <div className="flex flex-col gap-[14px]">
            <LinkField label="Title">
              <input value={embedTitle} onChange={(event) => setEmbedTitle(event.target.value)} />
            </LinkField>
            <LinkField label="URL">
              <input value={embedUrl} placeholder="https://" onChange={(event) => setEmbedUrl(event.target.value)} />
            </LinkField>
            <p className="text-[13px] text-textItemBlur">YouTube, Spotify, SoundCloud or Vimeo. The player is loaded from that provider.</p>
            <div className="flex justify-end gap-[8px]">
              <button type="button" className={linkSecondary} onClick={() => setModal(null)}>Cancel</button>
              <button
                type="button"
                className={linkPrimary}
                disabled={busy}
                onClick={() =>
                  save(
                    modal.block ? `/link-in-bio/blocks/${modal.block.id}` : '/link-in-bio/blocks',
                    modal.block ? 'PUT' : 'POST',
                    modal.block ? { title: embedTitle, url: embedUrl } : { type: 'EMBED', title: embedTitle, url: embedUrl },
                    'Embed saved'
                  )
                }
              >
                Save
              </button>
            </div>
          </div>
        </LinkModal>
      ) : null}

      {modal?.kind === 'text' ? (
        <LinkModal title={modal.block ? 'Edit text' : 'Add text'} onClose={() => setModal(null)}>
          <div className="flex flex-col gap-[14px]">
            <LinkField label="Title">
              <input value={textTitle} onChange={(event) => setTextTitle(event.target.value)} />
            </LinkField>
            <LinkField label="Text">
              <textarea value={textBody} onChange={(event) => setTextBody(event.target.value)} />
            </LinkField>
            <p className="text-[13px] text-textItemBlur">Use **bold**, *italic* and [label](https://crea8.one).</p>
            <div className="flex justify-end gap-[8px]">
              <button type="button" className={linkSecondary} onClick={() => setModal(null)}>Cancel</button>
              <button
                type="button"
                className={linkPrimary}
                disabled={busy}
                onClick={() =>
                  save(
                    modal.block ? `/link-in-bio/blocks/${modal.block.id}` : '/link-in-bio/blocks',
                    modal.block ? 'PUT' : 'POST',
                    modal.block ? { title: textTitle, body: textBody } : { type: 'TEXT', title: textTitle, body: textBody },
                    'Text saved'
                  )
                }
              >
                Save
              </button>
            </div>
          </div>
        </LinkModal>
      ) : null}

      {modal?.kind === 'faq' ? (
        <LinkModal title={modal.block ? 'Edit FAQ' : 'Add FAQ'} onClose={() => setModal(null)}>
          <div className="flex flex-col gap-[12px]">
            <LinkField label="Heading">
              <input value={faqTitle} onChange={(event) => setFaqTitle(event.target.value)} />
            </LinkField>
            {faq.map((item, index) => (
              <div key={index} className="flex flex-col gap-[8px] rounded-[16px] border border-newBorder p-[10px]">
                <LinkField label="Question">
                  <input
                    value={item.question}
                    onChange={(event) => setFaq(faq.map((row, rowIndex) => (rowIndex === index ? { ...row, question: event.target.value } : row)))}
                  />
                </LinkField>
                <LinkField label="Answer">
                  <textarea
                    value={item.answer}
                    onChange={(event) => setFaq(faq.map((row, rowIndex) => (rowIndex === index ? { ...row, answer: event.target.value } : row)))}
                  />
                </LinkField>
              </div>
            ))}
            <button type="button" className={linkSecondary} onClick={() => setFaq([...faq, { question: '', answer: '' }])}>
              Add question
            </button>
            <div className="flex justify-end gap-[8px]">
              <button type="button" className={linkSecondary} onClick={() => setModal(null)}>Cancel</button>
              <button
                type="button"
                className={linkPrimary}
                disabled={busy}
                onClick={() =>
                  save(
                    modal.block ? `/link-in-bio/blocks/${modal.block.id}` : '/link-in-bio/blocks',
                    modal.block ? 'PUT' : 'POST',
                    modal.block
                      ? { title: faqTitle, faq: faq.filter((item) => item.question.trim() && item.answer.trim()) }
                      : { type: 'FAQ', title: faqTitle, faq: faq.filter((item) => item.question.trim() && item.answer.trim()) },
                    'FAQ saved'
                  )
                }
              >
                Save
              </button>
            </div>
          </div>
        </LinkModal>
      ) : null}

      {modal?.kind === 'carousel' ? (
        <LinkModal title={modal.block ? 'Edit carousel' : 'Add carousel'} onClose={() => setModal(null)}>
          <div className="flex flex-col gap-[12px]">
            <div className="grid grid-cols-3 gap-[8px]">
              {images.map((image, index) => (
                <div key={`${image.path}-${index}`} className="relative">
                  <img src={image.path} alt={image.alt} className="h-[72px] w-full rounded-[12px] object-cover" />
                  <button
                    type="button"
                    className="absolute right-[4px] top-[4px] text-[12px]"
                    aria-label="Remove image"
                    onClick={() => setImages(images.filter((_, rowIndex) => rowIndex !== index))}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <label className={linkSecondary}>
              Upload image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (!file) return;
                  try {
                    setImages([...images, { path: await upload(file), alt: '' }]);
                  } catch (err) {
                    toast.show(err instanceof Error ? err.message : 'Could not upload that image', 'warning');
                  }
                }}
              />
            </label>
            <div className="flex justify-end gap-[8px]">
              <button type="button" className={linkSecondary} onClick={() => setModal(null)}>Cancel</button>
              <button
                type="button"
                className={linkPrimary}
                disabled={busy}
                onClick={() =>
                  save(
                    modal.block ? `/link-in-bio/blocks/${modal.block.id}` : '/link-in-bio/blocks',
                    modal.block ? 'PUT' : 'POST',
                    modal.block ? { images } : { type: 'IMAGE_CAROUSEL', title: 'Carousel', images },
                    'Carousel saved'
                  )
                }
              >
                Save
              </button>
            </div>
          </div>
        </LinkModal>
      ) : null}

      {modal?.kind === 'contact' ? (
        <LinkModal title={modal.block ? 'Edit contact form' : 'Add contact form'} onClose={() => setModal(null)}>
          <div className="flex flex-col gap-[12px]">
            <LinkField label="Heading">
              <input value={contact.title} onChange={(event) => setContact({ ...contact, title: event.target.value })} />
            </LinkField>
            <LinkField label="Button">
              <input value={contact.button} onChange={(event) => setContact({ ...contact, button: event.target.value })} />
            </LinkField>
            <LinkField label="Note">
              <textarea value={contact.body} onChange={(event) => setContact({ ...contact, body: event.target.value })} />
            </LinkField>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] font-[500]">Ask for name</div>
                <p className="text-[13px] text-textItemBlur">Optional field above email</p>
              </div>
              <LinkToggle checked={contact.askName} label="Ask for name" onChange={(askName) => setContact({ ...contact, askName })} />
            </div>
            <div className="flex justify-end gap-[8px]">
              <button type="button" className={linkSecondary} onClick={() => setModal(null)}>Cancel</button>
              <button
                type="button"
                className={linkPrimary}
                disabled={busy}
                onClick={() =>
                  save(
                    modal.block ? `/link-in-bio/blocks/${modal.block.id}` : '/link-in-bio/blocks',
                    modal.block ? 'PUT' : 'POST',
                    modal.block
                      ? { title: contact.title, body: contact.body, formButton: contact.button, formAskName: contact.askName }
                      : { type: 'CONTACT_FORM', title: contact.title, body: contact.body, formButton: contact.button, formAskName: contact.askName },
                    'Contact form saved'
                  )
                }
              >
                Save
              </button>
            </div>
          </div>
        </LinkModal>
      ) : null}

      {modal?.kind === 'capture' ? <CaptureModal page={data} busy={busy} onClose={() => setModal(null)} onSave={save} /> : null}
    </LinkSplit>
  );
};

const CaptureModal = ({
  page,
  busy,
  onClose,
  onSave,
}: {
  page: LinkEditor;
  busy: boolean;
  onClose: () => void;
  onSave: (path: string, method: string, body?: unknown, note?: string, close?: boolean) => Promise<boolean>;
}) => {
  const [form, setForm] = useState(page.capture);
  const existing = page.blocks.find((block) => block.type === 'EMAIL_CAPTURE');
  const [placement, setPlacement] = useState<'above' | 'below'>(
    existing && page.blocks[0]?.id === existing.id ? 'above' : 'below'
  );
  return (
    <LinkModal title="Email capture" onClose={onClose}>
      <div className="flex flex-col gap-[12px]">
        <LinkField label="Form heading">
          <input value={form.heading} onChange={(event) => setForm({ ...form, heading: event.target.value })} />
        </LinkField>
        <LinkField label="Button label">
          <input value={form.button} onChange={(event) => setForm({ ...form, button: event.target.value })} />
        </LinkField>
        <LinkField label="Consent text">
          <textarea value={form.consent} onChange={(event) => setForm({ ...form, consent: event.target.value })} />
        </LinkField>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[14px] font-[500]">Ask for name</div>
            <p className="text-[13px] text-textItemBlur">Optional field above email</p>
          </div>
          <LinkToggle checked={form.askName} label="Ask for name" onChange={(askName) => setForm({ ...form, askName })} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[14px] font-[500]">Confirm by email</div>
            <p className="text-[13px] text-textItemBlur">Double opt-in before adding</p>
          </div>
          <LinkToggle
            checked={form.doubleOptIn}
            label="Confirm by email"
            onChange={(doubleOptIn) => setForm({ ...form, doubleOptIn })}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[14px] font-[500]">Notify me</div>
            <p className="text-[13px] text-textItemBlur">Email me for each new lead</p>
          </div>
          <LinkToggle checked={form.notify} label="Notify me" onChange={(notify) => setForm({ ...form, notify })} />
        </div>
        <LinkField label="Placement on page">
          <select value={placement} onChange={(event) => setPlacement(event.target.value === 'above' ? 'above' : 'below')}>
            <option value="below">Below links</option>
            <option value="above">Above links</option>
          </select>
        </LinkField>
        <div className="flex justify-end gap-[8px]">
          <button type="button" className={linkSecondary} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={linkPrimary}
            disabled={busy}
            onClick={async () => {
              const copy = {
                captureHeading: form.heading,
                captureButton: form.button,
                captureConsent: form.consent,
                captureAskName: form.askName,
                captureDoubleOptIn: form.doubleOptIn,
                captureNotify: form.notify,
              };
              const saved = await onSave('/link-in-bio', 'PUT', copy, undefined, false);
              if (!saved) {
                return;
              }
              if (existing) {
                await onSave(`/link-in-bio/blocks/${existing.id}`, 'PUT', { placement }, 'Email capture saved');
                return;
              }
              await onSave(
                '/link-in-bio/blocks',
                'POST',
                { type: 'EMAIL_CAPTURE', title: 'Email capture', placement },
                'Email capture saved'
              );
            }}
          >
            Save changes
          </button>
        </div>
      </div>
    </LinkModal>
  );
};
