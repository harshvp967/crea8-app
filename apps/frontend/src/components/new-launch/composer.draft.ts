/** A layout remount runs cleanup and the next effect in the same turn. */
export const COMPOSER_DRAFT_RESTORE_MS = 100;

const DRAFT_KEYS = [
  'editor',
  'loaded',
  'date',
  'postComment',
  'dummy',
  'repeater',
  'isCreateSet',
  'totalChars',
  'activateExitButton',
  'tags',
  'tab',
  'current',
  'comments',
  'locked',
  'hide',
  'integrations',
  'selectedIntegrations',
  'global',
  'internal',
  'chars',
  'inlineImages',
  'channelDates',
] as const;

/** Data fields only. Store actions stay on the live zustand object. */
export function draftSnapshot(state: object) {
  const source = state as Record<string, unknown>;
  const snapshot: Record<string, unknown> = {};
  for (const key of DRAFT_KEYS) {
    if (key in source) {
      snapshot[key] = source[key];
    }
  }
  return snapshot;
}

/** Existing posts restore under their id. A composer with no post is `new`. */
export function composerDraftKey(postId: string | null | undefined) {
  if (typeof postId === 'string' && postId.trim()) {
    return postId.trim();
  }
  return 'new';
}

export type ComposerHandoff<T> = {
  key: string;
  at: number;
  state: T;
};

let layoutAt: number | null = null;
let handoff: ComposerHandoff<unknown> | null = null;
let restoredKey: string | null = null;
let appliedKey: string | null = null;

/** Call from a resize or orientation listener, just before a layout remount. */
export function markComposerLayoutRemount(at = Date.now()) {
  layoutAt = at;
}

/** Close, discard, and save must not keep a resize mark that would stash. */
export function clearComposerLayoutRemount() {
  layoutAt = null;
}

/**
 * Stores the draft only when a rotate/resize remount was marked moments ago.
 * Close, discard, and save unmount without that mark, so they do not stash.
 */
export function stashComposerHandoff<T>(key: string, state: T, at = Date.now()) {
  if (layoutAt == null || at - layoutAt > COMPOSER_DRAFT_RESTORE_MS) {
    return;
  }
  layoutAt = null;
  handoff = { key, at, state };
}

/**
 * Returns the draft only for the same post, and only when the composer
 * remounted immediately. A miss clears the restored flag.
 */
export function consumeComposerHandoff<T>(key: string, now = Date.now()): T | null {
  const current = handoff as ComposerHandoff<T> | null;
  handoff = null;
  if (!current || current.key !== key || now - current.at > COMPOSER_DRAFT_RESTORE_MS) {
    restoredKey = null;
    return null;
  }
  restoredKey = key;
  appliedKey = key;
  return current.state;
}

/** Reads and clears the restored flag. A stale flag cannot skip the next open. */
export function consumeComposerRestored(key: string) {
  const value = restoredKey === key;
  restoredKey = null;
  return value;
}

/** The child skips seeding when this mount already applied the handoff. */
export function consumeComposerApplied(key: string) {
  const value = appliedKey === key;
  appliedKey = null;
  return value;
}

/** Drop a flag the child never read so the next open still seeds. */
export function clearComposerRestoreFlags() {
  restoredKey = null;
  appliedKey = null;
}

export function composerHandoffForTests() {
  return handoff;
}

export function resetComposerHandoffForTests() {
  layoutAt = null;
  handoff = null;
  clearComposerRestoreFlags();
}
