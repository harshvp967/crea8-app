'use client';

import { useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import {
  LINK_BUTTONS,
  LINK_FONTS,
  LINK_SOCIALS,
  LINK_THEMES,
} from '@gitroom/nestjs-libraries/database/prisma/link-in-bio/link.rules';
import {
  LinkEditor,
  linkSend,
  toPublic,
  useLinkPage,
} from '@gitroom/frontend/components/link-in-bio/link.api';
import { LinkField, linkPrimary, linkSecondary } from '@gitroom/frontend/components/link-in-bio/link.chrome';
import { LinkPreview, LinkSplit } from '@gitroom/frontend/components/link-in-bio/link.shell';
import { LinkPublicView } from '@gitroom/frontend/components/link-in-bio/link.public-view';

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
};

const colours = ['#0a0a0a', '#ffffff', '#00D9FF'];

const toDraft = (page: LinkEditor): Draft => ({
  name: page.name,
  bio: page.bio,
  avatarPath: page.avatarPath,
  theme: page.theme,
  buttonStyle: page.buttonStyle,
  font: page.font || 'Plus Jakarta Sans',
  backgroundMode: page.backgroundMode || 'colour',
  backgroundColor: page.backgroundColor || '#0a0a0a',
  backgroundImage: page.backgroundImage,
  socials: page.socials.map((item) => ({ ...item })),
});

export const LinkAppearanceScreen = () => {
  const fetch = useFetch();
  const toast = useToaster();
  const { data, error, isLoading, mutate } = useLinkPage();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);

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
        backgroundMode: draft.backgroundMode,
        backgroundColor: draft.backgroundColor,
        backgroundImage: draft.backgroundImage,
        socials: draft.socials.filter((item) => item.url.trim()),
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
          <LinkPublicView key={`${previewPage.slug}-${previewPage.isPublic}-${previewPage.sensitive}`} data={previewPage} mode="preview" />
        </LinkPreview>
      }
    >
      <div className="flex min-w-0 flex-col gap-[16px] pb-[24px]">
        <div className="flex flex-col gap-[12px] sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-[22px] font-[600]">Appearance</h1>
            <p className="text-[14px] text-textItemBlur">Override the theme</p>
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
          <p className="mb-[12px] text-[13px] text-textItemBlur">Photo, name and bio</p>
          <div className="mb-[14px] flex items-center gap-[12px]">
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
                  if (!file) {
                    return;
                  }
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
          <div className="grid grid-cols-1 gap-[12px] md:grid-cols-2">
            <LinkField label="Name">
              <input value={draft.name} maxLength={80} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            </LinkField>
            <LinkField label="Bio">
              <input value={draft.bio} maxLength={160} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} />
              <span className="text-[12px] font-[400] text-textItemBlur">
                {draft.bio.length}/160
              </span>
            </LinkField>
          </div>
        </section>

        <section className="rounded-[20px] border border-newBorder p-[16px]">
          <h2 className="text-[16px] font-[600]">Themes</h2>
          <p className="mb-[12px] text-[13px] text-textItemBlur">All free</p>
          <div className="flex flex-wrap gap-[12px]">
            {LINK_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                className="flex flex-col items-center gap-[6px]"
                onClick={() => setDraft({ ...draft, theme: theme.id })}
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
                <span className="text-[13px] text-textItemBlur">{theme.label}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="grid min-w-0 grid-cols-1 gap-[16px] md:grid-cols-2">
          <section className="rounded-[20px] border border-newBorder p-[16px]">
            <h2 className="mb-[12px] text-[16px] font-[600]">Buttons</h2>
            <div className="mb-[14px] flex flex-wrap gap-[8px]">
              {LINK_BUTTONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={draft.buttonStyle === item.id ? linkPrimary : linkSecondary}
                  onClick={() => setDraft({ ...draft, buttonStyle: item.id })}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <LinkField label="Font">
              <select value={draft.font} onChange={(event) => setDraft({ ...draft, font: event.target.value })}>
                {LINK_FONTS.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            </LinkField>
          </section>

          <section className="rounded-[20px] border border-newBorder p-[16px]">
            <h2 className="mb-[12px] text-[16px] font-[600]">Background</h2>
            <div className="mb-[12px] flex flex-wrap gap-[8px]">
              <button
                type="button"
                className={draft.backgroundMode === 'colour' ? linkPrimary : linkSecondary}
                onClick={() => setDraft({ ...draft, backgroundMode: 'colour' })}
              >
                Colour
              </button>
              <button
                type="button"
                className={draft.backgroundMode === 'image' ? linkPrimary : linkSecondary}
                onClick={() => setDraft({ ...draft, backgroundMode: 'image' })}
              >
                Image
              </button>
            </div>
            {draft.backgroundMode === 'image' ? (
              <label className={`${linkSecondary} cursor-pointer`}>
                {draft.backgroundImage ? 'Replace image' : 'Upload image'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (!file) {
                      return;
                    }
                    try {
                      setDraft({ ...draft, backgroundImage: await upload(file) });
                    } catch (err) {
                      toast.show(err instanceof Error ? err.message : 'Could not upload that image', 'warning');
                    }
                  }}
                />
              </label>
            ) : (
              <div className="flex min-w-0 flex-wrap items-center gap-[8px]">
                {colours.map((colour) => (
                  <button
                    key={colour}
                    type="button"
                    aria-label={colour}
                    className="h-[22px] w-[22px] rounded-full border border-newBorder"
                    style={{
                      background: colour,
                      outline: draft.backgroundColor.toLowerCase() === colour.toLowerCase() ? '2px solid #00D9FF' : undefined,
                      outlineOffset: 2,
                    }}
                    onClick={() => setDraft({ ...draft, backgroundColor: colour })}
                  />
                ))}
                <span className="text-[13px] text-textItemBlur">Custom colours</span>
                <input
                  type="color"
                  aria-label="Custom colour"
                  value={/^#[0-9a-fA-F]{6}$/.test(draft.backgroundColor) ? draft.backgroundColor : '#0a0a0a'}
                  onChange={(event) => setDraft({ ...draft, backgroundColor: event.target.value })}
                />
              </div>
            )}
            <p className="mt-[10px] text-[13px] text-textItemBlur">Or upload a background image · JPG or PNG</p>
          </section>
        </div>

        <section className="rounded-[20px] border border-newBorder p-[16px]">
          <h2 className="mb-[12px] text-[16px] font-[600]">Social icons</h2>
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
              <button
                type="button"
                className={linkSecondary}
                onClick={() => setDraft({ ...draft, socials: [...draft.socials, { network: 'instagram', url: '' }] })}
              >
                Add social
              </button>
            ) : null}
          </div>
        </section>
      </div>
    </LinkSplit>
  );
};
