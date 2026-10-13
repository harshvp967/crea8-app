import { StalkerMentionDraft } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { timer } from '@gitroom/helpers/utils/timer';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';
import {
  StalkerSearchScope,
  StalkerSearchTerms,
  StalkerSourceProvider,
} from '@gitroom/nestjs-libraries/stalker/stalker.source';

// Official API v2 recent search. Uses X_STALKER_BEARER_TOKEN when set.
// Otherwise exchanges X_API_KEY and X_API_SECRET for an app-only bearer.
export const X_APP_BEARER_REDIS_KEY = 'stalker:x:app-bearer';

export const X_PLAN_ERROR =
  "X: X plan doesn't include search (needs X API Basic or pay-per-use credits)";
export const X_RATE_ERROR = 'X: rate limited, retrying next scan';
export const X_AUTH_ERROR = 'X: authentication failed';
export const X_QUERY_ERROR = 'X: search query was rejected';
export const X_DENIED_ERROR = 'X: not allowed to search';
export const X_DOWN_ERROR = 'X: unavailable, retrying next scan';
export const X_NEEDS_ACCESS = 'X: needs API access';
export const X_KEYS_REJECTED = 'X: app keys were rejected';
export const X_KEYS_FAILED = 'X: could not sign in with the app keys';

const TOKEN_URL = 'https://api.x.com/oauth2/token';
const DEFAULT_TTL_SEC = 2 * 60 * 60;
// Recent search max_results is 10–100 and defaults to 10 when it is omitted.
// One scan follows the pagination token until X_STALKER_MAX_RESULTS (default
// 100, hard cap 200). The page budget assumes a page may still be only 10
// posts, and it never exceeds 20 requests.
// https://docs.x.com/x-api/posts/search/integrate/paginate
export const X_STALKER_DEFAULT_RESULTS = 100;
export const X_STALKER_RESULT_CAP = 200;
export const X_STALKER_PAGE_FLOOR = 10;
export const X_STALKER_PAGE_CEILING = 20;
const X_SEARCH_CACHE_MS = 60 * 1000;
const X_RATE_LIMIT_WAIT_CAP_MS = 15_000;
const X_SINCE_TTL_MS = 8 * 24 * 60 * 60 * 1000;
const X_SNOWFLAKE_EPOCH = 1288834974657n;

export const xStalkerResultLimit = () => {
  const raw = Number((process.env.X_STALKER_MAX_RESULTS || '').trim());
  if (!Number.isFinite(raw) || raw <= 0) {
    return X_STALKER_DEFAULT_RESULTS;
  }
  return Math.min(X_STALKER_RESULT_CAP, Math.max(10, Math.floor(raw)));
};

export const xStalkerMaxPages = (limit = xStalkerResultLimit()) =>
  Math.min(
    X_STALKER_PAGE_CEILING,
    Math.max(1, Math.ceil(limit / X_STALKER_PAGE_FLOOR))
  );

const newerPostId = (current: string, candidate?: string) => {
  if (!candidate || !/^[0-9]{1,19}$/.test(candidate)) {
    return current;
  }
  if (!current) {
    return candidate;
  }
  try {
    return BigInt(candidate) > BigInt(current) ? candidate : current;
  } catch {
    return current;
  }
};

// since_id is only useful inside the recent-search window. A snowflake older
// than that falls back to start_time.
export const usableXSinceId = (id: string, now = Date.now()) => {
  if (!/^[0-9]{1,19}$/.test(id)) {
    return '';
  }
  try {
    const at = Number((BigInt(id) >> 22n) + X_SNOWFLAKE_EPOCH);
    if (!at || at < now - 6 * 24 * 60 * 60 * 1000) {
      return '';
    }
    return id;
  } catch {
    return '';
  }
};

const xSinceKey = (scope?: StalkerSearchScope) => {
  if (!scope?.projectId || !scope.phraseKey) {
    return '';
  }
  return `stalker:x:since:${scope.projectId}:${scope.phraseKey}`;
};

const readXSinceId = async (scope?: StalkerSearchScope) => {
  const key = xSinceKey(scope);
  if (!key || scope?.backfill) {
    return '';
  }
  try {
    return usableXSinceId((await ioRedis.get(key)) || '');
  } catch {
    return '';
  }
};

const writeXSinceId = async (scope: StalkerSearchScope | undefined, id: string) => {
  const key = xSinceKey(scope);
  const next = usableXSinceId(id);
  if (!key || !next) {
    return;
  }
  try {
    const current = usableXSinceId((await ioRedis.get(key)) || '');
    if (current && BigInt(current) >= BigInt(next)) {
      return;
    }
    await ioRedis.set(key, next);
    await ioRedis.pexpire(key, X_SINCE_TTL_MS);
  } catch {
    // The next scan falls back to start_time.
  }
};

