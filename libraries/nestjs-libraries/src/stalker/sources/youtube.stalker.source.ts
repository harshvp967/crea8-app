import { createHash } from 'crypto';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library/build/src/auth/oauth2client';
import { StalkerMentionDraft } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';
import {
  StalkerSearchTerms,
  StalkerSourceAuth,
  StalkerSourceProvider,
} from '@gitroom/nestjs-libraries/stalker/stalker.source';

const youtubeClient = (accessToken: string) => {
  const client = new google.auth.OAuth2({
    clientId: process.env.YOUTUBE_CLIENT_ID,
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
    redirectUri: `${process.env.FRONTEND_URL}/integrations/social/youtube`,
  });
  client.setCredentials({ access_token: accessToken });
  return google.youtube({
    version: 'v3',
    auth: client as OAuth2Client,
  });
};

type YoutubeClient = ReturnType<typeof youtubeClient>;

const youtubeApiKey = () => (process.env.YOUTUBE_STALKER_API_KEY || '').trim();

// Pass the key as the `key` query param. google.youtube({ auth: apiKey })
// sends it as a bearer token and YouTube answers 401 Invalid Credentials.
const youtubeForSearch = (
  accessToken?: string
): { client: YoutubeClient; apiKey: string } | null => {
  const apiKey = youtubeApiKey();
  if (apiKey) {
    return {
      client: google.youtube({ version: 'v3' }) as YoutubeClient,
      apiKey,
    };
  }
  if (!accessToken) {
    return null;
  }
  return { client: youtubeClient(accessToken), apiKey: '' };
};

export const isProviderAuthFailure = (err: unknown) => {
  if (!err || typeof err !== 'object') {
    return false;
  }
  const value = err as {
    code?: number | string;
    status?: number;
    message?: string;
    response?: {
      status?: number;
      data?: {
        error?: string | { status?: string; message?: string };
        error_description?: string;
      };
    };
  };
  const status = value.response?.status;
  if (status === 401) {
    return true;
  }
  if (value.code === 401 || value.status === 401) {
    return true;
  }
  const dataError = value.response?.data?.error;
  if (dataError === 'invalid_token' || dataError === 'invalid_grant') {
    return true;
  }
  if (
    typeof dataError === 'object' &&
    (dataError.status === 'UNAUTHENTICATED' ||
      /invalid credentials|invalid_token/i.test(dataError.message || ''))
  ) {
    return true;
  }
  const message = `${value.message || ''} ${
    value.response?.data?.error_description || ''
  }`;
  return /invalid credentials|invalid_token|unauthenticated/i.test(message);
};

export const YOUTUBE_QUOTA_MESSAGE = 'quota exceeded, retrying next scan';
const YOUTUBE_QUOTA_KEY = 'stalker:yt:quota';
const YOUTUBE_SEARCH_MAX = 5;

type CachedYoutubeComment = {
  id: string;
  author: string;
  text: string;
  likeCount: number;
};

type CachedYoutubeVideo = {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  comments: CachedYoutubeComment[];
};

type CachedYoutubeSearch = {
  publishedAfter: string;
  videos: CachedYoutubeVideo[];
};

const youtubeCacheKeys = new Set<string>();
const searchInflight = new Map<string, Promise<CachedYoutubeSearch>>();
const channelInflight = new Map<string, Promise<StalkerMentionDraft[]>>();

export const youtubeStalkerCacheSeconds = () => {
  const raw = (process.env.YOUTUBE_STALKER_CACHE_HOURS || '').trim();
  if (raw === '0') {
    return 0;
  }
  const hours = Number(raw);
  if (!Number.isFinite(hours) || hours <= 0) {
    return 6 * 60 * 60;
  }
  return Math.round(Math.min(24, hours) * 60 * 60);
};

const secondsUntilPacificMidnight = (now = new Date()) => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const read = (type: string) =>
      Number(parts.find((part) => part.type === type)?.value || 0);
    const elapsed = read('hour') * 3600 + read('minute') * 60 + read('second');
    return Math.max(60, 24 * 3600 - elapsed);
  } catch {
    return 60 * 60;
  }
};

