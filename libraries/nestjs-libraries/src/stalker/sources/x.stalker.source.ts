import { StalkerMentionDraft } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { timer } from '@gitroom/helpers/utils/timer';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';
import {
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
// Recent search max_results is 10–100. Default one full page; never more than
// two full pages, and never more than 3 requests, so a bad env value cannot
// page forever. https://docs.x.com/x-api/posts/search/integrate/paginate
export const X_STALKER_DEFAULT_RESULTS = 100;
export const X_STALKER_RESULT_CAP = 200;
export const X_STALKER_MAX_PAGES = 3;
const X_SEARCH_CACHE_MS = 60 * 1000;
const X_RATE_LIMIT_WAIT_CAP_MS = 15_000;

export const xStalkerResultLimit = () => {
  const raw = Number((process.env.X_STALKER_MAX_RESULTS || '').trim());
  if (!Number.isFinite(raw) || raw <= 0) {
    return X_STALKER_DEFAULT_RESULTS;
  }
  return Math.min(X_STALKER_RESULT_CAP, Math.max(10, Math.floor(raw)));
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
  meta?: { next_token?: string };
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

  async search(keyword: string, since: Date): Promise<StalkerMentionDraft[]> {
    const bearer = dedicatedBearer();
    if (bearer) {
      return this.recent(keyword, since, bearer);
    }
    if (!appKeys()) {
      return [];
    }
    const token = await this.appBearer(false);
    try {
      return await this.recent(keyword, since, token);
    } catch (err) {
      if (!(err instanceof XRequestError) || err.status !== 401) {
        throw err;
      }
      const refreshed = await this.appBearer(true);
      return this.recent(keyword, since, refreshed);
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

  private async recent(keyword: string, since: Date, token: string) {
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
    const cacheKey = `${query}|${start.toISOString().slice(0, 16)}|${limit}`;
    const hit = searchMemory.get(cacheKey);
    if (hit && Date.now() - hit.at < X_SEARCH_CACHE_MS) {
      return hit.rows;
    }
    const pending = searchInflight.get(cacheKey);
    if (pending) {
      return pending;
    }
    const run = this.collectRecent(query, keyword, start, token, limit)
      .then((rows) => {
        searchMemory.set(cacheKey, { at: Date.now(), rows });
        return rows;
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
    limit: number
  ) {
    const collected: StalkerMentionDraft[] = [];
    const seen = new Set<string>();
    let nextToken = '';
    for (let page = 0; page < X_STALKER_MAX_PAGES && collected.length < limit; page++) {
      const remaining = limit - collected.length;
      const pageSize = Math.min(100, Math.max(10, remaining));
      const params = new URLSearchParams({
        query,
        max_results: String(pageSize),
        start_time: start.toISOString(),
        'tweet.fields': 'created_at,author_id,public_metrics',
        expansions: 'author_id',
        'user.fields': 'name,username',
      });
      if (nextToken) {
        params.set('next_token', nextToken);
      }
      const json = await this.recentPage(
        `https://api.x.com/2/tweets/search/recent?${params.toString()}`,
        token
      );
      const users = new Map(
        (json.includes?.users || []).map((user) => [user.id, user])
      );
      let added = 0;
      for (const tweet of json.data || []) {
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
      nextToken = json.meta?.next_token || '';
      if (!nextToken || added === 0) {
        break;
      }
    }
    return collected;
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
