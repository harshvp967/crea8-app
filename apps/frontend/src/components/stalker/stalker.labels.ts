import { decodeHtmlEntities, normalizeHandle } from '@gitroom/helpers/utils/stalker.text';

// One place for Stalker source labels (Check now, keywords, analytics, filters).
const LABELS: Record<string, string> = {
  youtube: 'YouTube',
  reddit: 'Reddit',
  x: 'X',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
};

/** Accepts a source id (`youtube`) or a mention source enum (`YOUTUBE_COMMENT`). */
export const sourceLabel = (value: string) => {
  const raw = (value || '').trim();
  if (!raw) return '';
  const key = raw.split('_')[0].toLowerCase();
  return LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1);
};

type MentionText = { text?: string; authorName?: string; authorHandle?: string };

/**
 * Plain text for mention rows stored before the API decoded entities: "&amp;"
 * becomes "&", "@@ada" becomes "ada" (the UI adds one "@"). Render the result
 * as a text node, never with dangerouslySetInnerHTML.
 */
export const cleanMention = <T extends MentionText>(row: T): T => ({
  ...row,
  ...(typeof row.text === 'string' ? { text: decodeHtmlEntities(row.text) } : {}),
  ...(typeof row.authorName === 'string'
    ? { authorName: decodeHtmlEntities(row.authorName) }
    : {}),
  ...(typeof row.authorHandle === 'string'
    ? { authorHandle: normalizeHandle(row.authorHandle) }
    : {}),
});

/** Profile link for an author; falls back to the mention itself. */
export const authorUrl = (source: string, handle: string, fallback: string) => {
  const key = (source || '').split('_')[0].toUpperCase();
  const clean = normalizeHandle(handle);
  if (!clean || /\s/.test(clean)) return fallback || '#';
  if (key === 'X') return `https://x.com/${encodeURIComponent(clean)}`;
  if (key === 'YOUTUBE') return `https://www.youtube.com/@${encodeURIComponent(clean)}`;
  if (key === 'REDDIT') return `https://www.reddit.com/user/${encodeURIComponent(clean)}`;
  return fallback || '#';
};
