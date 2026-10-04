import { StalkerMentionDraft } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { StalkerSourceProvider } from '@gitroom/nestjs-libraries/stalker/stalker.source';

const USER_AGENT = 'web:crea8one-stalker:1.0 (by /u/crea8one)';
const MIN_GAP_MS = 1100;

let nextRequestAt = 0;

const pace = async () => {
  const wait = nextRequestAt - Date.now();
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  nextRequestAt = Date.now() + MIN_GAP_MS;
};

type RedditChild = {
  data?: {
    id?: string;
    title?: string;
    selftext?: string;
    body?: string;
    author?: string;
    permalink?: string;
    created_utc?: number;
    link_id?: string;
  };
};

export class RedditStalkerSource implements StalkerSourceProvider {
  id = 'reddit' as const;
  label = 'Reddit';
  filter = 'REDDIT';
  private token: { value: string; expiresAt: number } | null = null;

  integrationIdentifier() {
    return null;
  }

  enabled() {
    return !!(
      process.env.REDDIT_STALKER_CLIENT_ID &&
      process.env.REDDIT_STALKER_CLIENT_SECRET
    );
  }

  statusDetail(available: boolean) {
    return available
      ? 'App credentials set'
      : 'Add Reddit app credentials';
  }

  async search(keyword: string, since: Date): Promise<StalkerMentionDraft[]> {
    if (!this.enabled()) {
      return [];
    }
    const token = await this.appToken();
    const sinceSeconds = Math.floor(since.getTime() / 1000);
    const posts = await this.listing(token, keyword, 'link');
    const comments = await this.listing(token, keyword, 'comment');
    return [
      ...this.posts(posts, keyword, sinceSeconds),
      ...this.comments(comments, keyword, sinceSeconds),
    ];
  }

  private async appToken() {
    if (this.token && this.token.expiresAt > Date.now() + 30_000) {
      return this.token.value;
    }
    const id = process.env.REDDIT_STALKER_CLIENT_ID || '';
    const secret = process.env.REDDIT_STALKER_CLIENT_SECRET || '';
    await pace();
    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization:
          'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    });
    if (!response.ok) {
      throw new Error(`Reddit token request failed (${response.status})`);
    }
    const json = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!json.access_token) {
      throw new Error('Reddit token response had no access_token');
    }
    this.token = {
      value: json.access_token,
      expiresAt: Date.now() + (json.expires_in || 3600) * 1000,
    };
    return this.token.value;
  }

  private async listing(token: string, keyword: string, type: 'link' | 'comment') {
    const params = new URLSearchParams({
      q: keyword,
      sort: 'new',
      t: 'week',
      type,
      limit: '10',
      restrict_sr: 'false',
    });
    await pace();
    const response = await fetch(
      `https://oauth.reddit.com/search?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': USER_AGENT,
        },
      }
    );
    if (response.status === 429) {
      throw new Error('Reddit rate limit');
    }
    if (!response.ok) {
      throw new Error(`Reddit search failed (${response.status})`);
    }
    const json = (await response.json()) as {
      data?: { children?: RedditChild[] };
    };
    return json.data?.children || [];
  }

  private posts(children: RedditChild[], keyword: string, sinceSeconds: number) {
    const drafts: StalkerMentionDraft[] = [];
    for (const child of children) {
      const data = child.data;
      if (!data?.id || (data.created_utc || 0) < sinceSeconds) {
        continue;
      }
      const text = `${data.title || ''}\n${data.selftext || ''}`.trim();
      if (!text) {
        continue;
      }
      drafts.push({
        externalId: `rd-post:${data.id}`,
        source: 'REDDIT_POST',
        authorName: data.author || 'Someone',
        text: text.slice(0, 2000),
        url: data.permalink
          ? `https://www.reddit.com${data.permalink}`
          : undefined,
        postExternalId: data.id,
        keywordPhrase: keyword,
      });
    }
    return drafts;
  }

  private comments(
    children: RedditChild[],
    keyword: string,
    sinceSeconds: number
  ) {
    const drafts: StalkerMentionDraft[] = [];
    for (const child of children) {
      const data = child.data;
      const body = (data?.body || '').trim();
      if (!data?.id || !body || (data.created_utc || 0) < sinceSeconds) {
        continue;
      }
      drafts.push({
        externalId: `rd-comment:${data.id}`,
        source: 'REDDIT_COMMENT',
        authorName: data.author || 'Someone',
        text: body.slice(0, 2000),
        url: data.permalink
          ? `https://www.reddit.com${data.permalink}`
          : undefined,
        postExternalId: data.link_id,
        keywordPhrase: keyword,
      });
    }
    return drafts;
  }
}
