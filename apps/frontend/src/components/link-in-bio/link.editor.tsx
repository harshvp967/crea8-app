'use client';

import { useEffect, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import {
  LinkEditor,
  LinkBlock,
  linkLocked,
  linkSend,
  revalidatePublicLink,
  toPublic,
  useLinkPage,
  useLinkPosts,
} from '@gitroom/frontend/components/link-in-bio/link.api';
import { HugeIcon, type HugeIconName } from '@gitroom/frontend/components/icons/hugeicons';
import { LinkAnchor, LinkField, LinkMenuRow, LinkModal, LinkSegments, LinkToggle, linkChoice, linkDanger, linkPrimary, linkSecondary } from '@gitroom/frontend/components/link-in-bio/link.chrome';
import { LinkPreview, LinkSplit } from '@gitroom/frontend/components/link-in-bio/link.shell';
import { stkCard, stkEmpty, stkIconTile, stkSub, stkTitle } from '@gitroom/frontend/components/stalker/stalker.chrome';
import { LinkPublicView, linkInitials } from '@gitroom/frontend/components/link-in-bio/link.public-view';
import { blockDeleteRequest, embedProblem, parseEmbed, shareMenu, utcToZonedInput } from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.rules';

type EmbedOnly = 'instagram' | 'tiktok' | 'x' | 'threads';

const embedCopy = (provider?: EmbedOnly) => {
  if (provider === 'instagram') {
    return { title: 'Instagram post', hint: 'Paste an Instagram post, reel or TV URL.', placeholder: 'https://www.instagram.com/p/...' };
  }
  if (provider === 'tiktok') {
    return { title: 'TikTok post', hint: 'Paste a TikTok video URL. Short links from vm.tiktok.com and tiktok.com/t work too.', placeholder: 'https://www.tiktok.com/@name/video/...' };
  }
  if (provider === 'x') {
    return { title: 'X post', hint: 'Paste an X post URL.', placeholder: 'https://x.com/name/status/...' };
  }
  if (provider === 'threads') {
    return { title: 'Threads post', hint: 'Paste a Threads post URL.', placeholder: 'https://www.threads.net/@name/post/...' };
  }
  return {
    title: 'Embed',
    hint: 'YouTube, Spotify, SoundCloud, Vimeo, Instagram, TikTok, X, Bluesky or Threads. The player is loaded from that provider.',
    placeholder: 'https://',
  };
};

const embedOnly = (url: string): EmbedOnly | undefined => {
  const provider = parseEmbed(url)?.provider;
  if (provider === 'instagram' || provider === 'tiktok' || provider === 'x' || provider === 'threads') {
    return provider;
  }
  return undefined;
};

type Modal =
  | { kind: 'link'; block?: LinkBlock }
  | { kind: 'heading'; block?: LinkBlock }
  | { kind: 'post'; block?: LinkBlock }
  | { kind: 'embed'; block?: LinkBlock; provider?: EmbedOnly }
  | { kind: 'text'; block?: LinkBlock }
  | { kind: 'faq'; block?: LinkBlock }
  | { kind: 'carousel'; block?: LinkBlock }
  | { kind: 'contact'; block?: LinkBlock }
  | { kind: 'map'; block?: LinkBlock }
  | { kind: 'calendly'; block?: LinkBlock }
  | { kind: 'details'; block?: LinkBlock }
  | { kind: 'discount'; block?: LinkBlock }
  | { kind: 'events'; block?: LinkBlock }
  | { kind: 'capture' }
  | null;

const emptyRule = { country: '', platform: '', language: '', action: 'hide' as const, title: '', url: '' };

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
  lockType: 'NONE' as LinkBlock['lock']['type'],
  password: '',
  layout: 'classic' as LinkBlock['layout'],
  animation: 'none',
  priorityMode: 'none' as LinkBlock['priorityMode'],
  minAge: 18,
  rules: [] as LinkBlock['rules'],
};

const blockIcon = (type: LinkBlock['type']): HugeIconName => {
  if (type === 'HEADING') return 'heading';
  if (type === 'FEATURED_POST' || type === 'IMAGE_CAROUSEL') return 'image';
  if (type === 'EMAIL_CAPTURE' || type === 'CONTACT_FORM') return 'mail';
  if (type === 'TEXT') return 'text';
  if (type === 'EMBED') return 'play';
  if (type === 'FAQ') return 'list';
  if (type === 'MAP') return 'location';
  if (type === 'CALENDLY') return 'calendar';
  if (type === 'EVENTS') return 'calendar-day';
  if (type === 'CONTACT_DETAILS') return 'user';
  if (type === 'DISCOUNT') return 'tag';
  return 'link';
};

const blockName = (block: LinkBlock) => {
  if (block.type === 'FEATURED_POST') return 'Featured post';
  if (block.type === 'EMAIL_CAPTURE') return block.title || 'Email capture';
  if (block.type === 'EMBED') return block.title || 'Embed';
  if (block.type === 'TEXT') return block.title || 'Text';
  if (block.type === 'FAQ') return block.title || 'FAQ';
  if (block.type === 'IMAGE_CAROUSEL') return block.title || 'Image carousel';
  if (block.type === 'CONTACT_FORM') return block.form?.heading || block.title || 'Contact form';
  if (block.type === 'MAP') return block.title || 'Google Maps';
  if (block.type === 'CALENDLY') return block.title || 'Calendly';
  if (block.type === 'CONTACT_DETAILS') return block.title || 'Contact details';
  if (block.type === 'DISCOUNT') return block.discount?.code || block.title || 'Discount code';
  if (block.type === 'EVENTS') return block.title || 'Events';
  return block.title || 'Header';
};

const blockNote = (block: LinkBlock) => {
  if (block.type === 'FEATURED_POST') {
    return block.post ? `${block.post.title} · ${block.post.platform} · ${block.post.dateLabel}` : 'Pick a published post';
  }
  if (block.type === 'LINK') return block.url;
  if (block.type === 'EMAIL_CAPTURE') return 'Collects subscribers on your page';
  if (block.type === 'EMBED') return block.url || 'YouTube, Spotify, SoundCloud, Vimeo, Instagram, TikTok, X, Bluesky or Threads';
  if (block.type === 'TEXT') return block.body || 'Text';
  if (block.type === 'FAQ') return `${block.faq.length} questions`;
  if (block.type === 'IMAGE_CAROUSEL') return `${block.images.length} images`;
  if (block.type === 'CONTACT_FORM') return 'Collects messages on your page';
  if (block.type === 'MAP') return block.url || 'Google Maps';
  if (block.type === 'CALENDLY') return block.url || 'Calendly';
  if (block.type === 'CONTACT_DETAILS') return 'Email, phone, address or website';
  if (block.type === 'DISCOUNT') return block.discount?.note || 'A code visitors can copy';
  if (block.type === 'EVENTS') return `${block.events.length} events`;
  return 'Section divider';
};

