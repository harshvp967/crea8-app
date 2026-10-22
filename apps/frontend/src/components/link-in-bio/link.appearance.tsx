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
  imagePathProblem,
  normalizeDesign,
  themePalette,
  urlProblem,
} from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.rules';
import { LinkEditor, linkLocked, linkSend, toPublic, useLinkPage } from '@gitroom/frontend/components/link-in-bio/link.api';
import { HugeIcon } from '@gitroom/frontend/components/icons/hugeicons';
import { LinkField, LinkSegments, linkChoice, linkPrimary, linkSecondary } from '@gitroom/frontend/components/link-in-bio/link.chrome';
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

const Pro = () => <span className="lib-pill lib-pill-pro">★ Pro</span>;

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
  const connect = useAddProvider(() => {
    mutate();
  });

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

  const save = async () => {
    const logoProblem = design.logoUrl.trim() ? imagePathProblem(design.logoUrl) : null;
    const nextSocialErrors = draft.socials.map((item) => (item.url.trim() ? urlProblem(item.url) : null));
    setLogoError(logoProblem || '');
    setSocialErrors(nextSocialErrors);
    if (logoProblem || nextSocialErrors.some(Boolean)) {
      toast.show(logoProblem || nextSocialErrors.find(Boolean) || 'Check that link', 'warning');
      return;
    }
    setBusy(true);
    try {
      const next = await linkSend(fetch, '/link-in-bio', 'PUT', {
        name: draft.name,
        bio: draft.bio,
        avatarPath: draft.avatarPath,
        theme: draft.theme,
        buttonStyle: radiusPreset(design.radius, draft.buttonStyle),
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
              <span className={`${stkSub} lib-period`}>The phone preview updates as you edit.</span>
            </div>
            <h1 className={stkTitle}>Appearance</h1>
          </div>
          <div className="lib-head-actions flex flex-wrap items-center justify-start gap-[8px] sm:justify-end">
            <LinkViewTabs preview={preview} onPreview={setPreview} />
            <button type="button" className={`${linkSecondary} lib-reset`} onClick={() => setDraft(toDraft(data))}>
              Reset
            </button>
            <button type="button" className={linkPrimary} disabled={busy} onClick={save}>
              Save changes
            </button>
          </div>
        </div>

        <section className={stkCard}>
          <h2 className="text-[16px] font-[600]">Profile</h2>
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
            <LinkSegments
              label="Title display"
              value={design.titleMode}
              options={LINK_TITLE_MODES.map((mode) => ({ id: mode, label: mode === 'text' ? 'Title text' : 'Logo' }))}
              onChange={(titleMode) => setDesign({ titleMode })}
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

        <section className={stkCard}>
          <h2 className="text-[16px] font-[600]">Header</h2>
          <p className="lib-help mb-[12px] text-[13px] text-textItemBlur">Classic is included. Other layouts are Pro.</p>
          <div className="flex flex-wrap gap-[8px]">
            {LINK_HEADERS.map((header) => (
              <button
                key={header}
                type="button"
                className={design.header === header ? linkChoice : linkSecondary}
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

        <section className={stkCard}>
          <h2 className="text-[16px] font-[600]">Themes</h2>
          <p className="lib-help mb-[12px] text-[13px] text-textItemBlur">Pro themes show a badge.</p>
          <div className="lib-themes">
            {LINK_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                className="lib-theme"
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
                <span className={`lib-swatch${draft.theme === theme.id ? ' is-active' : ''}`} data-theme={theme.id}>
                  <i />
                  <i />
                </span>
                <span className="lib-theme-label">
                  <span className="lib-theme-name">{theme.label}</span>
                  {draft.theme === theme.id || theme.pro ? (
                    <span className="lib-theme-badges">
                      {draft.theme === theme.id ? <span className="lib-pill lib-pill-active">Active</span> : null}
                      {theme.pro ? <Pro /> : null}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        </section>

        <div className="grid min-w-0 grid-cols-1 gap-[16px] xl:grid-cols-2">
          <section className={stkCard}>
            <h2 className="mb-[12px] text-[16px] font-[600]">Wallpaper</h2>
            <div className="mb-[12px] flex flex-wrap gap-[8px]">
              {LINK_WALLPAPERS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={design.wallpaper === item ? linkChoice : linkSecondary}
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
                  <button key={item} type="button" className={design.pattern === item ? linkChoice : linkSecondary} onClick={() => setDesign({ pattern: item })}>
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

          <section className={stkCard}>
            <h2 className="mb-[12px] text-[16px] font-[600]">Buttons</h2>
            <div className="mb-[12px] flex flex-wrap gap-[8px]">
              {LINK_BUTTON_FILLS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={design.buttonFill === item ? linkChoice : linkSecondary}
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
                  className={radiusPreset(design.radius, draft.buttonStyle) === item.id ? linkChoice : linkSecondary}
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
                onChange={(event) => {
                  const radius = Number(event.target.value);
                  const buttonStyle = radius >= 24 ? 'pill' : radius >= 12 ? 'rounded' : 'square';
                  setDraft({ ...draft, buttonStyle, design: { ...design, radius } });
                }}
              />
            </LinkField>
            <div className="mt-[12px] flex flex-wrap gap-[8px]">
              {LINK_SHADOWS.map((item) => (
                <button key={item} type="button" className={design.shadow === item ? linkChoice : linkSecondary} onClick={() => setDesign({ shadow: item })}>
                  {item[0].toUpperCase() + item.slice(1)}
                </button>
              ))}
            </div>
          </section>
        </div>

        <section className={stkCard}>
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
            <ColorField label="Background" value={design.colors.background || themePalette(draft.theme).background} onChange={(background) => setDesign({ colors: { ...design.colors, background } })} swatches={colours} />
            <ColorField label="Buttons" value={design.colors.button || themePalette(draft.theme).button} onChange={(button) => setDesign({ colors: { ...design.colors, button } })} />
            <ColorField label="Button text" value={design.colors.buttonText || themePalette(draft.theme).buttonText} onChange={(buttonText) => setDesign({ colors: { ...design.colors, buttonText } })} />
            <ColorField label="Page text" value={design.colors.pageText || themePalette(draft.theme).pageText} onChange={(pageText) => setDesign({ colors: { ...design.colors, pageText } })} />
            <ColorField label="Title" value={design.colors.title || themePalette(draft.theme).title} onChange={(title) => setDesign({ colors: { ...design.colors, title } })} />
          </div>
        </section>

        <section className={stkCard}>
          <div className="mb-[12px] flex flex-wrap items-start justify-between gap-[8px]">
            <div>
              <h2 className="text-[16px] font-[600]">Social icons</h2>
              <p className="text-[13px] text-textItemBlur">Accounts connected in Schedule show up here. Stalker uses the same accounts.</p>
            </div>
            <LinkSegments
              label="Social position"
              value={design.socialPosition}
              options={[
                { id: 'top', label: 'Top' },
                { id: 'bottom', label: 'Bottom' },
              ]}
              onChange={(socialPosition) => setDesign({ socialPosition })}
            />
          </div>
          <div className="mb-[12px] flex flex-col gap-[8px]">
            {data.accounts.map((account) => (
              <label key={account.id} className="lib-account-row">
                <span className="flex min-w-0 items-center gap-[10px]">
                  <span className="lib-socials" aria-hidden>
                    <span title={account.network}>
                      <SocialMark network={account.network} />
                    </span>
                  </span>
                  <span className="min-w-0">
                    <strong className="block truncate text-[14px]">{account.name}</strong>
                    <span className="lib-account-url block truncate">{account.url}</span>
                  </span>
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
              <HugeIcon name="plus" size={16} />
              Connect account
            </button>
          </div>
          <div className="flex flex-col gap-[8px]">
            {draft.socials.map((item, index) => (
              <div key={`${item.network}-${index}`} className="grid min-w-0 grid-cols-1 gap-[8px] sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)_auto]">
                <span className="flex min-w-0 items-center gap-[8px]">
                  <span className="lib-socials" aria-hidden>
                    <span title={item.network}>
                      <SocialMark network={item.network} />
                    </span>
                  </span>
                <select
                  className="lib-input h-[44px] min-h-[44px] min-w-0 flex-1 rounded-[18px] border border-newBorder bg-newBgColorInner px-[14px] text-[14px] font-[500]"
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
                </span>
                <input
                  className="lib-input h-[44px] min-h-[44px] min-w-0 rounded-[18px] border border-newBorder bg-newBgColorInner px-[14px] text-[14px] font-[500]"
                  value={item.url}
                  placeholder="https://"
                  onChange={(event) => {
                    const socials = draft.socials.slice();
                    socials[index] = { ...item, url: event.target.value };
                    setSocialErrors(socialErrors.map((problem, itemIndex) => (itemIndex === index ? null : problem)));
                    setDraft({ ...draft, socials });
                  }}
                />
                <span className="relative">
                  <button type="button" className={linkSecondary} onClick={() => setRemoveSocial(removeSocial === index ? null : index)}>
                    Remove
                  </button>
                  {removeSocial === index ? (
                    <div className="lib-confirm" role="dialog" aria-label="Remove social link">
                      <button type="button" onClick={() => setRemoveSocial(null)}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="is-remove"
                        onClick={() => {
                          setDraft({ ...draft, socials: draft.socials.filter((_, itemIndex) => itemIndex !== index) });
                          setSocialErrors(socialErrors.filter((_, itemIndex) => itemIndex !== index));
                          setRemoveSocial(null);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                </span>
                {socialErrors[index] ? <p className="lib-field-error sm:col-span-3">{socialErrors[index]}</p> : null}
              </div>
            ))}
            {draft.socials.length < 8 ? (
              <button type="button" className={linkSecondary} onClick={() => setDraft({ ...draft, socials: [...draft.socials, { network: 'website', url: '' }] })}>
                <HugeIcon name="plus" size={16} />
                Add a link
              </button>
            ) : null}
          </div>
        </section>
        <button type="button" className={`${linkSecondary} lib-reset-phone`} onClick={() => setDraft(toDraft(data))}>
          Reset
        </button>
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
    <span className="lib-color-row">
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