const quotaReason = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as {
    reason?: string;
    message?: string;
    errors?: unknown[];
    error?: unknown;
    response?: { data?: unknown };
  };
  if (/quotaExceeded|dailyLimitExceeded/i.test(record.reason || '')) {
    return true;
  }
  if (/quotaExceeded|dailyLimitExceeded|exceeded your quota/i.test(record.message || '')) {
    return true;
  }
  if (Array.isArray(record.errors) && record.errors.some((item) => quotaReason(item))) {
    return true;
  }
  if (record.error && quotaReason(record.error)) {
    return true;
  }
  if (record.response?.data && quotaReason(record.response.data)) {
    return true;
  }
  return false;
};

export const isYoutubeQuotaError = (err: unknown) => quotaReason(err);

export const resetYoutubeStalkerCache = async () => {
  searchInflight.clear();
  channelInflight.clear();
  const keys = [YOUTUBE_QUOTA_KEY, ...youtubeCacheKeys];
  youtubeCacheKeys.clear();
  await Promise.all(
    keys.map((key) =>
      ioRedis.del(key).catch(() => {
        return 0;
      })
    )
  );
};

const readYoutubeCache = async <T>(key: string): Promise<T | null> => {
  try {
    const raw = await ioRedis.get(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const writeYoutubeCache = async (key: string, value: unknown) => {
  const seconds = youtubeStalkerCacheSeconds();
  if (!seconds) {
    return;
  }
  youtubeCacheKeys.add(key);
  try {
    await ioRedis.set(key, JSON.stringify(value));
    await ioRedis.pexpire(key, seconds * 1000);
  } catch {
    // A cache miss still searches.
  }
};

const markYoutubeQuota = async () => {
  try {
    await ioRedis.set(YOUTUBE_QUOTA_KEY, '1');
    await ioRedis.pexpire(YOUTUBE_QUOTA_KEY, secondsUntilPacificMidnight() * 1000);
  } catch {
    // The thrown error still stops this scan's later calls in this process
    // only when Redis is up. A Redis miss just fails this request.
  }
};

const assertYoutubeQuota = async () => {
  try {
    if (await ioRedis.get(YOUTUBE_QUOTA_KEY)) {
      throw new Error(YOUTUBE_QUOTA_MESSAGE);
    }
  } catch (err) {
    if (err instanceof Error && err.message === YOUTUBE_QUOTA_MESSAGE) {
      throw err;
    }
  }
};

const youtubeCacheId = (parts: string[]) =>
  `stalker:yt:${createHash('sha256').update(parts.join('\n')).digest('hex').slice(0, 32)}`;

const searchCovers = (entry: CachedYoutubeSearch, since: Date) => {
  const cachedSince = Date.parse(entry.publishedAfter);
  return Number.isFinite(cachedSince) && cachedSince <= since.getTime();
};

// A channel comment call failed for a reason other than quota. The empty
// result is returned and not cached, so the next scan tries again.
export class YoutubeChannelMiss extends Error {
  constructor() {
    super('YouTube channel comments skipped');
    this.name = 'YoutubeChannelMiss';
  }
}

// Channel comment threads are collected once per channel during the cache
// window and copied onto every project that scans that channel.
export const cachedYoutubeChannelComments = async (
  channelId: string,
  load: () => Promise<StalkerMentionDraft[]>
) => {
  const key = youtubeCacheId(['channel', channelId]);
  const cached = await readYoutubeCache<StalkerMentionDraft[]>(key);
  if (cached) {
    return cached;
  }
  await assertYoutubeQuota();
  const pending = channelInflight.get(channelId);
  if (pending) {
    return pending;
  }
  const run = load()
    .then(async (drafts) => {
      await writeYoutubeCache(key, drafts);
      return drafts;
    })
    .catch(async (err: unknown) => {
      if (err instanceof YoutubeChannelMiss) {
        return [];
      }
      if (isYoutubeQuotaError(err)) {
        await markYoutubeQuota();
        throw new Error(YOUTUBE_QUOTA_MESSAGE);
      }
      throw err;
    })
    .finally(() => {
      channelInflight.delete(channelId);
    });
  channelInflight.set(channelId, run);
  return run;
};

export class YoutubeStalkerSource implements StalkerSourceProvider {
  id = 'youtube' as const;
  label = 'YouTube';
  filter = 'YOUTUBE_SEARCH';

  integrationIdentifier() {
    return 'youtube';
  }

  searchesWithoutAccount() {
    return !!youtubeApiKey();
  }

  enabled(auth?: StalkerSourceAuth) {
    return !!youtubeApiKey() || !!auth?.accessToken;
  }

  statusDetail(available: boolean) {
    if (youtubeApiKey()) {
      return 'Using YOUTUBE_STALKER_API_KEY';
    }
    return available ? 'Connected channel' : 'Connect a YouTube channel';
  }

  buildQuery(input: StalkerSearchTerms) {
    const parts = (input.phrases || [])
      .map((phrase) => phrase.trim().replace(/"/g, ''))
      .filter((phrase) => phrase.length >= 2)
      .slice(0, 8)
      .map((phrase) => (phrase.includes(' ') ? `"${phrase}"` : phrase));
    const handle = (input.handle || '').trim().replace(/^@/, '');
    if (handle.length >= 2) {
      parts.push(`@${handle}`);
    }
    return parts.join('|');
  }

  async search(
    keyword: string,
    since: Date,
    auth?: StalkerSourceAuth
  ): Promise<StalkerMentionDraft[]> {
    const youtube = youtubeForSearch(auth?.accessToken);
    if (!youtube) {
      return [];
    }
    const normalized = keyword.trim().toLowerCase();
    const cacheKey = youtubeCacheId(['search', normalized]);
    const cached = await readYoutubeCache<CachedYoutubeSearch>(cacheKey);
    if (cached && searchCovers(cached, since)) {
      return this.draftsFrom(cached, keyword, since);
    }
    await assertYoutubeQuota();
    const pending = searchInflight.get(normalized);
    if (pending) {
      const shared = await pending;
      if (searchCovers(shared, since)) {
        return this.draftsFrom(shared, keyword, since);
      }
    }
    let run!: Promise<CachedYoutubeSearch>;
    run = this.fetchSearch(youtube, keyword, since)
      .then(async ({ entry, store }) => {
        // A quota stop or a failed comment read is not cached, so the next
        // scan can try those calls again.
        if (store && !(await this.quotaBlocked())) {
          await writeYoutubeCache(cacheKey, entry);
        }
        return entry;
      })
      .finally(() => {
        if (searchInflight.get(normalized) === run) {
          searchInflight.delete(normalized);
        }
      });
    searchInflight.set(normalized, run);
    const entry = await run;
    return this.draftsFrom(entry, keyword, since);
  }

  private draftsFrom(entry: CachedYoutubeSearch, keyword: string, since: Date) {
    const drafts: StalkerMentionDraft[] = [];
    const seenComments = new Set<string>();
    const sinceMs = since.getTime();
    for (const video of entry.videos) {
      const published = Date.parse(video.publishedAt || '');
      if (Number.isFinite(published) && published < sinceMs) {
        continue;
      }
      const text = `${video.title || ''}\n${video.description || ''}`.trim();
      if (text) {
        drafts.push({
          externalId: `yt-video:${video.videoId}`,
          source: 'YOUTUBE_SEARCH',
          authorName: video.channelTitle || 'YouTube',
          authorHandle: video.channelTitle || '',
          text: text.slice(0, 2000),
          url: `https://www.youtube.com/watch?v=${video.videoId}`,
          postExternalId: video.videoId,
          keywordPhrase: keyword,
        });
      }
      for (const comment of video.comments) {
        if (!comment.id || !comment.text || seenComments.has(comment.id)) {
          continue;
        }
        seenComments.add(comment.id);
        drafts.push({
          externalId: `yt-comment:${comment.id}`,
          source: 'YOUTUBE_COMMENT',
          authorName: comment.author || 'Someone',
          authorHandle: comment.author || '',
          text: comment.text.slice(0, 2000),
          likeCount: comment.likeCount || 0,
          url: `https://www.youtube.com/watch?v=${video.videoId}&lc=${comment.id}`,
          postExternalId: video.videoId,
          keywordPhrase: keyword,
        });
      }
    }
    return drafts;
  }

  private async fetchSearch(
    youtube: { client: YoutubeClient; apiKey: string },
    keyword: string,
    since: Date
  ): Promise<{ entry: CachedYoutubeSearch; store: boolean }> {
    const key = youtube.apiKey ? { key: youtube.apiKey } : {};
    let search: {
      data: {
        items?: Array<{
          id?: { videoId?: string | null } | null;
          snippet?: {
            title?: string | null;
            description?: string | null;
            channelTitle?: string | null;
            publishedAt?: string | null;
          } | null;
        }> | null;
      };
    };
    try {
      search = (await youtube.client.search.list({
        ...key,
        part: ['snippet'],
        q: keyword,
        type: ['video'],
        maxResults: YOUTUBE_SEARCH_MAX,
        order: 'date',
        publishedAfter: since.toISOString(),
        safeSearch: 'moderate',
      })) as typeof search;
    } catch (err) {
      if (err instanceof Error && err.message === YOUTUBE_QUOTA_MESSAGE) {
        throw err;
      }
      if (isYoutubeQuotaError(err)) {
        await markYoutubeQuota();
        throw new Error(YOUTUBE_QUOTA_MESSAGE);
      }
      if (isProviderAuthFailure(err)) {
        console.error(
          youtube.apiKey
            ? 'Stalker YouTube search rejected YOUTUBE_STALKER_API_KEY'
            : 'Stalker YouTube search rejected the channel token'
        );
        throw new Error(
          youtube.apiKey ? 'API key was rejected' : 'Invalid credentials'
        );
      }
      throw err;
    }

    const videos: CachedYoutubeVideo[] = [];
    let store = true;
    for (const video of search.data.items || []) {
      const videoId = video.id?.videoId;
      if (!videoId) {
        continue;
      }
      const comments: CachedYoutubeComment[] = [];
      let quotaHit = false;
      try {
        const listed = await youtube.client.commentThreads.list({
          ...key,
          part: ['snippet'],
          videoId,
          searchTerms: keyword,
          maxResults: 5,
          textFormat: 'plainText',
        });
        for (const item of listed.data.items || []) {
          const top = item.snippet?.topLevelComment;
          const commentId = top?.id;
          const body = (
            top?.snippet?.textOriginal ||
            top?.snippet?.textDisplay ||
            ''
          ).trim();
          if (!commentId || !body) {
            continue;
          }
          comments.push({
            id: commentId,
            author: top?.snippet?.authorDisplayName || 'Someone',
            text: body,
            likeCount: Number(top?.snippet?.likeCount || 0),
          });
        }
      } catch (err) {
        if (isYoutubeQuotaError(err)) {
          await markYoutubeQuota();
          quotaHit = true;
          store = false;
        } else {
          store = false;
          console.error(
            'Stalker YouTube keyword comments failed',
            err instanceof Error ? err.message : 'comments failed'
          );
        }
      }
      videos.push({
        videoId,
        title: video.snippet?.title || '',
        description: video.snippet?.description || '',
        channelTitle: video.snippet?.channelTitle || '',
        publishedAt: video.snippet?.publishedAt || '',
        comments,
      });
      if (quotaHit) {
        break;
      }
    }
    return { entry: { publishedAfter: since.toISOString(), videos }, store };
  }

  private async quotaBlocked() {
    try {
      return !!(await ioRedis.get(YOUTUBE_QUOTA_KEY));
    } catch {
      return false;
    }
  }
}