const rateLimitWaitMs = (resetSeconds?: number | null, now = Date.now()) => {
  const reset = Number(resetSeconds || 0);
  if (!reset) {
    return null;
  }
  const wait = reset * 1000 - now;
  if (wait < 0 || wait > X_RATE_LIMIT_WAIT_CAP_MS) {
    return null;
  }
  return wait;
};

type SearchPage = {
  data?: {
    id: string;
    text?: string;
    author_id?: string;
    public_metrics?: { like_count?: number; reply_count?: number };
  }[];
  includes?: { users?: { id: string; name?: string; username?: string }[] };
  meta?: { next_token?: string; newest_id?: string; oldest_id?: string };
};

const searchMemory = new Map<
  string,
  { at: number; rows: StalkerMentionDraft[] }
>();
const searchInflight = new Map<string, Promise<StalkerMentionDraft[]>>();

type CachedBearer = { token: string; expiresAt: number };

let memory: CachedBearer | null = null;

const trimEnv = (name: string) => (process.env[name] || '').trim();

const appKeys = () => {
  const key = trimEnv('X_API_KEY');
  const secret = trimEnv('X_API_SECRET');
  if (!key || !secret) {
    return null;
  }
  return { key, secret };
};

const dedicatedBearer = () => trimEnv('X_STALKER_BEARER_TOKEN');

export const redactXSecrets = (value: string) => {
  let text = value.replace(/bearer\s+[a-z0-9\-._~+/]+=*/gi, 'bearer [redacted]');
  for (const secret of [dedicatedBearer(), trimEnv('X_API_KEY'), trimEnv('X_API_SECRET')]) {
    if (secret.length >= 6) {
      text = text.split(secret).join('[redacted]');
    }
  }
  return text;
};

const planLimited = (body: string) => {
  const hay = body.toLowerCase();
  return (
    hay.includes('client-not-enrolled') ||
    hay.includes('needs a higher') ||
    hay.includes('higher access') ||
    hay.includes('higher level') ||
    hay.includes('not enrolled') ||
    hay.includes('credits') ||
    hay.includes('usagecap') ||
    hay.includes('usage cap')
  );
};

// Maps an X HTTP response to the sentence Check now and the Keywords table show.
export const xApiFailure = (status: number, body: string) => {
  if ((status === 401 || status === 403 || status === 402) && planLimited(body)) {
    return X_PLAN_ERROR;
  }
  if (status === 402) {
    return X_PLAN_ERROR;
  }
  if (status === 429) {
    return X_RATE_ERROR;
  }
  if (status === 401) {
    return X_AUTH_ERROR;
  }
  if (status === 403) {
    return X_DENIED_ERROR;
  }
  if (status === 400) {
    return X_QUERY_ERROR;
  }
  if (status >= 500) {
    return X_DOWN_ERROR;
  }
  return `X: recent search failed (${status})`;
};

const tokenFailure = (status: number, body: string) => {
  if (status === 429) {
    return X_RATE_ERROR;
  }
  if (status >= 500) {
    return X_DOWN_ERROR;
  }
  if (xApiFailure(status, body) === X_PLAN_ERROR) {
    return X_PLAN_ERROR;
  }
  if (status === 401 || status === 403) {
    return X_KEYS_REJECTED;
  }
  return X_KEYS_FAILED;
};

export const formatXFailure = (detail?: string) => {
  const text = redactXSecrets((detail || '').trim());
  if (!text || /needs api access|coming soon|bearer token is set/i.test(text)) {
    return X_NEEDS_ACCESS;
  }
  if (text.startsWith('X: ')) {
    return text.slice(0, 300);
  }
  return `X: ${text}`.slice(0, 300);
};

export const resetXAppBearerCache = async () => {
  memory = null;
  searchMemory.clear();
  searchInflight.clear();
  try {
    await ioRedis.del(X_APP_BEARER_REDIS_KEY);
  } catch {
    memory = null;
  }
};

class XRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'XRequestError';
  }
}

const readBody = async (response: { text: () => Promise<string> }) => {
  try {
    return await response.text();
  } catch {
    return '';
  }
};

