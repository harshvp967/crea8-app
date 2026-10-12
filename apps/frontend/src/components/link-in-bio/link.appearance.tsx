'use client';

import { useState } from 'react';
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
  LINK_TITLE_MODES,
  LINK_WALLPAPERS,
  LinkDesign,
  normalizeDesign,
} from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.rules';
import { LinkEditor, linkLocked, linkSend, toPublic, useLinkPage } from '@gitroom/frontend/components/link-in-bio/link.api';
import { LinkField, linkPrimary, linkSecondary } from '@gitroom/frontend/components/link-in-bio/link.chrome';
import { LinkPreview, LinkSplit } from '@gitroom/frontend/components/link-in-bio/link.shell';
import { LinkPublicView } from '@gitroom/frontend/components/link-in-bio/link.public-view';
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
    backgroundColor: page.backgroundColor || '#0a0a0a',
    backgroundImage: page.backgroundImage,
    socials: page.socials.map((item) => ({ ...item })),
    design,
    hidden: design.hiddenSocials,
  };
};

const Pro = () => <span className="lib-pill lib-pill-cyan">Pro</span>;

export const LinkAppearanceScreen = () => {
  const fetch = useFetch();
  const toast = useToaster();
  const { data, error, isLoading, mutate } = useLinkPage();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const connect = useAddProvider(() => {
    mutate();
  });

  if (data && !draft) {
    setDraft(toDraft(data));
  }

  if (isLoading || !data || !draft) {
    return (
      <div className="p-[8px] text-[14px] text-textItemBlur">
        {error ? 'Could not load your page.' : 'Loading your page…'}
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

  const save = async () => {
    setBusy(true);
    try {
      const next = await linkSend(fetch, '/link-in-bio', 'PUT', {
        name: draft.name,
        bio: draft.bio,
        avatarPath: draft.avatarPath,
        theme: draft.theme,
        buttonStyle: draft.buttonStyle,
        font: draft.font,
        backgroundMode: design.wallpaperChosen ? 'colour' : draft.backgroundMode,
        backgroundColor: design.colors.background || draft.backgroundColor,
        socials: draft.socials.filter((item) => item.url.trim()),
        design: { ...design, hiddenSocials: draft.hidden, wallpaperChosen: design.wallpaperChosen },
      });
      await mutate(next, { revalidate: false });
      setDraft(toDraft(next));
      toast.show('Changes saved', 'success');
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Something went wrong', 'warning');
    } finally {
      setBusy(false);
    }
  };

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
          onCopy={() => {
            navigator.clipboard?.writeText(data.publicUrl);
            toast.show('Link copied', 'success');
          }}
        >
          <LinkPublicView key={`${previewPage.slug}-${previewPage.theme}-${design.header}`} data={previewPage} mode="preview" />
        </LinkPreview>
      }
    >
      <div className="flex min-w-0 flex-col gap-[16px] pb-[24px]">
        <div className="flex flex-col gap-[12px] sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-[22px] font-[600]">Appearance</h1>
            <p className="text-[14px] text-textItemBlur">Themes, wallpaper and the phone preview update as you edit</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-[8px] sm:justify-end">
            <button type="button" className={`${linkSecondary} min-[1200px]:hidden`} onClick={() => setPreview((value) => !value)}>
              {preview ? 'Close preview' : 'Preview'}
            </button>
            <button type="button" className={linkSecondary} onClick={() => setDraft(toDraft(data))}>
              Reset
            </button>
            <button type="button" className={linkPrimary} disabled={busy} onClick={save}>
              Save changes
            </button>
          </div>
        </div>

        <section className="rounded-[20px] border border-newBorder p-[16px]">
          <h2 className="text-[16px] font-[600]">Profile</h2>
          <p className="mb-[12px] text-[13px] text-textItemBlur">Photo, title and bio. Title is 30 characters, bio is 160.</p>
          <div className="mb-[14px] flex flex-wrap items-center gap-[12px]">
            <div className="grid h-[52px] w-[52px] place-items-center overflow-hidden rounded-full border border-newBorder text-[18px] font-[600]">
              {draft.avatarPath ? (
                <img src={draft.avatarPath} alt="" className="h-full w-full object-cover" />
              ) : (
                (draft.name || data.slug).slice(0, 1).toUpperCase()
              )}
            </div>
            <label className={`${linkSecondary} cursor-pointer`}>
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
            {draft.avatarPath ? (
              <button type="button" className="text-[14px] text-textItemBlur" onClick={() => setDraft({ ...draft, avatarPath: '' })}>
                Remove
              </button>
            ) : null}
          </div>
          <div className="mb-[12px] flex flex-wrap gap-[8px]">
            {LINK_TITLE_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                className={design.titleMode === mode ? linkPrimary : linkSecondary}
                onClick={() => setDesign({ titleMode: mode })}
              >
                {mode === 'text' ? 'Title text' : 'Logo'}
              </button>
            ))}
          </div>
          {design.titleMode === 'logo' ? (
            <div className="mb-[12px]">
              <LinkField label="Logo URL">
                <input
                  value={design.logoUrl}
                  placeholder={draft.avatarPath || 'https://'}
                  onChange={(event) => setDesign({ logoUrl: event.target.value })}
                />
              </LinkField>
              <p className="mt-[6px] text-[13px] text-textItemBlur">Uses this URL, or the photo above when the URL is empty. No extra upload.</p>
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-[12px] md:grid-cols-2">
            <LinkField label="Title">
              <input value={draft.name} maxLength={30} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              <span className="text-[12px] font-[400] text-textItemBlur">{draft.name.length}/30</span>
            </LinkField>
            <LinkField label="Bio">
              <input value={draft.bio} maxLength={160} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} />
              <span className="text-[12px] font-[400] text-textItemBlur">{draft.bio.length}/160</span>
            </LinkField>
          </div>
        </section>

        <section className="rounded-[20px] border border-newBorder p-[16px]">
          <h2 className="text-[16px] font-[600]">Header</h2>
          <p className="mb-[12px] text-[13px] text-textItemBlur">Classic is included. The other layouts are Pro.</p>
          <div className="flex flex-wrap gap-[8px]">
            {LINK_HEADERS.map((header) => (
              <button
                key={header}
                type="button"
                className={design.header === header ? linkPrimary : linkSecondary}
                onClick={() => {
                  if (!guard(header !== 'classic', 'That layout is on a paid plan')) return;
                  setDesign({ header });
                }}
              >
                {header[0].toUpperCase() + header.slice(1)}
                {header !== 'classic' ? <Pro /> : null}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[20px] border border-newBorder p-[16px]">
          <h2 className="text-[16px] font-[600]">Themes</h2>
          <p className="mb-[12px] text-[13px] text-textItemBlur">
            {locked ? 'Pro themes need a paid plan' : 'Pro themes stay marked, and they are open while plan gating is off'}
          </p>
          <div className="flex flex-wrap gap-[12px]">
            {LINK_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                className="flex flex-col items-center gap-[6px]"
                onClick={() => {
                  if (!guard(theme.pro, 'That theme is on a paid plan')) return;
                  setDraft({ ...draft, theme: theme.id });
                }}
              >
                <span
                  className="lib-swatch"
                  data-theme={theme.id}
                  style={
                    draft.theme === theme.id
                      ? { borderColor: 'rgba(0,217,255,.8)', boxShadow: 'inset 0 0 0 1px rgba(0,217,255,.8)' }
                      : undefined
                  }
                >
                  <i />
                  <i />
                </span>
                <span className="flex items-center gap-[6px] text-[13px] text-textItemBlur">
                  {theme.label}
                  {theme.pro ? <Pro /> : null}
                </span>
              </button>
            ))}
          </div>
        </section>

        <div className="grid min-w-0 grid-cols-1 gap-[16px] xl:grid-cols-2">
          <section className="rounded-[20px] border border-newBorder p-[16px]">
            <h2 className="mb-[12px] text-[16px] font-[600]">Wallpaper</h2>
            <div className="mb-[12px] flex flex-wrap gap-[8px]">
              {LINK_WALLPAPERS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={design.wallpaper === item ? linkPrimary : linkSecondary}
                  onClick={() => {
                    const pro = item === 'blur' || item === 'pattern';
                    if (!guard(pro, 'That wallpaper is on a paid plan')) return;
                    setDesign({ wallpaper: item });
                  }}
                >
                  {item[0].toUpperCase() + item.slice(1)}
                  {item === 'blur' || item === 'pattern' ? <Pro /> : null}
                </button>
              ))}
            </div>
            {design.wallpaper === 'pattern' ? (
              <div className="mb-[12px] flex flex-wrap gap-[8px]">
                {LINK_PATTERNS.map((item) => (
                  <button key={item} type="button" className={design.pattern === item ? linkPrimary : linkSecondary} onClick={() => setDesign({ pattern: item })}>
                    {item}
                  </button>
                ))}
              </div>
            ) : null}
            {design.wallpaper === 'gradient' ? (
              <div className="flex flex-wrap gap-[12px]">
                <ColorField label="From" value={design.gradientFrom || '#12343a'} onChange={(gradientFrom) => setDesign({ gradientFrom })} />
                <ColorField label="To" value={design.gradientTo || '#071418'} onChange={(gradientTo) => setDesign({ gradientTo })} />
              </div>
            ) : null}
            {!design.wallpaperChosen && draft.backgroundMode === 'image' && draft.backgroundImage ? (
              <p className="text-[13px] text-textItemBlur">The current background image stays until you pick a wallpaper.</p>
            ) : null}
          </section>

          <section className="rounded-[20px] border border-newBorder p-[16px]">
            <h2 className="mb-[12px] text-[16px] font-[600]">Buttons</h2>
            <div className="mb-[12px] flex flex-wrap gap-[8px]">
              {LINK_BUTTON_FILLS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={design.buttonFill === item ? linkPrimary : linkSecondary}
                  onClick={() => {
                    if (!guard(item === 'glass', 'Glass buttons are on a paid plan')) return;
                    setDesign({ buttonFill: item });
                  }}
                >
                  {item[0].toUpperCase() + item.slice(1)}
                  {item === 'glass' ? <Pro /> : null}
                </button>
              ))}
            </div>
            <div className="mb-[12px] flex flex-wrap gap-[8px]">
              {LINK_BUTTONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={draft.buttonStyle === item.id && design.radius < 0 ? linkPrimary : linkSecondary}
                  onClick={() => {
                    const radius = item.id === 'pill' ? 32 : item.id === 'rounded' ? 16 : 8;
                    setDraft({ ...draft, buttonStyle: item.id, design: { ...design, radius } });
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <LinkField label={`Corner roundness ${Math.max(0, design.radius)}`}>
              <input
                type="range"
                min={0}
                max={32}
                value={Math.max(0, design.radius)}
                onChange={(event) => setDesign({ radius: Number(event.target.value) })}
              />
            </LinkField>
            <div className="mt-[12px] flex flex-wrap gap-[8px]">
              {LINK_SHADOWS.map((item) => (
                <button key={item} type="button" className={design.shadow === item ? linkPrimary : linkSecondary} onClick={() => setDesign({ shadow: item })}>
                  {item[0].toUpperCase() + item.slice(1)}
                </button>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-[20px] border border-newBorder p-[16px]">
          <h2 className="mb-[12px] text-[16px] font-[600]">Fonts and colours</h2>
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
          <div className="mt-[14px] flex flex-wrap gap-[12px]">
            <ColorField label="Background" value={design.colors.background || draft.backgroundColor || '#0a0a0a'} onChange={(background) => setDesign({ colors: { ...design.colors, background } })} swatches={colours} />
            <ColorField label="Buttons" value={design.colors.button || '#17191c'} onChange={(button) => setDesign({ colors: { ...design.colors, button } })} />
            <ColorField label="Button text" value={design.colors.buttonText || '#f4f4f5'} onChange={(buttonText) => setDesign({ colors: { ...design.colors, buttonText } })} />
            <ColorField label="Page text" value={design.colors.pageText || '#f5f5f5'} onChange={(pageText) => setDesign({ colors: { ...design.colors, pageText } })} />
            <ColorField label="Title" value={design.colors.title || '#f5f5f5'} onChange={(title) => setDesign({ colors: { ...design.colors, title } })} />
          </div>
        </section>

        <section className="rounded-[20px] border border-newBorder p-[16px]">
          <div className="mb-[12px] flex flex-wrap items-start justify-between gap-[8px]">
            <div>
              <h2 className="text-[16px] font-[600]">Social icons</h2>
              <p className="text-[13px] text-textItemBlur">Accounts connected in Schedule show up here. Stalker uses the same accounts.</p>
            </div>
            <div className="flex gap-[8px]">
              {(['top', 'bottom'] as const).map((position) => (
                <button
                  key={position}
                  type="button"
                  className={design.socialPosition === position ? linkPrimary : linkSecondary}
                  onClick={() => setDesign({ socialPosition: position })}
                >
                  {position === 'top' ? 'Top' : 'Bottom'}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-[12px] flex flex-col gap-[8px]">
            {data.accounts.map((account) => (
              <label key={account.id} className="flex items-center justify-between gap-[12px] rounded-[14px] border border-newBorder px-[12px] py-[10px]">
                <span className="min-w-0">
                  <strong className="block truncate text-[14px]">{account.name}</strong>
                  <span className="block truncate text-[13px] text-textItemBlur">{account.url}</span>
                </span>
                <input
                  type="checkbox"
                  checked={!draft.hidden.includes(account.id)}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      hidden: event.target.checked ? draft.hidden.filter((id) => id !== account.id) : [...draft.hidden, account.id],
                    })
                  }
                />
              </label>
            ))}
            {!data.accounts.length ? <p className="text-[14px] text-textItemBlur">No connected accounts yet.</p> : null}
            <button type="button" className={linkSecondary} onClick={() => connect()}>
              Connect account
            </button>
          </div>
          <div className="flex flex-col gap-[8px]">
            {draft.socials.map((item, index) => (
              <div key={`${item.network}-${index}`} className="grid min-w-0 grid-cols-1 gap-[8px] sm:grid-cols-[minmax(0,160px)_minmax(0,1fr)_auto]">
                <select
                  className="min-h-[44px] rounded-[14px] border border-newBorder bg-transparent px-[12px]"
                  value={item.network}
                  onChange={(event) => {
                    const socials = draft.socials.slice();
                    socials[index] = { ...item, network: event.target.value };
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
                  className="min-h-[44px] rounded-[14px] border border-newBorder bg-transparent px-[12px]"
                  value={item.url}
                  placeholder="https://"
                  onChange={(event) => {
                    const socials = draft.socials.slice();
                    socials[index] = { ...item, url: event.target.value };
                    setDraft({ ...draft, socials });
                  }}
                />
                <button
                  type="button"
                  className={linkSecondary}
                  onClick={() => setDraft({ ...draft, socials: draft.socials.filter((_, itemIndex) => itemIndex !== index) })}
                >
                  Remove
                </button>
              </div>
            ))}
            {draft.socials.length < 8 ? (
              <button type="button" className={linkSecondary} onClick={() => setDraft({ ...draft, socials: [...draft.socials, { network: 'website', url: '' }] })}>
                Add a link
              </button>
            ) : null}
          </div>
        </section>
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
  <label className="flex min-w-[140px] flex-col gap-[6px] text-[13px]">
    <span>{label}</span>
    <span className="flex items-center gap-[8px]">
      <input type="color" aria-label={label} value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#0a0a0a'} onChange={(event) => onChange(event.target.value)} />
      {swatches.map((colour) => (
        <button
          key={colour}
          type="button"
          aria-label={colour}
          className="h-[18px] w-[18px] rounded-full border border-newBorder"
          style={{ background: colour }}
          onClick={() => onChange(colour)}
        />
      ))}
    </span>
  </label>
);
