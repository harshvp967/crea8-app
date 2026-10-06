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