const readCache = async () => {
  const now = Date.now();
  if (memory && memory.expiresAt > now + 15_000) {
    return memory.token;
  }
  try {
    const raw = await ioRedis.get(X_APP_BEARER_REDIS_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as CachedBearer;
    if (!parsed?.token || !(parsed.expiresAt > now + 15_000)) {
      return null;
    }
    memory = parsed;
    return parsed.token;
  } catch {
    return null;
  }
};

const writeCache = async (token: string, expiresAt: number) => {
  memory = { token, expiresAt };
  const ttl = Math.max(30, Math.floor((expiresAt - Date.now()) / 1000));
  try {
    await ioRedis.set(X_APP_BEARER_REDIS_KEY, JSON.stringify(memory), 'EX', ttl);
  } catch {
    // The in-memory copy still serves this process.
  }
};

const clearCache = async () => {
  memory = null;
  try {
    await ioRedis.del(X_APP_BEARER_REDIS_KEY);
  } catch {
    memory = null;
  }
};

export class XStalkerSource implements StalkerSourceProvider {
  id = 'x' as const;
  label = 'X';
  filter = 'X';

  integrationIdentifier(): string | null {
    return null;
  }

  searchesWithoutAccount() {
    return this.enabled();
  }

  enabled() {
    return !!dedicatedBearer() || !!appKeys();
  }

  cacheNamespace(scope: StalkerSearchScope) {
    if (!scope.projectId) {
      return '';
    }
    return `${scope.projectId}:${scope.backfill ? 'b' : 'l'}`;
  }

  statusDetail(available: boolean) {
    return available ? 'Official recent search' : 'Needs API access';
  }

  buildQuery(input: StalkerSearchTerms) {
    const phrases = (input.phrases || [])
      .map((phrase) => phrase.trim().replace(/"/g, ''))
      .filter((phrase) => phrase.length >= 2)
      .slice(0, 8)
      .map((phrase) => `"${phrase}"`);
    const handle = (input.handle || '').trim().replace(/^@/, '');
    const handleOk = /^[A-Za-z0-9_]{2,15}$/.test(handle);
    if (handleOk) {
      phrases.push(`@${handle}`);
    }
    if (!phrases.length) {
      return '';
    }
    const query = phrases.join(' OR ');
    return (handleOk ? `${query} -from:${handle}` : query).slice(0, 500);
  }

  async search(
    keyword: string,
    since: Date,
    _auth?: { accessToken?: string },
    scope?: StalkerSearchScope
  ): Promise<StalkerMentionDraft[]> {
    const bearer = dedicatedBearer();
    if (bearer) {
      return this.recent(keyword, since, bearer, scope);
    }
    if (!appKeys()) {
      return [];
    }
    const token = await this.appBearer(false);
    try {
      return await this.recent(keyword, since, token, scope);
    } catch (err) {
      if (!(err instanceof XRequestError) || err.status !== 401) {
        throw err;
      }
      const refreshed = await this.appBearer(true);
      return this.recent(keyword, since, refreshed, scope);
    }
  }

  private async appBearer(force: boolean) {
    if (force) {
      await clearCache();
    } else {
      const cached = await readCache();
      if (cached) {
        return cached;
      }
    }
    const keys = appKeys();
    if (!keys) {
      throw new Error(X_NEEDS_ACCESS);
    }
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization:
          'Basic ' + Buffer.from(`${keys.key}:${keys.secret}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    });
    const raw = await readBody(response);
    if (!response.ok) {
      throw new XRequestError(tokenFailure(response.status, raw), response.status);
    }
    let json: { access_token?: string; expires_in?: number } = {};
    try {
      json = raw ? (JSON.parse(raw) as { access_token?: string; expires_in?: number }) : {};
    } catch {
      json = {};
    }
    if (!json.access_token) {
      throw new Error(X_KEYS_REJECTED);
    }
    const seconds =
      json.expires_in && json.expires_in > 90
        ? json.expires_in - 60
        : DEFAULT_TTL_SEC;
    await writeCache(json.access_token, Date.now() + seconds * 1000);
    return json.access_token;
  }

  private async recent(
    keyword: string,
    since: Date,
    token: string,
    scope?: StalkerSearchScope
  ) {
    const oldest = Date.now() - 6 * 24 * 60 * 60 * 1000;
    const start = new Date(Math.max(since.getTime(), oldest));
    const query =
      keyword.includes(' OR ') ||
      keyword.startsWith('"') ||
      keyword.startsWith('@')
        ? keyword
        : keyword.includes(' ')
          ? `"${keyword}"`
          : keyword;
    const limit = xStalkerResultLimit();
    const sinceId = await readXSinceId(scope);
    const cacheKey = `${scope?.projectId || ''}|${scope?.backfill ? 'b' : 'l'}|${query}|${sinceId}|${start.toISOString().slice(0, 16)}|${limit}`;
    const hit = searchMemory.get(cacheKey);
    if (hit && Date.now() - hit.at < X_SEARCH_CACHE_MS) {
      return hit.rows;
    }
    const pending = searchInflight.get(cacheKey);
    if (pending) {
      return pending;
    }
    const run = this.collectRecent(query, keyword, start, token, limit, sinceId)
      .then(async (result) => {
        if (result.complete) {
          searchMemory.set(cacheKey, { at: Date.now(), rows: result.rows });
          if (result.newestId) {
            await writeXSinceId(scope, result.newestId);
          }
        }
        return result.rows;
      })
      .finally(() => {
        searchInflight.delete(cacheKey);
      });
    searchInflight.set(cacheKey, run);
    return run;
  }

  private async collectRecent(
    query: string,
    keyword: string,
    start: Date,
    token: string,
    limit: number,
    sinceId: string
  ) {
    const collected: StalkerMentionDraft[] = [];
    const seen = new Set<string>();
    let nextToken = '';
    // Recent search accepts next_token. If a page repeats, one retry uses
    // pagination_token, which is the other name the endpoint documents.
    let pageParam: 'next_token' | 'pagination_token' = 'next_token';
    let retriedDuplicate = false;
    let newestId = '';
    let complete = false;
    const maxPages = xStalkerMaxPages(limit);
    for (let page = 0; page < maxPages && collected.length < limit; page++) {
      const remaining = limit - collected.length;
      const pageSize = Math.min(100, Math.max(X_STALKER_PAGE_FLOOR, remaining));
      const params = new URLSearchParams({
        query,
        max_results: String(pageSize),
        'tweet.fields': 'created_at,author_id,public_metrics',
        expansions: 'author_id',
        'user.fields': 'name,username',
      });
      // At most one of start_time and since_id. since_id skips posts already read.
      if (sinceId) {
        params.set('since_id', sinceId);
      } else {
        params.set('start_time', start.toISOString());
      }
      if (nextToken) {
        params.set(pageParam, nextToken);
      }
      const json = await this.recentPage(
        `https://api.x.com/2/tweets/search/recent?${params.toString()}`,
        token
      );
      const users = new Map(
        (json.includes?.users || []).map((user) => [user.id, user])
      );
      newestId = newerPostId(newestId, json.meta?.newest_id);
      let added = 0;
      for (const tweet of json.data || []) {
        newestId = newerPostId(newestId, tweet.id);
        if (!(tweet.text || '').trim() || !tweet.id || seen.has(tweet.id)) {
          continue;
        }
        seen.add(tweet.id);
        added += 1;
        const user = tweet.author_id ? users.get(tweet.author_id) : undefined;
        collected.push({
          externalId: `x-post:${tweet.id}`,
          source: 'X_POST',
          authorName: user?.name || user?.username || 'Someone',
          authorHandle: user?.username || '',
          text: (tweet.text || '').slice(0, 2000),
          url: `https://x.com/i/web/status/${tweet.id}`,
          postExternalId: tweet.id,
          keywordPhrase: keyword,
          likeCount: tweet.public_metrics?.like_count || 0,
          replyCount: tweet.public_metrics?.reply_count || 0,
        });
        if (collected.length >= limit) {
          break;
        }
      }
      const upcoming = json.meta?.next_token || '';
      if (added === 0) {
        const repeated = (json.data || []).some((tweet) => tweet.id && seen.has(tweet.id));
        if (repeated && nextToken && !retriedDuplicate && pageParam === 'next_token') {
          retriedDuplicate = true;
          pageParam = 'pagination_token';
          continue;
        }
        // The page repeated, or there is nothing new. Stop instead of paying
        // to read the same posts again.
        complete = true;
        break;
      }
      if (!upcoming) {
        complete = true;
        break;
      }
      nextToken = upcoming;
    }
    if (collected.length >= limit) {
      complete = true;
    }
    return { rows: collected, complete, newestId };
  }

  private async recentPage(url: string, token: string, attempt = 0): Promise<SearchPage> {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 429 && attempt === 0) {
      const wait = rateLimitWaitMs(
        Number(response.headers.get('x-rate-limit-reset') || 0)
      );
      if (wait !== null) {
        await timer(wait);
        return this.recentPage(url, token, attempt + 1);
      }
    }
    if (!response.ok) {
      const raw = await readBody(response);
      throw new XRequestError(xApiFailure(response.status, raw), response.status);
    }
    const raw = await readBody(response);
    try {
      return raw ? (JSON.parse(raw) as SearchPage) : {};
    } catch {
      throw new Error(X_DOWN_ERROR);
    }
  }
}
