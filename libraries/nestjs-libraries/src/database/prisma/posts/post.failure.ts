// What we store on Post.error and what the editor/preview payload already
// returns. Error.message is not enumerable, so JSON.stringify(err) drops the
// provider sentence and leaves "{}" or activity metadata.

const MAX_REASON = 2_000;

function text(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function fromDetails(details: unknown): string {
  if (!Array.isArray(details)) {
    return '';
  }

  for (const item of details) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const json = text((item as { json?: unknown }).json);
    if (!json || json === '{}') {
      continue;
    }

    try {
      const parsed = JSON.parse(json) as {
        message?: unknown;
        error?: unknown;
        error_description?: unknown;
      };
      const message =
        text(parsed?.message) ||
        text(parsed?.error) ||
        text(parsed?.error_description);
      if (message && message !== '{}') {
        return message;
      }
    } catch {
      return json;
    }
  }

  return '';
}

function readFailure(err: unknown, depth = 0): string {
  if (depth > 4 || !err || typeof err !== 'object') {
    return '';
  }

  const row = err as {
    message?: unknown;
    cause?: unknown;
    details?: unknown;
  };
  const cause =
    row.cause && typeof row.cause === 'object'
      ? (row.cause as { message?: unknown; details?: unknown; cause?: unknown })
      : undefined;
  const nested = cause?.cause ? readFailure(cause.cause, depth + 1) : '';
  const reason =
    fromDetails(cause?.details) ||
    fromDetails(row.details) ||
    text(cause?.message) ||
    nested ||
    text(row.message);

  if (!reason || reason === '{}' || reason === '[object Object]') {
    return '';
  }

  return reason.length > MAX_REASON
    ? `${reason.slice(0, MAX_REASON)}…`
    : reason;
}

export function postFailureReason(err: unknown): string {
  if (typeof err === 'string') {
    return text(err) || 'Could not publish';
  }

  return readFailure(err) || 'Could not publish';
}

export function publishedPostWrite(releaseId: string, releaseURL: string) {
  return {
    state: 'PUBLISHED' as const,
    releaseURL,
    releaseId,
  };
}

export function postErrorWrite<T extends string>(state: T, err?: unknown) {
  const error = err ? postFailureReason(err) : '';
  return {
    state,
    ...(error ? { error } : {}),
  };
}

// The edit modal and the public preview both load the post row. Tokens stay
// off the channel. `error` and `state` stay on the post.
export function editorLoadedPost<
  T extends {
    integration?: {
      id: string;
      name: string;
      picture?: string | null;
      providerIdentifier: string;
      profile?: string | null;
    } | null;
  }
>(post: T) {
  const { integration, ...fields } = post;
  return {
    ...fields,
    ...(integration
      ? {
          integration: {
            id: integration.id,
            name: integration.name,
            picture: integration.picture,
            providerIdentifier: integration.providerIdentifier,
            profile: integration.profile,
          },
        }
      : {}),
  };
}

export type PostActivityFailureKind =
  | 'retry'
  | 'stop'
  | 'bad-body'
  | 'timeout'
  | 'unknown';

// A successful token refresh may publish once more. A retry that did not refresh
// (the activity never started) and every other failure are final, so Post now
// does not stay Scheduled through the workflow's retry budget.
export function postNowShouldFailNow(
  type: PostActivityFailureKind,
  tokenRefreshed: boolean,
  alreadyRetriedRefresh: boolean
): boolean {
  return !(type === 'retry' && tokenRefreshed && !alreadyRetriedRefresh);
}
