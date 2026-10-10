import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library/build/src/auth/oauth2client';
import { StalkerMentionDraft } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
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
    const drafts: StalkerMentionDraft[] = [];
    const seenComments = new Set<string>();
    const key = youtube.apiKey ? { key: youtube.apiKey } : {};
    let search: { data: { items?: Array<{ id?: { videoId?: string | null } | null; snippet?: { title?: string | null; description?: string | null; channelTitle?: string | null } | null }> | null } };
    try {
      search = (await youtube.client.search.list({
        ...key,
        part: ['snippet'],
        q: keyword,
        type: ['video'],
        maxResults: 5,
        order: 'date',
        publishedAfter: since.toISOString(),
        safeSearch: 'moderate',
      })) as typeof search;
    } catch (err) {
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

    for (const video of search.data.items || []) {
      const videoId = video.id?.videoId;
      if (!videoId) {
        continue;
      }
      const text = `${video.snippet?.title || ''}\n${
        video.snippet?.description || ''
      }`.trim();
      if (text) {
        drafts.push({
          externalId: `yt-video:${videoId}`,
          source: 'YOUTUBE_SEARCH',
          authorName: video.snippet?.channelTitle || 'YouTube',
          authorHandle: video.snippet?.channelTitle || '',
          text: text.slice(0, 2000),
          url: `https://www.youtube.com/watch?v=${videoId}`,
          postExternalId: videoId,
          keywordPhrase: keyword,
        });
      }

      try {
        const comments = await youtube.client.commentThreads.list({
          ...key,
          part: ['snippet'],
          videoId,
          searchTerms: keyword,
          maxResults: 5,
          textFormat: 'plainText',
        });
        for (const item of comments.data.items || []) {
          const top = item.snippet?.topLevelComment;
          const commentId = top?.id;
          const body = (
            top?.snippet?.textOriginal ||
            top?.snippet?.textDisplay ||
            ''
          ).trim();
          if (!commentId || !body || seenComments.has(commentId)) {
            continue;
          }
          seenComments.add(commentId);
          drafts.push({
            externalId: `yt-comment:${commentId}`,
            source: 'YOUTUBE_COMMENT',
            authorName: top?.snippet?.authorDisplayName || 'Someone',
            authorHandle: top?.snippet?.authorDisplayName || '',
            text: body.slice(0, 2000),
            likeCount: Number(top?.snippet?.likeCount || 0),
            url: `https://www.youtube.com/watch?v=${videoId}&lc=${commentId}`,
            postExternalId: videoId,
            keywordPhrase: keyword,
          });
        }
      } catch (err) {
        console.error(
          'Stalker YouTube keyword comments failed',
          err instanceof Error ? err.message : 'comments failed'
        );
      }
    }

    return drafts;
  }
}
