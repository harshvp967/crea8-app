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

export type ComposerHandoff<T> = {
  at: number;
  state: T;
};

let handoff: ComposerHandoff<unknown> | null = null;
let restored = false;

export function stashComposerHandoff<T>(state: T, at = Date.now()) {
  handoff = { at, state };
}

/**
 * Returns the draft only when the composer remounted immediately (resize,
 * rotate, phone/desktop switch). A later open starts from the post props.
 */
export function consumeComposerHandoff<T>(now = Date.now()): T | null {
  const current = handoff as ComposerHandoff<T> | null;
  handoff = null;
  if (!current || now - current.at > COMPOSER_DRAFT_RESTORE_MS) {
    return null;
  }
  restored = true;
  return current.state;
}

/** Parent mount effects run after the child restores. They must not overwrite it. */
export function consumeComposerRestored() {
  const value = restored;
  restored = false;
  return value;
}

export function composerHandoffForTests() {
  return handoff;
}

export function resetComposerHandoffForTests() {
  handoff = null;
  restored = false;
}
