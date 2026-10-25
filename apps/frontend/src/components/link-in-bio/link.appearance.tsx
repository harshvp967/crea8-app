'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import {
  LINK_BUTTON_FILLS,
  LINK_BUTTONS,
  LINK_FONTS,
  LINK_HEADERS,
  LINK_PATTERNS,
  LINK_SHADOWS,
  LINK_SOCIALS,
  LINK_THEMES,
  LINK_WALLPAPERS,
  LinkDesign,
  imagePathProblem,
  normalizeDesign,
  themePalette,
  urlProblem,
} from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.rules';
import { LinkEditor, linkLocked, linkSend, revalidatePublicLink, toPublic, useLinkPage } from '@gitroom/frontend/components/link-in-bio/link.api';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { LinkField, LinkModal, LinkToggle, linkDanger, linkPrimary, linkSecondary } from '@gitroom/frontend/components/link-in-bio/link.chrome';
import { SegmentedControl } from '@gitroom/frontend/components/ui/segmented-control';
import { LinkPreview, LinkSplit, LinkViewTabs } from '@gitroom/frontend/components/link-in-bio/link.shell';
import { LinkPublicView, SocialMark, linkInitials } from '@gitroom/frontend/components/link-in-bio/link.public-view';
import { stkCard, stkIconTile, stkSub, stkTitle } from '@gitroom/frontend/components/stalker/stalker.chrome';
import { useAddProvider } from '@gitroom/frontend/components/launches/add.provider.component';

type Draft = {
  name: string;
  bio: string;
  avatarPath: string;
  theme: string;
  buttonStyle: string;
  font: string;
  backgroundMode: string;
  backgroundColor: string;
  backgroundImage: string;
  socials: Array<{ network: string; url: string }>;
  design: LinkDesign;
  hidden: string[];
};

const colours = ['#0a0a0a', '#ffffff', '#00D9FF', '#111111', '#6b4a32', '#e11d74'];
const emptyColors = { background: '', button: '', buttonText: '', pageText: '', title: '' };

const radiusPreset = (radius: number, buttonStyle: string) => {
  if (radius < 0) return buttonStyle;
  if (radius >= 24) return 'pill';
  if (radius >= 12) return 'rounded';
  return 'square';
};

const copyLink = async (value: string) => {
  if (!navigator.clipboard?.writeText) {
    throw new Error('Could not copy that link');
  }
  await navigator.clipboard.writeText(value);
};

const toDraft = (page: LinkEditor): Draft => {
  const design = normalizeDesign(page.design);
  return {
    name: page.name.slice(0, 30),
    bio: page.bio.slice(0, 160),
    avatarPath: page.avatarPath,
    theme: page.theme,
    buttonStyle: page.buttonStyle,
    font: page.font || 'Plus Jakarta Sans',
    backgroundMode: page.backgroundMode || 'colour',
    backgroundColor: page.backgroundColor && page.backgroundColor.toLowerCase() !== '#0a0a0a' ? page.backgroundColor : '',
    backgroundImage: page.backgroundImage,
    socials: page.socials.map((item) => ({ ...item })),
    design,
    hidden: design.hiddenSocials,
  };
};

const Star = () => (
  <span className="lib-tile-star" aria-hidden>
    <HugeIcon name="star" size={10} />
  </span>
);

const labelOf = (value: string) => (value ? value[0].toUpperCase() + value.slice(1) : value);

