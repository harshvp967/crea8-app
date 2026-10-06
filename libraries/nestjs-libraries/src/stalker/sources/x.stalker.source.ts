import { StalkerMentionDraft } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import {
  StalkerSearchTerms,
  StalkerSourceProvider,
} from '@gitroom/nestjs-libraries/stalker/stalker.source';

// Official API v2 recent search. Off until X_STALKER_BEARER_TOKEN is set.
export class XStalkerSource implements StalkerSourceProvider {
  id = 'x' as const;
  label = 'X';
  filter = 'X';

  integrationIdentifier(): string | null {
    return null;
  }

  enabled() {
    return !!process.env.X_STALKER_BEARER_TOKEN;
  }

  statusDetail(available: boolean) {
    return available
      ? 'Official recent search'
      : 'Coming soon until an official X bearer token is set';
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
    const token = process.env.X_STALKER_BEARER_TOKEN;
    if (!token) {
      return [];
    }
    const oldest = Date.now() - 6 * 24 * 60 * 60 * 1000;
    const start = new Date(Math.max(since.getTime(), oldest));
    const params = new URLSearchParams({
      query:
        keyword.includes(' OR ') ||
        keyword.startsWith('"') ||
        keyword.startsWith('@')
          ? keyword
          : keyword.includes(' ')
            ? `"${keyword}"`
            : keyword,
      max_results: '10',
      start_time: start.toISOString(),
      'tweet.fields': 'created_at,author_id,public_metrics',
      expansions: 'author_id',
      'user.fields': 'name,username',
    });
    const response = await fetch(
      `https://api.x.com/2/tweets/search/recent?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (response.status === 429) {
      throw new Error('X rate limit');
    }
    if (!response.ok) {
      throw new Error(`X recent search failed (${response.status})`);
    }
    const json = (await response.json()) as {
      data?: {
        id: string;
        text?: string;
        author_id?: string;
        public_metrics?: { like_count?: number; reply_count?: number };
      }[];
      includes?: { users?: { id: string; name?: string; username?: string }[] };
    };
    const users = new Map(
      (json.includes?.users || []).map((user) => [user.id, user])
    );
    return (json.data || [])
      .filter((tweet) => (tweet.text || '').trim())
      .map((tweet) => {
        const user = tweet.author_id ? users.get(tweet.author_id) : undefined;
        return {
          externalId: `x-post:${tweet.id}`,
          source: 'X_POST' as const,
          authorName: user?.name || user?.username || 'Someone',
          authorHandle: user?.username || '',
          text: (tweet.text || '').slice(0, 2000),
          url: `https://x.com/i/web/status/${tweet.id}`,
          postExternalId: tweet.id,
          keywordPhrase: keyword,
          likeCount: tweet.public_metrics?.like_count || 0,
          replyCount: tweet.public_metrics?.reply_count || 0,
        };
      });
  }
}
