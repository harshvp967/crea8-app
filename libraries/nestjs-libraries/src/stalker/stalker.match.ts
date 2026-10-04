import { StalkerMentionDraft } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { StalkerSourceId } from '@gitroom/nestjs-libraries/stalker/stalker.source';

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
