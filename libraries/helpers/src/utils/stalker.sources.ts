// Which Stalker sources are shown and polled. Facebook, Instagram, Reddit,
// and LinkedIn stay in the backend until they are switched on here.
export const STALKER_SOURCE_ENABLED = {
  x: true,
  youtube: true,
  reddit: false,
  linkedin: false,
  facebook: false,
  instagram: false,
} as const;

const family = (id: string) => {
  const key = (id || '').split('_')[0].trim().toLowerCase();
  if (key === 'x') return 'x';
  return key;
};

export const stalkerSourceEnabled = (id: string) => {
  const key = family(id);
  return STALKER_SOURCE_ENABLED[key as keyof typeof STALKER_SOURCE_ENABLED] === true;
};

export const STALKER_FILTER_SOURCES = ['X', 'YOUTUBE'] as const;
export const STALKER_ENGAGEMENT_SOURCES = ['X', 'YOUTUBE'] as const;
