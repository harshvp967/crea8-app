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

export class YoutubeStalkerSource implements StalkerSourceProvider {
  id = 'youtube' as const;
  label = 'YouTube';
  filter = 'YOUTUBE_SEARCH';

  integrationIdentifier() {
    return 'youtube';
  }

  enabled(auth?: StalkerSourceAuth) {
    return !!auth?.accessToken;
  }

  statusDetail(available: boolean) {
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
    if (!auth?.accessToken) {
      return [];
    }
    const youtube = youtubeClient(auth.accessToken);
    const drafts: StalkerMentionDraft[] = [];
    const seenComments = new Set<string>();
    const search = await youtube.search.list({
      part: ['snippet'],
      q: keyword,
      type: ['video'],
      maxResults: 5,
      order: 'date',
      publishedAfter: since.toISOString(),
      safeSearch: 'moderate',
    });

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
          text: text.slice(0, 2000),
          url: `https://www.youtube.com/watch?v=${videoId}`,
          postExternalId: videoId,
          keywordPhrase: keyword,
        });
      }

      try {
        const comments = await youtube.commentThreads.list({
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
            text: body.slice(0, 2000),
            likeCount: Number(top?.snippet?.likeCount || 0),
            url: `https://www.youtube.com/watch?v=${videoId}&lc=${commentId}`,
            postExternalId: videoId,
            keywordPhrase: keyword,
          });
        }
      } catch (err) {
        console.error('Stalker YouTube keyword comments failed', err);
      }
    }

    return drafts;
  }
}
