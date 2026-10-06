import { createHash } from 'crypto';
import type { StalkerMentionDraft } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import type { StalkerSourceId } from '@gitroom/nestjs-libraries/stalker/stalker.source';

export type StalkerIdentity = {
  brand: string;
  aliases: string[];
  exclusions: string[];
  handles: {
    x: string;
    redditUser: string;
    redditSubreddit: string;
    youtube: string;
    linkedin: string;
    instagram: string;
    facebook: string;
  };
};

const RANK: Record<string, number> = {
  HANDLE: 4,
  ALIAS: 3,
  BRAND: 2,
  KEYWORD: 1,
};

export const cleanHandle = (value: string) =>
  value
    .trim()
    .replace(/^@/, '')
    .replace(/^u\//i, '')
    .replace(/^r\//i, '')
    .replace(/\s+/g, '')
    .slice(0, 80);

export const splitTerms = (value: string, max = 12) => {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const part of (value || '').split(/[\n,]/)) {
    const phrase = part.trim().replace(/\s+/g, ' ').replace(/"/g, '');
    if (phrase.length < 2 || phrase.length > 80) {
      continue;
    }
    const key = phrase.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    if (terms.length >= max) {
      break;
    }
    terms.push(phrase);
  }
  return terms;
};

const compact = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/^u\//, '')
    .replace(/^r\//, '')
    .replace(/[\s._-]/g, '');

const wordMatch = (text: string, term: string) => {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `(?:^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`,
    'iu'
  ).test(text);
};

export const containsPhrase = (text: string, phrase: string) => {
  const needle = (phrase || '').trim().replace(/\s+/g, ' ');
  return needle.length >= 2 && wordMatch(text || '', needle);
};

/**
 * Deterministic relevance gate that runs before (and overrides) the AI verdict.
 * - true: the mention matched a tracked keyword (any group, competitors included),
 *   is linked to a keyword, or its text contains an active keyword phrase.
 * - false: nothing matched at all (no brand, alias, handle or keyword in the text),
 *   e.g. fuzzy search results or unrelated comments. These stay off-topic.
 * - null: brand / alias / handle match. The AI may only drop clear spam or noise.
 */
export const matchRelevance = (
  row: { text?: string | null; matchKind?: string | null; keywordId?: string | null },
  keywordPhrases: string[]
): boolean | null => {
  if (row.matchKind === 'KEYWORD' || row.keywordId) {
    return true;
  }
  if (keywordPhrases.some((phrase) => containsPhrase(row.text || '', phrase))) {
    return true;
  }
  if (!row.matchKind) {
    return false;
  }
  return null;
};

export const readIdentity = (project: {
  name: string;
  brandName?: string | null;
  aliases?: string | null;
  exclusions?: string | null;
  handleX?: string | null;
  handleRedditUser?: string | null;
  handleRedditSubreddit?: string | null;
  handleYoutube?: string | null;
  handleLinkedin?: string | null;
  handleInstagram?: string | null;
  handleFacebook?: string | null;
}): StalkerIdentity => ({
  brand: (project.brandName || project.name || '').trim(),
  aliases: splitTerms(project.aliases || ''),
  exclusions: splitTerms(project.exclusions || '', 20),
  handles: {
    x: cleanHandle(project.handleX || ''),
    redditUser: cleanHandle(project.handleRedditUser || ''),
    redditSubreddit: cleanHandle(project.handleRedditSubreddit || ''),
    youtube: cleanHandle(project.handleYoutube || ''),
    linkedin: cleanHandle(project.handleLinkedin || ''),
    instagram: cleanHandle(project.handleInstagram || ''),
    facebook: cleanHandle(project.handleFacebook || ''),
  },
});

export const handleForSource = (
  id: StalkerSourceId,
  identity: StalkerIdentity
) => {
  if (id === 'x') return identity.handles.x;
  if (id === 'reddit') return identity.handles.redditUser;
  if (id === 'youtube') return identity.handles.youtube;
  return identity.handles.linkedin;
};

const handlesForMention = (source: string, identity: StalkerIdentity) => {
  if (source.startsWith('YOUTUBE')) return [identity.handles.youtube];
  if (source.startsWith('REDDIT')) return [identity.handles.redditUser];
  if (source.startsWith('X')) return [identity.handles.x];
  if (source.startsWith('LINKEDIN')) return [identity.handles.linkedin];
  if (source.startsWith('INSTAGRAM')) return [identity.handles.instagram];
  if (source.startsWith('FACEBOOK')) return [identity.handles.facebook];
  return [];
};

const isOwnAuthor = (draft: StalkerMentionDraft, identity: StalkerIdentity) => {
  const own = handlesForMention(draft.source, identity)
    .map(compact)
    .filter((value) => value.length >= 2);
  if (!own.length) {
    return false;
  }
  const authors = [draft.authorHandle, draft.authorName]
    .map((value) => compact(value || ''))
    .filter((value) => value.length >= 2);
  return authors.some((author) => own.includes(author));
};

const detectMatch = (
  draft: StalkerMentionDraft,
  identity: StalkerIdentity
): { kind: 'BRAND' | 'ALIAS' | 'HANDLE' | 'KEYWORD'; label: string } | null => {
  const text = `${draft.text || ''}`;
  const handles = handlesForMention(draft.source, identity).filter(
    (value) => value.length >= 2
  );
  const subreddit = identity.handles.redditSubreddit;
  if (subreddit.length >= 2 && wordMatch(text, `r/${subreddit}`)) {
    return { kind: 'HANDLE', label: `r/${subreddit}` };
  }
  for (const handle of handles) {
    if (wordMatch(text, `@${handle}`)) {
      return { kind: 'HANDLE', label: `@${handle}` };
    }
    if (wordMatch(text, `u/${handle}`)) {
      return { kind: 'HANDLE', label: `u/${handle}` };
    }
  }
  for (const alias of identity.aliases) {
    if (wordMatch(text, alias)) {
      return { kind: 'ALIAS', label: alias };
    }
  }
  if (identity.brand.length >= 2 && wordMatch(text, identity.brand)) {
    return { kind: 'BRAND', label: identity.brand };
  }
  for (const handle of handles) {
    if (wordMatch(text, handle)) {
      return { kind: 'HANDLE', label: `@${handle}` };
    }
  }
  if (
    draft.keywordPhrase &&
    draft.keywordPhrase.length >= 2 &&
    wordMatch(text, draft.keywordPhrase)
  ) {
    return { kind: 'KEYWORD', label: draft.keywordPhrase };
  }
  return null;
};

export const tagDrafts = (
  drafts: StalkerMentionDraft[],
  identity: StalkerIdentity,
  requireMatch: boolean
) => {
  const kept: StalkerMentionDraft[] = [];
  for (const draft of drafts) {
    if (isOwnAuthor(draft, identity)) {
      continue;
    }
    if (identity.exclusions.some((term) => wordMatch(draft.text || '', term))) {
      continue;
    }
    const match = detectMatch(draft, identity);
    if (!match && requireMatch) {
      continue;
    }
    kept.push({
      ...draft,
      matchKind: match?.kind,
      matchLabel: match?.label || '',
    });
  }
  return kept;
};

export const SCAN_OVERLAP_MS = 60 * 60 * 1000;
export const SCAN_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
export const BACKFILL_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
export const SPIKE_WINDOW_MS = 6 * 60 * 60 * 1000;
export const SENTIMENT_WINDOW_MS = 24 * 60 * 60 * 1000;
export const SPIKE_MINIMUM = 4;

export type StalkerAlertScopeName = 'URGENT' | 'NEGATIVE' | 'ALL';

export const mentionContentHash = (draft: {
  source: string;
  authorHandle?: string;
  authorName?: string;
  text?: string;
}) => {
  const family = (draft.source || '').split('_')[0] || 'OTHER';
  const author = compact(draft.authorHandle || draft.authorName || '');
  const text = (draft.text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
  return createHash('sha256')
    .update(`${family}|${author}|${text}`)
    .digest('hex');
};

export const resolveScanSince = (input: {
  now: number;
  cursorAt?: Date | null;
  backfillUntil?: Date | null;
  lookbackMs?: number;
}) => {
  const backfill = input.backfillUntil?.getTime();
  if (backfill && backfill < input.now) {
    return { since: new Date(backfill), backfill: true };
  }
  const lookback = input.lookbackMs ?? SCAN_LOOKBACK_MS;
  const floor = input.now - lookback;
  const cursor = input.cursorAt?.getTime();
  if (cursor) {
    return {
      since: new Date(Math.max(floor, cursor - SCAN_OVERLAP_MS)),
      backfill: false,
    };
  }
  return { since: new Date(floor), backfill: false };
};

const includesAny = (text: string, words: string[]) =>
  words.some((word) => text.includes(word));

export const fallbackClassification = (
  text: string,
  categories: { name: string }[]
) => {
  const value = (text || '').toLowerCase();
  const negative = [
    'bug',
    'broken',
    'crash',
    'hate',
    'terrible',
    'awful',
    'scam',
    'refund',
    'worst',
    'angry',
    "doesn't work",
    'doesnt work',
    'disappointed',
  ];
  const positive = ['love', 'great', 'awesome', 'thanks', 'amazing', 'helpful', 'best'];
  let sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' = 'NEUTRAL';
  if (includesAny(value, negative)) {
    sentiment = 'NEGATIVE';
  } else if (includesAny(value, positive)) {
    sentiment = 'POSITIVE';
  }
  let wanted = '';
  if (includesAny(value, ['bug', 'crash', 'broken', 'error', "doesn't work", 'doesnt work'])) {
    wanted = 'bug';
  } else if (
    includesAny(value, ['feature', 'wish', 'would be nice', 'please add', 'suggestion'])
  ) {
    wanted = 'feature';
  } else if (
    includesAny(value, ['hate', 'terrible', 'awful', 'scam', 'refund', 'worst', 'angry', 'disappointed'])
  ) {
    wanted = 'complain';
  } else if (includesAny(value, ['love', 'great', 'awesome', 'amazing', 'thank'])) {
    wanted = 'praise';
  }
  const match =
    categories.find((category) =>
      wanted ? category.name.toLowerCase().includes(wanted) : false
    ) ||
    categories.find((category) => category.name.toLowerCase().includes('other')) ||
    categories[0];
  const urgency =
    sentiment === 'NEGATIVE' && (wanted === 'bug' || wanted === 'complain')
      ? 75
      : sentiment === 'NEGATIVE'
        ? 40
        : 10;
  return {
    categoryName: match?.name || 'Other',
    sentiment,
    urgency,
    relevant: true,
  };
};

export const mentionMatchesScope = (
  scope: StalkerAlertScopeName,
  item: {
    categoryName: string;
    sentiment: string;
    urgency: number;
    relevant: boolean;
  }
) => {
  if (!item.relevant) {
    return false;
  }
  if (scope === 'ALL') {
    return true;
  }
  const urgent =
    item.urgency >= 70 || /bug|complain/i.test(item.categoryName || '');
  if (scope === 'URGENT') {
    return urgent;
  }
  return item.sentiment === 'NEGATIVE';
};

export const shouldFireVolumeSpike = (input: {
  recent: number;
  previous: number;
  multiplier: number;
  minimum?: number;
}) => {
  const minimum = input.minimum ?? SPIKE_MINIMUM;
  const multiplier = Math.max(2, input.multiplier || 2);
  if (input.recent < minimum) {
    return false;
  }
  if (input.previous <= 0) {
    return true;
  }
  return input.recent >= input.previous * multiplier;
};

export const shouldFireSentimentDrop = (input: {
  recentNegative: number;
  recentTotal: number;
  previousNegative: number;
  previousTotal: number;
  points: number;
  minimum?: number;
}) => {
  const minimum = input.minimum ?? SPIKE_MINIMUM;
  if (input.recentTotal < minimum || input.previousTotal < minimum) {
    return false;
  }
  const nowPct = (input.recentNegative / input.recentTotal) * 100;
  const prevPct = (input.previousNegative / input.previousTotal) * 100;
  return nowPct - prevPct >= Math.max(5, input.points || 20);
};

export const sentimentShare = (negative: number, total: number) =>
  total > 0 ? Math.round((negative / total) * 100) : 0;

export const matchRank = (kind?: string) => (kind ? RANK[kind] || 0 : 0);

export const dedupeDrafts = (drafts: StalkerMentionDraft[]) => {
  const ranked = new Map<string, StalkerMentionDraft>();
  for (const draft of drafts) {
    const previous = ranked.get(draft.externalId);
    if (!previous || matchRank(draft.matchKind) >= matchRank(previous.matchKind)) {
      ranked.set(draft.externalId, {
        ...draft,
        keywordPhrase: draft.keywordPhrase || previous?.keywordPhrase,
      });
    } else if (draft.keywordPhrase && !previous.keywordPhrase) {
      ranked.set(draft.externalId, {
        ...previous,
        keywordPhrase: draft.keywordPhrase,
      });
    }
  }
  return [...ranked.values()];
};