const AccItem = ({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) => (
  <div className={open ? 'lib-acc-item is-open' : 'lib-acc-item'}>
    <button type="button" className="lib-acc-head" aria-expanded={open} onClick={onToggle}>
      <span className="lib-acc-copy">
        <span className="lib-acc-title">{title}</span>
        <span className="lib-acc-sub">{summary}</span>
      </span>
      <HugeIcon name={open ? 'chevron-down' : 'chevron-right'} size={18} />
    </button>
    {open ? <div className="lib-acc-body">{children}</div> : null}
  </div>
);

export const LinkAppearanceScreen = () => {
  const fetch = useFetch();
  const toast = useToaster();
  const { data, error, isLoading, mutate } = useLinkPage();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [socialErrors, setSocialErrors] = useState<Array<string | null>>([]);
  const [removeSocial, setRemoveSocial] = useState<number | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [section, setSection] = useState<string | null>(null);
  const [customColour, setCustomColour] = useState(false);
  const [editSocial, setEditSocial] = useState<number | null>(null);
  const connect = useAddProvider(() => {
    mutate();
  });
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const savedDraft = useRef('');
  const sawDraft = useRef(false);
  const busyRef = useRef(false);
  const saveToken = useRef(0);
  const saveRef = useRef<(quiet?: boolean) => Promise<void>>(async () => undefined);

  useEffect(() => {
    if (!draft) {
      return undefined;
    }
    const snapshot = JSON.stringify(draft);
    if (!sawDraft.current) {
      savedDraft.current = snapshot;
      sawDraft.current = true;
      return undefined;
    }
    if (snapshot === savedDraft.current) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      void saveRef.current(true);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [draft]);

  if (data && !draft) {
    setDraft(toDraft(data));
  }

  if (isLoading || !data || !draft) {
    return (
      <div className="lib-appearance flex min-w-0 flex-col gap-[12px] pb-[24px]">
        <div className="min-w-0">
          <div className="lib-kicker">
            <span className="lib-sticker">Link-in-Bio</span>
          </div>
          <h1 className={stkTitle}>Appearance</h1>
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
    );
  }

  const locked = linkLocked(data);
  const design = draft.design;

  const setDesign = (patch: Partial<LinkDesign>) => {
    const wallpaper =
      'wallpaper' in patch || 'pattern' in patch || 'gradientFrom' in patch || 'gradientTo' in patch;
    setDraft({
      ...draft,
      design: { ...design, ...patch, ...(wallpaper ? { wallpaperChosen: true } : {}) },
    });
  };

  const guard = (pro: boolean, message: string) => {
    if (pro && locked) {
      toast.show(message, 'warning');
      return false;
    }
    return true;
  };

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

  const save = async (quiet?: boolean) => {
    const current = draftRef.current;
    if (!current) {
      return;
    }
    if (busyRef.current) {
      if (quiet === true) {
        window.setTimeout(() => {
          void saveRef.current(true);
        }, 700);
      }
      return;
    }
    const silent = quiet === true;
    const currentDesign = current.design;
    const logoProblem = currentDesign.logoUrl.trim() ? imagePathProblem(currentDesign.logoUrl) : null;
    const nextSocialErrors = current.socials.map((item) => (item.url.trim() ? urlProblem(item.url) : null));
    setLogoError(logoProblem || '');
    setSocialErrors(nextSocialErrors);
    if (logoProblem || nextSocialErrors.some(Boolean)) {
      toast.show(logoProblem || nextSocialErrors.find(Boolean) || 'Check that link', 'warning');
      return;
    }
    const snapshot = JSON.stringify(current);
    const token = ++saveToken.current;
    busyRef.current = true;
    setBusy(true);
    try {
      const next = await linkSend(fetch, '/link-in-bio', 'PUT', {
        name: current.name,
        bio: current.bio,
        avatarPath: current.avatarPath,
        theme: current.theme,
        buttonStyle: radiusPreset(currentDesign.radius, current.buttonStyle),
        font: current.font,
        backgroundMode: currentDesign.wallpaperChosen ? 'colour' : current.backgroundMode,
        backgroundColor: currentDesign.colors.background || current.backgroundColor,
        socials: current.socials.filter((item) => item.url.trim()),
        design: { ...currentDesign, hiddenSocials: current.hidden, wallpaperChosen: currentDesign.wallpaperChosen },
      });
      revalidatePublicLink();
      if (token !== saveToken.current || JSON.stringify(draftRef.current) !== snapshot) {
        return;
      }
      await mutate(next, { revalidate: false });
      const normalized = toDraft(next);
      const pendingSocials = current.socials.filter((item) => !item.url.trim());
      if (pendingSocials.length) {
        normalized.socials = [...normalized.socials, ...pendingSocials];
      }
      savedDraft.current = JSON.stringify(normalized);
      setDraft(normalized);
      if (!silent) {
        toast.show('Changes saved', 'success');
      }
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Something went wrong', 'warning');
    } finally {
      if (token === saveToken.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  };
  saveRef.current = save;

  const toggleSection = (id: string) => setSection((current) => (current === id ? null : id));
  const themeLabel = LINK_THEMES.find((theme) => theme.id === draft.theme)?.label || draft.theme;
  const buttonLabel = LINK_BUTTONS.find((item) => item.id === radiusPreset(design.radius, draft.buttonStyle))?.label || 'Pill';
  const buttonSummary = `${labelOf(design.buttonFill)} · ${buttonLabel} · ${labelOf(design.shadow)}`;
  const shownIcons =
    data.accounts.filter((account) => !draft.hidden.includes(account.id)).length + draft.socials.filter((item) => item.url.trim()).length;
  const socialSummary = `${shownIcons} icons · ${design.socialPosition === 'bottom' ? 'Bottom' : 'Top'}`;

  const previewPage = toPublic({
    ...data,
    ...draft,
    design: { ...design, hiddenSocials: draft.hidden },
    accounts: data.accounts.map((item) => ({ ...item, shown: !draft.hidden.includes(item.id) })),
    blocks: data.blocks,
    capture: data.capture,
  });

  return (
    <LinkSplit
      previewOpen={preview}
      onPreviewClose={() => setPreview(false)}
      preview={
        <LinkPreview
          href={data.publicUrl}
          label={`${data.publicOrigin.replace(/^https?:\/\//, '')}/${data.slug}`}
          onCopy={async () => {
            try {
              await copyLink(data.publicUrl);
              toast.show('Link copied', 'success');
            } catch (err) {
              toast.show(err instanceof Error ? err.message : 'Could not copy that link', 'warning');
            }
          }}
          onClose={preview ? () => setPreview(false) : undefined}
        >
          <LinkPublicView key={`${previewPage.slug}-${previewPage.theme}-${design.header}`} data={previewPage} mode="preview" />
        </LinkPreview>
      }
    >
      <div className="lib-appearance flex min-w-0 flex-col gap-[16px] pb-[24px]">
        <div className="lib-head flex flex-col gap-[12px] sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="lib-kicker">
              <span className="lib-sticker">Link-in-Bio</span>
              <span className={`${stkSub} lib-period truncate`}>
                {data.publicOrigin.replace(/^https?:\/\//, '')}/{data.slug}
              </span>
            </div>
            <h1 className={stkTitle}>Appearance</h1>
          </div>
          <div className="lib-head-actions flex flex-wrap items-center justify-start gap-[8px] sm:justify-end">
            <LinkViewTabs preview={preview} onPreview={setPreview} />
            <button type="button" className={`${linkSecondary} lib-reset`} onClick={() => setDraft(toDraft(data))}>
              Reset
            </button>
            <button type="button" className={linkPrimary} disabled={busy} onClick={() => void save()}>
              Save changes
            </button>
          </div>
        </div>

        <div className="lib-acc">
        <AccItem title="Profile" summary="Avatar, name, bio, logo" open={section === 'profile'} onToggle={() => toggleSection('profile')}>
          <p className="mb-[12px] text-[13px] text-textItemBlur">Photo, title and bio. Title is 30 characters, bio is 160.</p>
          <div className="mb-[14px] flex flex-wrap items-center gap-[12px]">
            <div className="lib-avatar">
              {draft.avatarPath ? (
                <img src={draft.avatarPath} alt="" className="h-full w-full object-cover" />
              ) : (
                linkInitials(draft.name || data.slug)
              )}
            </div>
            <label className={`${linkSecondary} cursor-pointer`}>
              <HugeIcon name="upload" size={16} />
              Upload photo
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (!file) return;
                  try {
                    setDraft({ ...draft, avatarPath: await upload(file) });
                  } catch (err) {
                    toast.show(err instanceof Error ? err.message : 'Could not upload that image', 'warning');
                  }
                }}
              />
            </label>
            <span className="relative">
              <button type="button" className="lib-quiet" onClick={() => setRemoveAvatar((value) => !value)}>
                Remove
              </button>
              {removeAvatar ? (
                <div className="lib-confirm" role="dialog" aria-label="Remove photo">
                  <button type="button" onClick={() => setRemoveAvatar(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="is-remove"
                    onClick={() => {
                      setDraft({ ...draft, avatarPath: '' });
                      setRemoveAvatar(false);
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : null}
            </span>
          </div>
          <div className="mb-[12px]">
            <SegmentedControl
              aria-label="Title display"
              variant="pill"
              size="sm"
              className="lib-quiet-seg"
              value={design.titleMode}
              onValueChange={(titleMode) => setDesign({ titleMode: titleMode === 'logo' ? 'logo' : 'text' })}
              options={[
                { value: 'text', label: 'Text' },
                { value: 'logo', label: 'Logo' },
              ]}
            />
          </div>
          {design.titleMode === 'logo' ? (
            <div className="mb-[12px]">
              <LinkField label="Logo">
                <input
                  value={design.logoUrl}
                  placeholder="https:// or upload"
                  onChange={(event) => {
                    setLogoError('');
                    setDesign({ logoUrl: event.target.value });
                  }}
                />
              </LinkField>
              {logoError ? <p className="lib-field-error mt-[6px]">{logoError}</p> : null}
              <div className="mt-[8px] flex flex-wrap items-center gap-[8px]">
                <label className={linkSecondary}>
                  Upload logo
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (!file) return;
                      try {
                        setLogoError('');
                        setDesign({ logoUrl: await upload(file) });
                      } catch (err) {
                        const message = err instanceof Error ? err.message : 'Could not upload that image';
                        setLogoError(message);
                        toast.show(message, 'warning');
                      }
                    }}
                  />
                </label>
              </div>
              <p className="mt-[6px] text-[13px] text-textItemBlur">Shown in full, not cropped to a circle. The photo above is the avatar when title text is on.</p>
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-[12px] md:grid-cols-2">
            <LinkField label="Name">
              <input value={draft.name} maxLength={30} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              <span className="text-[12px] font-[400] text-textItemBlur">{draft.name.length}/30</span>
            </LinkField>
            <LinkField label="Bio">
              <input value={draft.bio} maxLength={160} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} />
              <span className="text-[12px] font-[400] text-textItemBlur">{draft.bio.length}/160</span>
            </LinkField>
          </div>
        </AccItem>
        <AccItem title="Theme" summary={themeLabel} open={section === 'theme'} onToggle={() => toggleSection('theme')}>
          <div className="lib-tiles">
            {LINK_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                className={`lib-tile${draft.theme === theme.id ? ' is-on' : ''}`}
                onClick={() => {
                  if (!guard(theme.pro, 'That theme is on a paid plan')) return;
                  setDraft({
                    ...draft,
                    theme: theme.id,
                    backgroundColor: '',
                    design: { ...design, colors: { ...emptyColors } },
                  });
                }}
              >
                {theme.pro ? <Star /> : null}
                <span className="lib-swatch" data-theme={theme.id} aria-hidden>
                  <b />
                  <i />
                  <i />
                </span>
                <span className="lib-tile-name">{theme.label}</span>
              </button>
            ))}
          </div>
        </AccItem>
        <AccItem title="Header" summary={labelOf(design.header)} open={section === 'header'} onToggle={() => toggleSection('header')}>
          <div className="lib-tiles">
            {LINK_HEADERS.map((header) => (
              <button
                key={header}
                type="button"
                className={`lib-tile${design.header === header ? ' is-on' : ''}`}
                onClick={() => {
                  if (!guard(header !== 'classic', 'That layout is on a paid plan')) return;
                  setDesign({ header });
                }}
              >
                {header !== 'classic' ? <Star /> : null}
                <span className="lib-opt-art" data-opt="header" data-value={header} />
                <span className="lib-tile-name">{labelOf(header)}</span>
              </button>
            ))}
          </div>
        </AccItem>
        <AccItem title="Background" summary={labelOf(design.wallpaper)} open={section === 'background'} onToggle={() => toggleSection('background')}>
            <p className="lib-section-label">Wallpaper</p>
            <div className="lib-tiles mb-[14px]">
              {LINK_WALLPAPERS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`lib-tile${design.wallpaper === item ? ' is-on' : ''}`}
                  onClick={() => {
                    const pro = item === 'blur' || item === 'pattern';
                    if (!guard(pro, 'That wallpaper is on a paid plan')) return;
                    setDesign({ wallpaper: item });
                  }}
                >
                  {item === 'blur' || item === 'pattern' ? <Star /> : null}
                  <span className="lib-opt-art" data-opt="wallpaper" data-value={item} />
                  <span className="lib-tile-name">{labelOf(item)}</span>
                </button>
              ))}
            </div>
            {design.wallpaper === 'pattern' ? (
              <>
                <p className="lib-section-label">Pattern</p>
                <div className="lib-tiles mb-[14px]">
                  {LINK_PATTERNS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={`lib-tile${design.pattern === item ? ' is-on' : ''}`}
                      onClick={() => setDesign({ pattern: item })}
                    >
                      <span className="lib-opt-art" data-opt="pattern" data-value={item} />
                      <span className="lib-tile-name">{labelOf(item)}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            {design.wallpaper === 'gradient' ? (
              <div className="mb-[14px] flex flex-col gap-[8px]">
                <ColorField label="From" value={design.gradientFrom || '#12343a'} onChange={(gradientFrom) => setDesign({ gradientFrom })} />
                <ColorField label="To" value={design.gradientTo || '#071418'} onChange={(gradientTo) => setDesign({ gradientTo })} />
              </div>
            ) : null}
            <p className="lib-section-label">Colour</p>
            <div className="lib-round-row">
              {colours.map((colour) => (
                <button
                  key={colour}
                  type="button"
                  aria-label={colour}
                  className={`lib-round${(design.colors.background || '').toLowerCase() === colour.toLowerCase() ? ' is-on' : ''}`}
                  style={{ background: colour }}
                  onClick={() => setDesign({ colors: { ...design.colors, background: colour } })}
                />
              ))}
              <button type="button" className={`${linkSecondary} lib-custom-pill`} onClick={() => setCustomColour((open) => !open)}>
                + Custom
              </button>
            </div>
            {customColour ? (
              <div className="mt-[10px]">
                <ColorField
                  label="Custom"
                  value={design.colors.background || themePalette(draft.theme).background}
                  onChange={(background) => setDesign({ colors: { ...design.colors, background } })}
                />
              </div>
            ) : null}
            {!design.wallpaperChosen && draft.backgroundMode === 'image' && draft.backgroundImage ? (
              <p className="mt-[10px] text-[13px] text-textItemBlur">The current background image stays until you pick a wallpaper.</p>
            ) : null}
        </AccItem>
        <AccItem title="Buttons" summary={buttonSummary} open={section === 'buttons'} onToggle={() => toggleSection('buttons')}>
            <p className="lib-section-label">Style</p>
            <div className="lib-tiles mb-[14px]">
              {LINK_BUTTON_FILLS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`lib-tile${design.buttonFill === item ? ' is-on' : ''}`}
                  onClick={() => {
                    if (!guard(item === 'glass', 'Glass buttons are on a paid plan')) return;
                    setDesign({ buttonFill: item });
                  }}
                >
                  {item === 'glass' ? <Star /> : null}
                  <span className="lib-opt-art" data-opt="fill" data-value={item} />
                  <span className="lib-tile-name">{labelOf(item)}</span>
                </button>
              ))}
            </div>
            <p className="lib-section-label">Shape</p>
            <SegmentedControl
              aria-label="Shape"
              variant="pill"
              size="sm"
              className="lib-quiet-seg mb-[14px]"
              value={radiusPreset(design.radius, draft.buttonStyle)}
              onValueChange={(id) => {
                const radius = id === 'pill' ? 32 : id === 'rounded' ? 16 : 8;
                setDraft({ ...draft, buttonStyle: id, design: { ...design, radius } });
              }}
              options={LINK_BUTTONS.map((item) => ({ value: item.id, label: item.label }))}
            />
            <div className="lib-slider-head">
              <span>Corner radius</span>
              <span>{Math.max(0, design.radius)} px</span>
            </div>
            <input
              type="range"
              min={0}
              max={32}
              aria-label="Corner radius"
              value={Math.max(0, design.radius)}
              onChange={(event) => {
                const radius = Number(event.target.value);
                const buttonStyle = radius >= 24 ? 'pill' : radius >= 12 ? 'rounded' : 'square';
                setDraft({ ...draft, buttonStyle, design: { ...design, radius } });
              }}
            />
            <p className="lib-section-label mt-[14px]">Shadow</p>
            <SegmentedControl
              aria-label="Shadow"
              variant="pill"
              size="sm"
              className="lib-quiet-seg"
              value={design.shadow}
              onValueChange={(shadow) => {
                if (shadow === 'none' || shadow === 'soft' || shadow === 'strong' || shadow === 'hard') {
                  setDesign({ shadow });
                }
              }}
              options={LINK_SHADOWS.map((item) => ({ value: item, label: labelOf(item) }))}
            />
        </AccItem>
        <AccItem title="Text & colours" summary={draft.font} open={section === 'text'} onToggle={() => toggleSection('text')}>
          <div className="grid grid-cols-1 gap-[12px] md:grid-cols-2">
            <LinkField label="Page font">
              <select value={draft.font} onChange={(event) => setDraft({ ...draft, font: event.target.value })}>
                {LINK_FONTS.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            </LinkField>
            <LinkField label="Title font">
              <select value={design.titleFont} onChange={(event) => setDesign({ titleFont: event.target.value as LinkDesign['titleFont'] })}>
                {LINK_FONTS.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            </LinkField>
          </div>
          <div className="mt-[14px] flex flex-col gap-[8px]">
            <ColorField label="Background" value={design.colors.background || themePalette(draft.theme).background} onChange={(background) => setDesign({ colors: { ...design.colors, background } })} />
            <ColorField label="Buttons" value={design.colors.button || themePalette(draft.theme).button} onChange={(button) => setDesign({ colors: { ...design.colors, button } })} />
            <ColorField label="Button text" value={design.colors.buttonText || themePalette(draft.theme).buttonText} onChange={(buttonText) => setDesign({ colors: { ...design.colors, buttonText } })} />
            <ColorField label="Page text" value={design.colors.pageText || themePalette(draft.theme).pageText} onChange={(pageText) => setDesign({ colors: { ...design.colors, pageText } })} />
            <ColorField label="Title" value={design.colors.title || themePalette(draft.theme).title} onChange={(title) => setDesign({ colors: { ...design.colors, title } })} />
          </div>
          <button
            type="button"
            className="lib-reset-colours"
            onClick={() => setDraft({ ...draft, backgroundColor: '', design: { ...design, colors: { ...emptyColors } } })}
          >
            Reset to theme colours
          </button>
        </AccItem>
        <AccItem title="Socials" summary={socialSummary} open={section === 'socials'} onToggle={() => toggleSection('socials')}>
          <div className="lib-social-position mb-[12px]">
            <span>Position</span>
            <SegmentedControl
              aria-label="Social position"
              variant="pill"
              size="sm"
              className="lib-quiet-seg"
              value={design.socialPosition}
              onValueChange={(socialPosition) => setDesign({ socialPosition: socialPosition === 'bottom' ? 'bottom' : 'top' })}
              options={[
                { value: 'top', label: 'Top' },
                { value: 'bottom', label: 'Bottom' },
              ]}
            />
          </div>
          <div className="lib-social-tiles mb-[8px]">
            {draft.socials.map((item, index) => (
              <button
                key={`${item.network}-${index}`}
                type="button"
                className={`lib-tile${editSocial === index ? ' is-on' : ''}`}
                onClick={() => setEditSocial(editSocial === index ? null : index)}
              >
                <span className="lib-social-mark" aria-hidden>
                  <SocialMark network={item.network} />
                </span>
                <span className="lib-tile-name">{LINK_SOCIALS.find((network) => network.id === item.network)?.label || item.network}</span>
              </button>
            ))}
            {draft.socials.length < 8 ? (
              <button
                type="button"
                className="lib-tile lib-tile-add"
                onClick={() => {
                  const next = [...draft.socials, { network: 'website', url: '' }];
                  setDraft({ ...draft, socials: next });
                  setEditSocial(next.length - 1);
                }}
              >
                <HugeIcon name="plus" size={16} />
                <span className="lib-tile-name">Add</span>
              </button>
            ) : null}
          </div>
          {editSocial !== null && draft.socials[editSocial] ? (
            <div className="lib-social-edit mb-[12px]">
              <select
                aria-label="Network"
                className="lib-input h-[44px] min-h-[44px] min-w-0 rounded-[18px] border border-newBorder bg-newBgColorInner px-[14px] text-[14px] font-[500]"
                value={draft.socials[editSocial].network}
                onChange={(event) => {
                  const socials = draft.socials.slice();
                  socials[editSocial] = { ...socials[editSocial], network: event.target.value };
                  setDraft({ ...draft, socials });
                }}
              >
                {LINK_SOCIALS.map((network) => (
                  <option key={network.id} value={network.id}>
                    {network.label}
                  </option>
                ))}
              </select>
              <input
                aria-label="Profile URL"
                className="lib-input h-[44px] min-h-[44px] min-w-0 rounded-[18px] border border-newBorder bg-newBgColorInner px-[14px] text-[14px] font-[500]"
                value={draft.socials[editSocial].url}
                placeholder="https://"
                onChange={(event) => {
                  const socials = draft.socials.slice();
                  socials[editSocial] = { ...socials[editSocial], url: event.target.value };
                  setSocialErrors(socialErrors.map((problem, itemIndex) => (itemIndex === editSocial ? null : problem)));
                  setDraft({ ...draft, socials });
                }}
              />
              <span className="lib-social-remove">
                <span className="lib-social-mark" aria-hidden>
                  <SocialMark network={draft.socials[editSocial].network} />
                </span>
                <button type="button" className={linkSecondary} onClick={() => setRemoveSocial(removeSocial === editSocial ? null : editSocial)}>
                  Remove {LINK_SOCIALS.find((network) => network.id === draft.socials[editSocial].network)?.label || draft.socials[editSocial].network}
                </button>
              </span>
              {socialErrors[editSocial] ? <p className="lib-field-error">{socialErrors[editSocial]}</p> : null}
            </div>
          ) : null}
          <p className="mb-[12px] text-[13px] text-textItemBlur">Connected accounts show automatically. Tap an icon to edit or hide it.</p>
          <p className="lib-section-label">Connected accounts (from Schedule)</p>
          <div className="lib-account-card">
            {data.accounts.map((account) => (
              <div key={account.id} className="lib-account-line">
                <span className="lib-social-mark" aria-hidden>
                  <SocialMark network={account.network} />
                </span>
                <span className="min-w-0">
                  <strong>{account.name}</strong>
                  <small>{account.network}</small>
                </span>
                <LinkToggle
                  checked={!draft.hidden.includes(account.id)}
                  label={`Show ${account.name}`}
                  onChange={(shown) =>
                    setDraft({
                      ...draft,
                      hidden: shown ? draft.hidden.filter((id) => id !== account.id) : [...draft.hidden, account.id],
                    })
                  }
                />
              </div>
            ))}
            {!data.accounts.length ? <p className="text-[14px] text-textItemBlur">No connected accounts yet.</p> : null}
            <button type="button" className={`${linkSecondary} mt-[8px]`} onClick={() => connect()}>
              <HugeIcon name="plus" size={16} />
              Connect account
            </button>
          </div>
        </AccItem>
        </div>
        <button type="button" className={`${linkSecondary} lib-reset-phone`} onClick={() => setDraft(toDraft(data))}>
          Reset
        </button>
        {removeSocial !== null && draft.socials[removeSocial] ? (
          <LinkModal
            title={`Remove ${LINK_SOCIALS.find((network) => network.id === draft.socials[removeSocial].network)?.label || draft.socials[removeSocial].network} icon?`}
            onClose={() => setRemoveSocial(null)}
          >
            <p className="text-[14px] text-textItemBlur">This takes the icon off your page. You can add it again later.</p>
            <div className="lib-confirm-actions">
              <button type="button" className={linkSecondary} onClick={() => setRemoveSocial(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={linkDanger}
                onClick={() => {
                  setDraft({ ...draft, socials: draft.socials.filter((_, itemIndex) => itemIndex !== removeSocial) });
                  setSocialErrors(socialErrors.filter((_, itemIndex) => itemIndex !== removeSocial));
                  setRemoveSocial(null);
                  setEditSocial(null);
                }}
              >
                Remove
              </button>
            </div>
          </LinkModal>
        ) : null}
      </div>
    </LinkSplit>
  );
};

const ColorField = ({
  label,
  value,
  onChange,
  swatches = [],
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  swatches?: string[];
}) => (
  <label className="lib-color">
    <span>{label}</span>
    <span className="lib-color-pill">
      <span className="lib-color-chip">
        <input
          type="color"
          aria-label={label}
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#0a0a0a'}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
      <span className="lib-color-value">{value}</span>
      {swatches.map((colour) => (
        <button
          key={colour}
          type="button"
          aria-label={colour}
          className="lib-color-swatch"
          style={{ background: colour }}
          onClick={() => onChange(colour)}
        />
      ))}
    </span>
  </label>
);