const rowMeta = (block: LinkBlock) => {
  const clicks = `${block.clicks.toLocaleString('en-US')} clicks`;
  if (block.type === 'FEATURED_POST') {
    return `From Schedule · ${clicks}`;
  }
  if (block.type === 'LINK') {
    return [clicks, block.spotlight ? 'Spotlight' : '', block.lock?.type && block.lock.type !== 'NONE' ? 'Locked' : '']
      .filter(Boolean)
      .join(' · ');
  }
  return block.spotlight ? `${blockNote(block)} · Spotlight` : blockNote(block);
};

const menuAnchor = (node: HTMLElement): LinkAnchor => {
  const rect = node.getBoundingClientRect();
  const gap = 8;
  const spaceBelow = window.innerHeight - rect.bottom;
  const flip = spaceBelow < 280 && rect.top > spaceBelow;
  return {
    top: rect.bottom + gap,
    right: Math.max(12, window.innerWidth - rect.right),
    bottom: window.innerHeight - rect.top + gap,
    flip,
  };
};

export const LinkEditorScreen = () => {
  const fetch = useFetch();
  const toast = useToaster();
  const { data, error, isLoading, mutate } = useLinkPage();
  const posts = useLinkPosts();
  const [modal, setModal] = useState<Modal>(null);
  const [menu, setMenu] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addAnchor, setAddAnchor] = useState<'head' | 'row'>('row');
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
  const [mapTitle, setMapTitle] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [calendlyTitle, setCalendlyTitle] = useState('');
  const [calendlyUrl, setCalendlyUrl] = useState('');
  const [details, setDetails] = useState({ title: 'Contact', email: '', phone: '', address: '', website: '' });
  const [discount, setDiscount] = useState({ title: '', code: '', note: '', url: '' });
  const [eventsTitle, setEventsTitle] = useState('Upcoming');
  const [events, setEvents] = useState<Array<{ title: string; when: string; place: string; url: string }>>([
    { title: '', when: '', place: '', url: '' },
  ]);
  const [visitor, setVisitor] = useState({ country: '', platform: '', language: '' });
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState('');
  const [sheetAnchor, setSheetAnchor] = useState<LinkAnchor | null>(null);
  const [copied, setCopied] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareQr, setShareQr] = useState('');

  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(''), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

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
        setSheetAnchor(null);
        setConfirmId('');
      }
      if (note) {
        toast.show(note, 'success');
      }
      revalidatePublicLink();
      return true;
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Something went wrong', 'warning');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openLink = (block?: LinkBlock) => {
    if (!block) setSheetAnchor(null);
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
            layout: block.layout || 'classic',
            animation: block.animation || 'none',
            priorityMode: block.priorityMode || (block.priority ? 'highlight' : 'none'),
            minAge: block.minAge || 18,
            rules: block.rules || [],
          }
        : emptyLink
    );
    setModal({ kind: 'link', block });
  };

  useEffect(() => {
    if (!shareOpen) {
      return undefined;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShareOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    let alive = true;
    let objectUrl = '';
    (async () => {
      const response = await fetch('/link-in-bio/qr.png', { headers: { Accept: 'image/png' } });
      if (!response.ok || !alive) {
        return;
      }
      objectUrl = URL.createObjectURL(await response.blob());
      if (alive) {
        setShareQr(objectUrl);
      }
    })();
    return () => {
      alive = false;
      window.removeEventListener('keydown', onKey);
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [shareOpen, fetch]);

  if (isLoading || !data) {
    return (
      <LinkSplit
        preview={
          <LinkPreview onCopy={() => undefined}>
            <div className="h-full w-full bg-newBgColorInner" />
          </LinkPreview>
        }
      >
        <div className="lib-editor-page flex min-w-0 flex-col gap-[12px] pb-[24px]">
          <div className="min-w-0">
            <div className="lib-kicker">
              <span className="lib-sticker">Link-in-Bio</span>
            </div>
            <h1 className={stkTitle}>Editor</h1>
          </div>
          <div className={`${stkCard} ${error ? 'stk-state' : 'lib-loading'} flex items-center gap-[12px]`}>
            {error ? (
              <span className={`${stkIconTile} stk-state-mark`} aria-hidden>
                <HugeIcon name="alert" size={20} className="shrink-0 text-textItemBlur" />
              </span>
            ) : null}
            <p className="text-[14px] font-[500] text-textItemBlur">
              {error ? 'Could not load your page.' : 'Loading your page…'}
            </p>
          </div>
        </div>
      </LinkSplit>
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
    save('/link-in-bio/blocks/reorder', 'PUT', { ids }, undefined, false);
  };

  const move = (id: string, delta: number) => {
    const ids = data.blocks.map((block) => block.id);
    const from = ids.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) {
      return;
    }
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    save('/link-in-bio/blocks/reorder', 'PUT', { ids }, undefined, false);
  };

  const copy = async (value: string) => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Could not copy that link');
      }
      await navigator.clipboard.writeText(value);
      toast.show('Link copied', 'success');
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not copy that link', 'warning');
    }
  };

  const openEmbed = (provider?: EmbedOnly, block?: LinkBlock) => {
    setEmbedTitle(block?.title || '');
    setEmbedUrl(block?.url || '');
    setModal({ kind: 'embed', block, provider });
    setAddOpen(false);
    setMenu('');
  };

  const editBlock = (block: LinkBlock) => {
    setMenu('');
    if (block.type === 'LINK') {
      openLink(block);
      return;
    }
    if (block.type === 'HEADING') {
      setHeading(block.title);
      setModal({ kind: 'heading', block });
      return;
    }
    if (block.type === 'EMBED') {
      openEmbed(embedOnly(block.url), block);
      return;
    }
    if (block.type === 'TEXT') {
      setTextTitle(block.title);
      setTextBody(block.body);
      setModal({ kind: 'text', block });
      return;
    }
    if (block.type === 'FAQ') {
      setFaqTitle(block.title);
      setFaq(block.faq.length ? block.faq : [{ question: '', answer: '' }]);
      setModal({ kind: 'faq', block });
      return;
    }
    if (block.type === 'IMAGE_CAROUSEL') {
      setImages(block.images);
      setModal({ kind: 'carousel', block });
      return;
    }
    if (block.type === 'CONTACT_FORM') {
      setContact({
        title: block.title || block.form?.heading || '',
        body: block.body || block.form?.consent || '',
        button: block.form?.button || 'Send',
        askName: !!block.form?.askName,
      });
      setModal({ kind: 'contact', block });
      return;
    }
    if (block.type === 'MAP') {
      setMapTitle(block.title);
      setMapUrl(block.url);
      setModal({ kind: 'map', block });
      return;
    }
    if (block.type === 'CALENDLY') {
      setCalendlyTitle(block.title);
      setCalendlyUrl(block.url);
      setModal({ kind: 'calendly', block });
      return;
    }
    if (block.type === 'CONTACT_DETAILS') {
      setDetails({
        title: block.title || 'Contact',
        email: block.details?.email || '',
        phone: block.details?.phone || '',
        address: block.details?.address || '',
        website: block.details?.website || '',
      });
      setModal({ kind: 'details', block });
      return;
    }
    if (block.type === 'DISCOUNT') {
      setDiscount({
        title: block.title,
        code: block.discount?.code || '',
        note: block.discount?.note || '',
        url: block.discount?.url || block.url || '',
      });
      setModal({ kind: 'discount', block });
      return;
    }
    if (block.type === 'EVENTS') {
      setEventsTitle(block.title || 'Upcoming');
      setEvents(block.events.length ? block.events : [{ title: '', when: '', place: '', url: '' }]);
      setModal({ kind: 'events', block });
      return;
    }
    if (block.type === 'FEATURED_POST') {
      setPostId(block.postId || '');
      setModal({ kind: 'post', block });
      return;
    }
    if (block.type === 'EMAIL_CAPTURE') {
      setModal({ kind: 'capture' });
    }
  };

  const hasFeatured = data.blocks.some((block) => block.type === 'FEATURED_POST');
  const addMenu = (
              <>
                <div className="lib-add-grid">
                  <LinkMenuRow icon="link" onClick={() => openLink()}>
                    Link
                  </LinkMenuRow>
                  <LinkMenuRow
                    icon="image"
                    className={hasFeatured ? 'is-off' : ''}
                    disabled={hasFeatured}
                    onClick={() => {
                      setPostId('');
                      setModal({ kind: 'post' });
                      setAddOpen(false);
                    }}
                  >
                    <span className="lib-add-copy">
                      Featured post
                      {hasFeatured ? <small className="is-accent">Already on page</small> : null}
                    </span>
                  </LinkMenuRow>
                  <LinkMenuRow
                    icon="mail"
                    onClick={() => {
                      setModal({ kind: 'capture' });
                      setAddOpen(false);
                    }}
                  >
                    <span className="lib-add-copy">
                      Email capture
                      <small>1 per page</small>
                    </span>
                  </LinkMenuRow>
                  <LinkMenuRow
                    icon="heading"
                    onClick={() => {
                      setHeading('');
                      setModal({ kind: 'heading' });
                      setAddOpen(false);
                    }}
                  >
                    Header
                  </LinkMenuRow>
                  <LinkMenuRow icon="code" onClick={() => openEmbed()}>
                    Embed
                  </LinkMenuRow>
                  <LinkMenuRow icon="image" onClick={() => openEmbed('instagram')}>
                    Instagram post
                  </LinkMenuRow>
                  <LinkMenuRow icon="play" onClick={() => openEmbed('tiktok')}>
                    TikTok post
                  </LinkMenuRow>
                  <LinkMenuRow icon="at" onClick={() => openEmbed('x')}>
                    X post
                  </LinkMenuRow>
                  <LinkMenuRow icon="comment" onClick={() => openEmbed('threads')}>
                    Threads post
                  </LinkMenuRow>
                  <LinkMenuRow
                    icon="location"
                    onClick={() => {
                      setMapTitle('');
                      setMapUrl('');
                      setModal({ kind: 'map' });
                      setAddOpen(false);
                    }}
                  >
                    Google Maps
                  </LinkMenuRow>
                  <LinkMenuRow
                    icon="calendar"
                    onClick={() => {
                      setCalendlyTitle('');
                      setCalendlyUrl('');
                      setModal({ kind: 'calendly' });
                      setAddOpen(false);
                    }}
                  >
                    Calendly
                  </LinkMenuRow>
                  <LinkMenuRow
                    icon="mail"
                    onClick={() => {
                      setDetails({ title: 'Contact', email: '', phone: '', address: '', website: '' });
                      setModal({ kind: 'details' });
                      setAddOpen(false);
                    }}
                  >
                    Contact details
                  </LinkMenuRow>
                  <LinkMenuRow
                    icon="billing"
                    onClick={() => {
                      setDiscount({ title: '', code: '', note: '', url: '' });
                      setModal({ kind: 'discount' });
                      setAddOpen(false);
                    }}
                  >
                    Discount code
                  </LinkMenuRow>
                  <LinkMenuRow
                    icon="calendar-day"
                    onClick={() => {
                      setEventsTitle('Upcoming');
                      setEvents([{ title: '', when: '', place: '', url: '' }]);
                      setModal({ kind: 'events' });
                      setAddOpen(false);
                    }}
                  >
                    Events
                  </LinkMenuRow>
                  <LinkMenuRow
                    icon="comment"
                    onClick={() => {
                      setTextTitle('');
                      setTextBody('');
                      setModal({ kind: 'text' });
                      setAddOpen(false);
                    }}
                  >
                    Text
                  </LinkMenuRow>
                  <LinkMenuRow
                    icon="list"
                    onClick={() => {
                      setFaqTitle('');
                      setFaq([{ question: '', answer: '' }]);
                      setModal({ kind: 'faq' });
                      setAddOpen(false);
                    }}
                  >
                    FAQ
                  </LinkMenuRow>
                  <LinkMenuRow
                    icon="image"
                    onClick={() => {
                      setImages([]);
                      setModal({ kind: 'carousel' });
                      setAddOpen(false);
                    }}
                  >
                    Image carousel
                  </LinkMenuRow>
                  <LinkMenuRow
                    icon="mail"
                    onClick={() => {
                      setContact({ title: 'Get in touch', body: '', button: 'Send', askName: false });
                      setModal({ kind: 'contact' });
                      setAddOpen(false);
                    }}
                  >
                    Contact form
                  </LinkMenuRow>
                </div>
                {hasFeatured ? (
                  <p className="lib-add-note">Featured post is already on your page. Edit the existing one, or remove it to add another.</p>
                ) : null}
              </>
  );

  const toggleAdd = (anchor: 'head' | 'row') => {
    setSheetAnchor(null);
    setAddOpen((open) => (addAnchor === anchor ? !open : true));
    setAddAnchor(anchor);
  };

  const pageHost = `${data.publicOrigin.replace(/^https?:\/\//, '')}/${data.slug}`;

  return (
    <LinkSplit
      previewOpen={preview}
      onPreviewClose={() => setPreview(false)}
      preview={
        <LinkPreview
          href={data.publicUrl}
          label={pageHost}
          onCopy={() => {
            copy(data.publicUrl);
            setCopied('page');
          }}
          onClose={preview ? () => setPreview(false) : undefined}
        >
          <LinkPublicView
            key={`${data.slug}-${data.isPublic}-${data.sensitive}`}
            data={toPublic(data, visitor)}
            mode="preview"
          />
        </LinkPreview>
      }
    >
      <div className="lib-editor-page flex min-w-0 flex-col gap-[12px] pb-[24px]">
        <div className="lib-head">
          <div className="min-w-0">
            <div className="lib-kicker">
              <span className="lib-sticker">Link-in-Bio</span>
              <span className={`${stkSub} lib-period truncate`}>{pageHost}</span>
            </div>
            <h1 className={stkTitle}>Editor</h1>
          </div>
          <div className="lib-head-actions">
            <div className="lib-add-slot lib-add-slot-head relative">
              <button
                type="button"
                className={`${linkPrimary} lib-head-add`}
                aria-expanded={addOpen && addAnchor === 'head'}
                onClick={() => toggleAdd('head')}
              >
                <HugeIcon name="plus" size={16} />
                Add block
              </button>
            </div>
          </div>
        </div>

        <section className={`${stkCard} lib-page-card`}>
          <span className="lib-avatar" aria-hidden>
            {data.avatarPath ? <img src={data.avatarPath} alt="" /> : linkInitials(data.name || data.slug)}
          </span>
          <div className="lib-page-copy">
            <strong>{data.name || data.slug}</strong>
            <span className="lib-page-url">
              <i className="lib-page-live" data-live={data.isPublic ? 'true' : 'false'} />
              <span className="truncate">{pageHost}</span>
            </span>
          </div>
          <button
            type="button"
            className={copied === 'page' ? 'lib-icon-btn is-copied' : 'lib-icon-btn'}
            aria-label={copied === 'page' ? 'Link copied' : 'Copy link'}
            onClick={() => {
              copy(data.publicUrl);
              setCopied('page');
            }}
          >
            {copied === 'page' ? (
              <>
                <HugeIcon name="check" size={16} />
                Link copied
              </>
            ) : (
              <HugeIcon name="copy" size={16} />
            )}
          </button>
          <span className="lib-share">
            <button
              type="button"
              className="lib-icon-btn"
              aria-label="Share link"
              aria-expanded={shareOpen}
              onClick={() => {
                setShareCopied(false);
                setShareOpen((open) => !open);
              }}
            >
              <HugeIcon name="share" size={16} />
            </button>
            {shareOpen ? (
              <>
                <button type="button" className="lib-share-backdrop" aria-label="Close share" onClick={() => setShareOpen(false)} />
                <div className="lib-share-menu" role="dialog" aria-label="Share">
                  <button
                    type="button"
                    onClick={() => {
                      copy(data.publicUrl);
                      setShareCopied(true);
                    }}
                  >
                    <HugeIcon name={shareCopied ? 'check' : 'copy'} size={16} />
                    {shareCopied ? 'Link copied' : 'Copy link'}
                  </button>
                  {(
                    [
                      ['X', shareMenu(data.publicUrl, data.name || data.slug).links.x],
                      ['WhatsApp', shareMenu(data.publicUrl, data.name || data.slug).links.whatsapp],
                      ['Facebook', shareMenu(data.publicUrl, data.name || data.slug).links.facebook],
                      ['LinkedIn', shareMenu(data.publicUrl, data.name || data.slug).links.linkedin],
                      ['Email', shareMenu(data.publicUrl, data.name || data.slug).links.email],
                    ] as const
                  ).map(([label, href]) => (
                    <a key={label} href={href} target="_blank" rel="noopener noreferrer">
                      {label}
                    </a>
                  ))}
                  <div className="lib-share-qr">
                    {shareQr ? <img src={shareQr} alt={`QR code for ${data.publicUrl}`} /> : null}
                    <span>QR code</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const menu = shareMenu(data.publicUrl, data.name || data.slug);
                      if (navigator.share) {
                        navigator.share({ title: data.name || data.slug, url: data.publicUrl }).catch(() => undefined);
                        return;
                      }
                      window.open(menu.links.x, '_blank', 'noopener');
                    }}
                  >
                    More…
                  </button>
                </div>
              </>
            ) : null}
          </span>
        </section>

        <div className="lib-editor-actions">
          <details className="lib-preview-as">
            <summary className="lib-preview-as-summary">
              <HugeIcon name="globe" size={14} />
              <span>Preview as: {visitor.platform || 'Any'}</span>
            </summary>
          <div className="lib-preview-as-body">
          <div className="mb-[8px] flex items-center justify-end gap-[8px]">
            <button
              type="button"
              className="lib-preview-as-reset lib-text-btn text-[13px] text-textItemBlur"
              onClick={() => setVisitor({ country: '', platform: '', language: '' })}
            >
              Reset
            </button>
          </div>
          <div className="lib-preview-as-chips" role="group" aria-label="Preview platform">
            {['', 'Instagram', 'TikTok', 'X', 'Threads', 'YouTube', 'Facebook', 'LinkedIn', 'Google', 'Direct'].map((item) => (
              <button
                key={item || 'any'}
                type="button"
                className={visitor.platform === item ? 'is-on' : ''}
                aria-pressed={visitor.platform === item}
                onClick={() => setVisitor({ ...visitor, platform: item })}
              >
                {item || 'Any'}
              </button>
            ))}
          </div>
          <div className="mt-[12px] grid grid-cols-1 gap-[8px] sm:grid-cols-2">
            <LinkField label="Country">
              <input
                value={visitor.country}
                maxLength={2}
                placeholder="IN"
                aria-label="Preview country"
                onChange={(event) => setVisitor({ ...visitor, country: event.target.value.toUpperCase() })}
              />
            </LinkField>
            <LinkField label="Language">
              <input
                value={visitor.language}
                maxLength={12}
                placeholder="en"
                aria-label="Preview language"
                onChange={(event) => setVisitor({ ...visitor, language: event.target.value.toLowerCase() })}
              />
            </LinkField>
          </div>
          <p className="lib-preview-as-note mt-[10px] flex flex-wrap items-center gap-[8px] text-[13px] text-textItemBlur">
            <span>Rules hide a link or change its title and URL in this preview.</span>
            <span className="lib-pill lib-pill-pro">★ Pro</span>
          </p>
          </div>
        </details>
        </div>

        {!data.blocks.length ? (
          <div className={`${stkCard} ${stkEmpty} stk-state`}>
            <span className={`${stkIconTile} stk-state-mark`} aria-hidden>
              <HugeIcon name="link" size={24} />
            </span>
            <h2 className="text-[16px] font-[600]">No links yet</h2>
            <div className="lib-teach">
              <button type="button" className={linkSecondary} onClick={() => openLink()}>
                <HugeIcon name="link" size={16} />
                Link
              </button>
              <button
                type="button"
                className={linkSecondary}
                onClick={() => {
                  setPostId('');
                  setModal({ kind: 'post' });
                  setAddOpen(false);
                }}
              >
                <HugeIcon name="image" size={16} />
                Featured post
              </button>
              <button
                type="button"
                className={linkSecondary}
                onClick={() => {
                  setModal({ kind: 'capture' });
                  setAddOpen(false);
                }}
              >
                <HugeIcon name="mail" size={16} />
                Email capture
              </button>
            </div>
          </div>
        ) : (
          data.blocks.map((block, index) => (
            <article
              key={block.id}
              className={`lib-editor-row ${stkCard} !p-[14px]`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                reorder(event.dataTransfer.getData('text/plain'), block.id);
              }}
            >
              <div className="lib-editor-move">
                <button type="button" aria-label="Move up" disabled={busy || index === 0} onClick={() => move(block.id, -1)}>
                  <HugeIcon name="chevron-up" size={14} />
                </button>
                <span
                  className="lib-editor-drag cursor-grab text-textItemBlur"
                  draggable
                  aria-label="Drag to reorder"
                  onDragStart={(event) => event.dataTransfer.setData('text/plain', block.id)}
                >
                  <HugeIcon name="drag" size={16} />
                </span>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={busy || index === data.blocks.length - 1}
                  onClick={() => move(block.id, 1)}
                >
                  <HugeIcon name="chevron-down" size={14} />
                </button>
              </div>
              <span className="lib-type-tile" aria-hidden>
                <HugeIcon name={blockIcon(block.type)} size={18} />
              </span>
              <div className="lib-editor-copy">
                <div className="lib-editor-titleline">
                  <strong className="lib-editor-name">
                    {blockName(block)}
                    {block.priority ? <HugeIcon className="lib-priority-star" name="star" size={14} aria-label="Priority" /> : null}
                  </strong>
                </div>
                <div className="lib-editor-meta">
                  <span
                    className={`lib-pill${
                      block.state === 'scheduled'
                        ? ' lib-pill-scheduled'
                        : !block.enabled || block.state === 'hidden' || block.state === 'ended'
                          ? ''
                          : ' lib-pill-live'
                    }`}
                  >
                    {block.state === 'scheduled'
                      ? 'Scheduled'
                      : block.state === 'ended'
                        ? 'Ended'
                        : !block.enabled || block.state === 'hidden'
                          ? 'Hidden'
                          : 'Live'}
                  </span>
                  <p className="lib-editor-note">{rowMeta(block)}</p>
                </div>
                {block.type === 'FEATURED_POST' && !block.post ? (
                  <p className="lib-editor-warn">This post is no longer available. Choose another published post.</p>
                ) : null}
              </div>
              <div className="lib-editor-tools">
                <span className="lib-editor-toggle shrink-0">
                  <LinkToggle
                    checked={block.enabled}
                    label={block.enabled ? 'Hide block' : 'Show block'}
                    onChange={(enabled) => save(`/link-in-bio/blocks/${block.id}`, 'PUT', { enabled })}
                  />
                </span>
              <div className="lib-editor-menu relative shrink-0">
                <button type="button" className="lib-editor-more grid h-[32px] w-[32px] place-items-center rounded-[12px] text-textItemBlur hover:bg-newBoxHover hover:text-newTextColor" aria-label="Block actions" onClick={(event) => { if (menu === block.id) { setMenu(''); setSheetAnchor(null); } else { setSheetAnchor(menuAnchor(event.currentTarget)); setMenu(block.id); } setConfirmId(''); }}>
                  <HugeIcon name="more" size={18} />
                </button>
                {menu === block.id ? (
                  <LinkModal anchor={sheetAnchor} title={blockName(block)} onClose={() => { setMenu(''); setConfirmId(''); setSheetAnchor(null); }}>
                  <div className="lib-block-sheet">
                    <div className="lib-block-move">
                      <button type="button" className={linkSecondary} disabled={busy || index === 0} onClick={() => move(block.id, -1)}>
                        <HugeIcon name="chevron-up" size={16} />
                        Move up
                      </button>
                      <button type="button" className={linkSecondary} disabled={busy || index === data.blocks.length - 1} onClick={() => move(block.id, 1)}>
                        <HugeIcon name="chevron-down" size={16} />
                        Move down
                      </button>
                    </div>
                    <div className="lib-block-list">
                      <LinkMenuRow icon="settings" onClick={() => editBlock(block)}>
                        Edit
                      </LinkMenuRow>
                      <LinkMenuRow
                        icon={copied === block.id ? 'check' : 'copy'}
                        onClick={() => {
                          if (!block.url) return;
                          copy(block.url);
                          setCopied(block.id);
                        }}
                      >
                        {copied === block.id ? 'Link copied' : 'Copy link'}
                      </LinkMenuRow>
                      <LinkMenuRow
                        className={block.priority ? 'is-priority' : ''}
                        icon="star"
                        onClick={() =>
                          save(
                            `/link-in-bio/blocks/${block.id}`,
                            'PUT',
                            { priority: !block.priority },
                            block.priority ? 'Priority removed' : 'Marked as priority'
                          )
                        }
                      >
                        {block.priority ? 'Remove priority' : 'Make priority'}
                      </LinkMenuRow>
                      <LinkMenuRow icon="clock" onClick={() => (block.type === 'LINK' ? openLink(block) : editBlock(block))}>
                        Schedule
                      </LinkMenuRow>
                      <LinkMenuRow
                        icon="trash"
                        danger
                        onClick={() => {
                          setMenu('');
                          setSheetAnchor(null);
                          setConfirmId(block.id);
                        }}
                      >
                        Delete
                      </LinkMenuRow>
                    </div>
                  </div>
                  </LinkModal>
                ) : null}
              </div>
              </div>
            </article>
          ))
        )}
        {preview ? null : (
          <button type="button" className={`${linkPrimary} lib-preview-fab`} onClick={() => setPreview(true)}>
            <HugeIcon name="eye" size={18} />
            Preview
          </button>
        )}
      </div>

      {addOpen ? (
        <LinkModal title="Add block" onClose={() => setAddOpen(false)}>
          {addMenu}
        </LinkModal>
      ) : null}

      {confirmId ? (
        <LinkModal title="Remove this block?" onClose={() => setConfirmId('')}>
          <p className="text-[14px] text-textItemBlur">This removes it from your page.</p>
          <div className="lib-confirm-actions">
            <button type="button" className={linkSecondary} onClick={() => setConfirmId('')}>
              Cancel
            </button>
            <button
              type="button"
              className={linkDanger}
              disabled={busy}
              onClick={() => {
                const request = blockDeleteRequest(confirmId);
                void save(request.path, request.method, undefined, 'Removed');
              }}
            >
              Remove
            </button>
          </div>
        </LinkModal>
      ) : null}

      {modal?.kind === 'link' ? (
        <LinkModal title={modal.block ? 'Edit link' : 'Add link'} anchor={modal?.block ? sheetAnchor : null} onClose={() => setModal(null)}>
          <div className="lib-link-form flex flex-col gap-[14px]">
            <LinkField label="Title">
              <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
            </LinkField>
            <LinkField label="URL">
              <input value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} placeholder="https://" />
            </LinkField>
            <div className="lib-field">
              <span>Layout</span>
              <LinkSegments
                label="Layout"
                value={draft.layout}
                options={[
                  { id: 'classic', label: 'Classic' },
                  { id: 'featured', label: 'Featured' },
                ]}
                onChange={(layout) => {
                  if (layout === 'featured' && linkLocked(data)) {
                    toast.show('Featured cards are on a paid plan', 'warning');
                    return;
                  }
                  setDraft({ ...draft, layout });
                }}
              />
            </div>
            <div className="lib-option-row">
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
            <div className="lib-field">
              <span>Animation</span>
              <div className="lib-anim-chips">
                {['none', 'wiggle', 'pop', 'electricity', 'glitch', 'shimmer', 'bounce', 'pulse'].map((animation) => (
                  <button
                    key={animation}
                    type="button"
                    className={draft.animation === animation ? linkChoice : linkSecondary}
                    onClick={() => {
                      if (animation !== 'none' && linkLocked(data)) {
                        toast.show('Link animations are on a paid plan', 'warning');
                        return;
                      }
                      setDraft({ ...draft, animation });
                    }}
                  >
                    {animation[0].toUpperCase() + animation.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[13px] text-textItemBlur">Only one link can animate at a time. Featured cards are Pro.</p>
            <div className="lib-option-row">
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
            <LinkField label="Prioritize">
              <select
                value={draft.priorityMode}
                onChange={(event) => {
                  const priorityMode = event.target.value as typeof draft.priorityMode;
                  if ((priorityMode === 'expand' || priorityMode === 'redirect') && linkLocked(data)) {
                    toast.show('Expand and redirect are on a paid plan', 'warning');
                    return;
                  }
                  setDraft({ ...draft, priorityMode, priority: priorityMode !== 'none' });
                }}
              >
                <option value="none">None</option>
                <option value="highlight">Highlight at the top</option>
                <option value="expand">Auto-expand</option>
                <option value="redirect">Redirect all visitors</option>
              </select>
            </LinkField>
            <p className="text-[13px] text-textItemBlur">Only one link can be prioritized. A redirect cannot be locked.</p>
            <div className="lib-option-row">
              <div>
                <div className="text-[14px] font-[500]">Spotlight</div>
                <p className="text-[13px] text-textItemBlur">
                  {linkLocked(data) ? 'Spotlight is on a paid plan' : 'Animated highlight on this link'}
                </p>
              </div>
              <LinkToggle
                checked={draft.spotlight}
                label="Spotlight"
                onChange={(spotlight) => {
                  if (spotlight && linkLocked(data)) {
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
                  if (lockType !== 'NONE' && linkLocked(data)) {
                    toast.show('Locked links are on a paid plan', 'warning');
                    return;
                  }
                  setDraft({ ...draft, lockType });
                }}
              >
                <option value="NONE">No lock</option>
                <option value="AGE">Age gate</option>
                <option value="DOB">Date of birth</option>
                <option value="EMAIL">Email required</option>
                <option value="PASSWORD">Password</option>
                <option value="CODE">Code</option>
                <option value="SENSITIVE">Sensitive content</option>
              </select>
            </LinkField>
            {draft.lockType === 'AGE' || draft.lockType === 'DOB' ? (
              <LinkField label="Minimum age">
                <input
                  type="number"
                  min={13}
                  max={120}
                  value={draft.minAge}
                  onChange={(event) => setDraft({ ...draft, minAge: Number(event.target.value) || 18 })}
                />
              </LinkField>
            ) : null}
            {draft.lockType === 'PASSWORD' || draft.lockType === 'CODE' ? (
              <LinkField label={modal.block?.lock.hasPassword ? (draft.lockType === 'CODE' ? 'New code' : 'New password') : draft.lockType === 'CODE' ? 'Code' : 'Password'}>
                <input
                  type={draft.lockType === 'CODE' ? 'text' : 'password'}
                  value={draft.password}
                  placeholder={modal.block?.lock.hasPassword ? 'Leave blank to keep the current one' : ''}
                  onChange={(event) => setDraft({ ...draft, password: event.target.value })}
                />
              </LinkField>
            ) : null}
            <div className="lib-option-row">
              <div>
                <div className="text-[14px] font-[500]">Visitor rules</div>
                <p className="text-[13px] text-textItemBlur">If country, platform or language match, hide the link or change its title or URL</p>
              </div>
              <button
                type="button"
                className={linkSecondary}
                onClick={() => {
                  if (linkLocked(data)) {
                    toast.show('Visitor rules are on a paid plan', 'warning');
                    return;
                  }
                  setDraft({ ...draft, rules: [...draft.rules, { ...emptyRule }] });
                }}
              >
                Add rule
              </button>
            </div>
            {draft.rules.map((rule, index) => (
              <div key={index} className="flex flex-col gap-[8px] rounded-[16px] border border-newBorder p-[10px]">
                <div className="grid grid-cols-1 gap-[8px] sm:grid-cols-3">
                  <LinkField label="Country">
                    <input
                      value={rule.country}
                      maxLength={2}
                      placeholder="IN"
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          rules: draft.rules.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, country: event.target.value.toUpperCase() } : row
                          ),
                        })
                      }
                    />
                  </LinkField>
                  <LinkField label="Platform">
                    <input
                      value={rule.platform}
                      placeholder="Instagram"
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          rules: draft.rules.map((row, rowIndex) => (rowIndex === index ? { ...row, platform: event.target.value } : row)),
                        })
                      }
                    />
                  </LinkField>
                  <LinkField label="Language">
                    <input
                      value={rule.language}
                      placeholder="en"
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          rules: draft.rules.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, language: event.target.value.toLowerCase() } : row
                          ),
                        })
                      }
                    />
                  </LinkField>
                </div>
                <LinkField label="Then">
                  <select
                    value={rule.action}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        rules: draft.rules.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, action: event.target.value === 'title' || event.target.value === 'url' ? event.target.value : 'hide' } : row
                        ),
                      })
                    }
                  >
                    <option value="hide">Hide link</option>
                    <option value="title">Change title</option>
                    <option value="url">Change URL</option>
                  </select>
                </LinkField>
                {rule.action === 'title' ? (
                  <LinkField label="New title">
                    <input
                      value={rule.title}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          rules: draft.rules.map((row, rowIndex) => (rowIndex === index ? { ...row, title: event.target.value } : row)),
                        })
                      }
                    />
                  </LinkField>
                ) : null}
                {rule.action === 'url' ? (
                  <LinkField label="New URL">
                    <input
                      value={rule.url}
                      placeholder="https://"
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          rules: draft.rules.map((row, rowIndex) => (rowIndex === index ? { ...row, url: event.target.value } : row)),
                        })
                      }
                    />
                  </LinkField>
                ) : null}
                <button
                  type="button"
                  className="self-start text-[13px] text-textItemBlur"
                  onClick={() => setDraft({ ...draft, rules: draft.rules.filter((_, rowIndex) => rowIndex !== index) })}
                >
                  Remove rule
                </button>
              </div>
            ))}
            <div className="flex justify-end gap-[8px]">
              <button type="button" className={linkSecondary} onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={linkPrimary}
                disabled={busy}
                onClick={() => {
                  if (draft.priorityMode === 'redirect' && draft.lockType !== 'NONE') {
                    toast.show("A redirect link can't be locked", 'warning');
                    return;
                  }
                  const rules = draft.rules.filter((rule) => rule.country || rule.platform || rule.language);
                  const body = {
                    title: draft.title,
                    url: draft.url,
                    scheduleOn: draft.scheduleOn,
                    startsLocal: draft.startsLocal,
                    endsLocal: draft.endsLocal,
                    priorityMode: draft.priorityMode,
                    thumbnail: draft.thumbnail,
                    iconMode: draft.iconMode,
                    spotlight: draft.spotlight,
                    lockType: draft.lockType,
                    layout: draft.layout,
                    animation: draft.animation,
                    minAge: draft.minAge,
                    rules,
                    ...(draft.password ? { password: draft.password } : {}),
                  };
                  save(
                    modal.block ? `/link-in-bio/blocks/${modal.block.id}` : '/link-in-bio/blocks',
                    modal.block ? 'PUT' : 'POST',
                    modal.block ? body : { type: 'LINK', ...body },
                    modal.block ? 'Link saved' : 'Link added'
                  );
                }}
              >
                {modal.block ? 'Save changes' : 'Add link'}
              </button>
            </div>
          </div>
        </LinkModal>
      ) : null}

      {modal?.kind === 'heading' ? (
        <LinkModal title={modal.block ? 'Edit header' : 'Add header'} anchor={modal?.block ? sheetAnchor : null} onClose={() => setModal(null)}>
          <div className="lib-block-form flex flex-col gap-[14px]">
            <LinkField label="Header">
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
                    'Header saved'
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
        <LinkModal title={modal.block ? 'Change post' : 'Add featured post'} anchor={modal?.block ? sheetAnchor : null} onClose={() => setModal(null)}>
          <p className="mb-[10px] text-[14px] text-textItemBlur">Pick a published post from Schedule</p>
          <div className="flex max-h-[320px] flex-col gap-[8px] overflow-auto">
            {(posts.data || []).map((post) => (
              <button
                key={post.id}
                type="button"
                className={postId === post.id ? 'lib-post-pick is-on' : 'lib-post-pick'}
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
              {modal.block ? 'Change post' : 'Add post'}
            </button>
          </div>
        </LinkModal>
      ) : null}

      {modal?.kind === 'embed' ? (
        <LinkModal title={modal.block ? `Edit ${embedCopy(modal.provider).title.toLowerCase()}` : `Add ${embedCopy(modal.provider).title.toLowerCase()}`} anchor={modal?.block ? sheetAnchor : null} onClose={() => setModal(null)}>
          <div className="lib-block-form flex flex-col gap-[14px]">
            <LinkField label="Title">
              <input value={embedTitle} onChange={(event) => setEmbedTitle(event.target.value)} />
            </LinkField>
            <LinkField label="URL">
              <input value={embedUrl} placeholder={embedCopy(modal.provider).placeholder} onChange={(event) => setEmbedUrl(event.target.value)} />
            </LinkField>
            <p className="text-[13px] text-textItemBlur">{embedCopy(modal.provider).hint}</p>
            <div className="flex justify-end gap-[8px]">
              <button type="button" className={linkSecondary} onClick={() => setModal(null)}>Cancel</button>
              <button
                type="button"
                className={linkPrimary}
                disabled={busy}
                onClick={() => {
                  const problem = embedProblem(embedUrl, modal.provider);
                  if (problem) {
                    toast.show(problem, 'warning');
                    return;
                  }
                  save(
                    modal.block ? `/link-in-bio/blocks/${modal.block.id}` : '/link-in-bio/blocks',
                    modal.block ? 'PUT' : 'POST',
                    modal.block ? { title: embedTitle, url: embedUrl } : { type: 'EMBED', title: embedTitle, url: embedUrl },
                    'Embed saved'
                  );
                }}
              >
                Save
              </button>
            </div>
          </div>
        </LinkModal>
      ) : null}

      {modal?.kind === 'text' ? (
        <LinkModal title={modal.block ? 'Edit text' : 'Add text'} anchor={modal?.block ? sheetAnchor : null} onClose={() => setModal(null)}>
          <div className="lib-block-form flex flex-col gap-[14px]">
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
        <LinkModal title={modal.block ? 'Edit FAQ' : 'Add FAQ'} anchor={modal?.block ? sheetAnchor : null} onClose={() => setModal(null)}>
          <div className="lib-block-form flex flex-col gap-[12px]">
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
        <LinkModal title={modal.block ? 'Edit carousel' : 'Add carousel'} anchor={modal?.block ? sheetAnchor : null} onClose={() => setModal(null)}>
          <div className="lib-block-form flex flex-col gap-[12px]">
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
        <LinkModal title={modal.block ? 'Edit contact form' : 'Add contact form'} anchor={modal?.block ? sheetAnchor : null} onClose={() => setModal(null)}>
          <div className="lib-block-form flex flex-col gap-[12px]">
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

      {modal?.kind === 'map' ? (
        <LinkModal title={modal.block ? 'Edit map' : 'Add map'} anchor={modal?.block ? sheetAnchor : null} onClose={() => setModal(null)}>
          <div className="lib-block-form flex flex-col gap-[14px]">
            <LinkField label="Title">
              <input value={mapTitle} onChange={(event) => setMapTitle(event.target.value)} />
            </LinkField>
            <LinkField label="Google Maps URL">
              <input value={mapUrl} placeholder="https://www.google.com/maps/place/..." onChange={(event) => setMapUrl(event.target.value)} />
            </LinkField>
            <p className="text-[13px] text-textItemBlur">Paste a Google Maps place, search or embed link. Short links are not fetched.</p>
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
                    modal.block ? { title: mapTitle, url: mapUrl } : { type: 'MAP', title: mapTitle, url: mapUrl },
                    'Map saved'
                  )
                }
              >
                Save
              </button>
            </div>
          </div>
        </LinkModal>
      ) : null}

      {modal?.kind === 'calendly' ? (
        <LinkModal title={modal.block ? 'Edit Calendly' : 'Add Calendly'} anchor={modal?.block ? sheetAnchor : null} onClose={() => setModal(null)}>
          <div className="lib-block-form flex flex-col gap-[14px]">
            <LinkField label="Title">
              <input value={calendlyTitle} onChange={(event) => setCalendlyTitle(event.target.value)} />
            </LinkField>
            <LinkField label="Calendly URL">
              <input value={calendlyUrl} placeholder="https://calendly.com/you/30min" onChange={(event) => setCalendlyUrl(event.target.value)} />
            </LinkField>
            <p className="text-[13px] text-textItemBlur">The booking page is loaded from Calendly.</p>
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
                    modal.block ? { title: calendlyTitle, url: calendlyUrl } : { type: 'CALENDLY', title: calendlyTitle, url: calendlyUrl },
                    'Calendly saved'
                  )
                }
              >
                Save
              </button>
            </div>
          </div>
        </LinkModal>
      ) : null}

      {modal?.kind === 'details' ? (
        <LinkModal title={modal.block ? 'Edit contact details' : 'Add contact details'} anchor={modal?.block ? sheetAnchor : null} onClose={() => setModal(null)}>
          <div className="lib-block-form flex flex-col gap-[12px]">
            <LinkField label="Heading">
              <input value={details.title} onChange={(event) => setDetails({ ...details, title: event.target.value })} />
            </LinkField>
            <LinkField label="Email">
              <input value={details.email} onChange={(event) => setDetails({ ...details, email: event.target.value })} />
            </LinkField>
            <LinkField label="Phone">
              <input value={details.phone} onChange={(event) => setDetails({ ...details, phone: event.target.value })} />
            </LinkField>
            <LinkField label="Address">
              <input value={details.address} onChange={(event) => setDetails({ ...details, address: event.target.value })} />
            </LinkField>
            <LinkField label="Website">
              <input value={details.website} placeholder="https://" onChange={(event) => setDetails({ ...details, website: event.target.value })} />
            </LinkField>
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
                    {
                      ...(modal.block ? {} : { type: 'CONTACT_DETAILS' }),
                      title: details.title,
                      detailEmail: details.email,
                      detailPhone: details.phone,
                      detailAddress: details.address,
                      detailWebsite: details.website,
                    },
                    'Contact details saved'
                  )
                }
              >
                Save
              </button>
            </div>
          </div>
        </LinkModal>
      ) : null}

      {modal?.kind === 'discount' ? (
        <LinkModal title={modal.block ? 'Edit discount code' : 'Add discount code'} anchor={modal?.block ? sheetAnchor : null} onClose={() => setModal(null)}>
          <div className="lib-block-form flex flex-col gap-[12px]">
            <LinkField label="Code">
              <input value={discount.code} onChange={(event) => setDiscount({ ...discount, code: event.target.value })} />
            </LinkField>
            <LinkField label="Note">
              <input value={discount.note} onChange={(event) => setDiscount({ ...discount, note: event.target.value })} />
            </LinkField>
            <LinkField label="Link">
              <input value={discount.url} placeholder="https://" onChange={(event) => setDiscount({ ...discount, url: event.target.value })} />
            </LinkField>
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
                    {
                      ...(modal.block ? {} : { type: 'DISCOUNT' }),
                      title: discount.title || discount.code,
                      url: discount.url,
                      discountCode: discount.code,
                      discountNote: discount.note,
                    },
                    'Discount code saved'
                  )
                }
              >
                Save
              </button>
            </div>
          </div>
        </LinkModal>
      ) : null}

      {modal?.kind === 'events' ? (
        <LinkModal title={modal.block ? 'Edit events' : 'Add events'} anchor={modal?.block ? sheetAnchor : null} onClose={() => setModal(null)}>
          <div className="lib-block-form flex flex-col gap-[12px]">
            <LinkField label="Heading">
              <input value={eventsTitle} onChange={(event) => setEventsTitle(event.target.value)} />
            </LinkField>
            {events.map((item, index) => (
              <div key={index} className="flex flex-col gap-[8px] rounded-[16px] border border-newBorder p-[10px]">
                <LinkField label="Title">
                  <input
                    value={item.title}
                    onChange={(event) => setEvents(events.map((row, rowIndex) => (rowIndex === index ? { ...row, title: event.target.value } : row)))}
                  />
                </LinkField>
                <div className="grid grid-cols-1 gap-[8px] sm:grid-cols-2">
                  <LinkField label="When">
                    <input
                      type="datetime-local"
                      value={/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(item.when) ? item.when.slice(0, 16) : ''}
                      onChange={(event) => setEvents(events.map((row, rowIndex) => (rowIndex === index ? { ...row, when: event.target.value } : row)))}
                    />
                  </LinkField>
                  <LinkField label="Place">
                    <input
                      value={item.place}
                      onChange={(event) => setEvents(events.map((row, rowIndex) => (rowIndex === index ? { ...row, place: event.target.value } : row)))}
                    />
                  </LinkField>
                </div>
                <LinkField label="URL">
                  <input
                    value={item.url}
                    placeholder="https://"
                    onChange={(event) => setEvents(events.map((row, rowIndex) => (rowIndex === index ? { ...row, url: event.target.value } : row)))}
                  />
                </LinkField>
              </div>
            ))}
            <button type="button" className={linkSecondary} onClick={() => setEvents([...events, { title: '', when: '', place: '', url: '' }])}>
              Add event
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
                    {
                      ...(modal.block ? {} : { type: 'EVENTS' }),
                      title: eventsTitle,
                      events: events.filter((item) => item.title.trim()),
                    },
                    'Events saved'
                  )
                }
              >
                Save
              </button>
            </div>
          </div>
        </LinkModal>
      ) : null}

      {modal?.kind === 'capture' ? <CaptureModal page={data} busy={busy} anchor={sheetAnchor} onClose={() => setModal(null)} onSave={save} /> : null}
    </LinkSplit>
  );
};

const CaptureModal = ({
  page,
  busy,
  anchor,
  onClose,
  onSave,
}: {
  page: LinkEditor;
  busy: boolean;
  anchor?: LinkAnchor | null;
  onClose: () => void;
  onSave: (path: string, method: string, body?: unknown, note?: string, close?: boolean) => Promise<boolean>;
}) => {
  const [form, setForm] = useState(page.capture);
  const existing = page.blocks.find((block) => block.type === 'EMAIL_CAPTURE');
  const [placement, setPlacement] = useState<'above' | 'below'>(
    existing && page.blocks[0]?.id === existing.id ? 'above' : 'below'
  );
  return (
    <LinkModal title="Email capture" anchor={anchor} onClose={onClose}>
      <div className="lib-block-form flex flex-col gap-[12px]">
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
