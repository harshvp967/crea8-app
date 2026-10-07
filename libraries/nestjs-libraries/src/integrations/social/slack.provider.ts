import {
  AuthTokenDetails,
  PostDetails,
  PostResponse,
  SocialProvider,
} from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { makeSecureId } from '@gitroom/nestjs-libraries/services/make.secure.id';
import {
  BadBody,
  readProviderError,
  RefreshToken,
  SocialAbstract,
  ValidityMedia,
} from '@gitroom/nestjs-libraries/integrations/social.abstract';
import dayjs from 'dayjs';
import { Integration } from '@prisma/client';
import { SlackDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/slack.dto';
import { Tool } from '@gitroom/nestjs-libraries/integrations/tool.decorator';

export class SlackProvider extends SocialAbstract implements SocialProvider {
  override maxConcurrentJob = 3; // Slack has moderate API limits
  identifier = 'slack';
  name = 'Slack';
  isBetweenSteps = false;
  editor = 'normal' as const;
  scopes = [
    'channels:read',
    'chat:write',
    'users:read',
    'groups:read',
    'channels:join',
    'chat:write.customize',
  ];
  // team:read lets authenticate() read the workspace's name, domain and icon.
  // It is requested on every connect but not required, so a workspace that
  // connected before it was added keeps working and can still reconnect.
  optionalScopes = ['team:read'];
  // Reconnecting refreshes the channel name, so connections made before the
  // workspace name was used pick it up without having to be deleted.
  syncNameOnReconnect = true;
  dto = SlackDto;

  // Media goes out as Block Kit image blocks, which Slack only accepts for
  // png / jpg / gif; an mp4 makes chat.postMessage reject the whole message.
  override async checkValidity(
    posts: Array<ValidityMedia[]>
  ): Promise<string | true> {
    const hasVideo = posts?.some((post) =>
      post?.some((item) => (item?.path?.indexOf?.('mp4') ?? -1) > -1)
    );
    if (hasVideo) {
      return 'No video support for Slack, only images';
    }
    return true;
  }

  maxLength() {
    return 400000;
  }

  async refreshToken(refreshToken: string): Promise<AuthTokenDetails> {
    return {
      refreshToken: '',
      expiresIn: 1000000,
      accessToken: '',
      id: '',
      name: '',
      picture: '',
      username: '',
    };
  }
  async generateAuthUrl() {
    const state = makeSecureId(6);

    return {
      url: `https://slack.com/oauth/v2/authorize?client_id=${
        process.env.SLACK_ID
      }&redirect_uri=${encodeURIComponent(
        `${
          process?.env?.FRONTEND_URL?.indexOf('https') === -1
            ? 'https://redirectmeto.com/'
            : ''
        }${process?.env?.FRONTEND_URL}/integrations/social/slack`
      )}&scope=${[...this.scopes, ...this.optionalScopes].join(
        ','
      )}&state=${state}`,
      codeVerifier: makeSecureId(10),
      state,
    };
  }

  async authenticate(params: {
    code: string;
    codeVerifier: string;
    refresh?: string;
  }) {
    const slackToken = await (
      await this.fetch(`https://slack.com/api/oauth.v2.access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: process.env.SLACK_ID!,
          client_secret: process.env.SLACK_SECRET!,
          code: params.code,
          redirect_uri: `${
            process?.env?.FRONTEND_URL?.indexOf('https') === -1
              ? 'https://redirectmeto.com/'
              : ''
          }${process?.env?.FRONTEND_URL}/integrations/social/slack${
            params.refresh ? `?refresh=${params.refresh}` : ''
          }`,
        }),
      })
    ).json();

    const { access_token, team, bot_user_id, scope } = slackToken;
    if (!access_token || typeof scope !== 'string') {
      throw new Error(
        readProviderError(slackToken) || 'Slack rejected this connection'
      );
    }

    this.checkScopes(this.scopes, scope.split(','));

    // Name the channel after the customer's workspace. The bot user is the
    // Crea8one app itself, so its name and picture were the same for every
    // workspace that connected.
    const teamInfo = await this.slackGet(access_token, 'team.info');
    const workspace = teamInfo?.ok ? teamInfo.team : undefined;

    let picture: string =
      workspace?.icon?.image_230 ||
      workspace?.icon?.image_132 ||
      workspace?.icon?.image_original ||
      '';
    if (!picture && bot_user_id) {
      // No team:read (or team.info failed): fall back to the bot's picture so
      // the channel still has an avatar.
      const botInfo = await this.slackGet(
        access_token,
        `users.info?user=${encodeURIComponent(bot_user_id)}`
      );
      picture = botInfo?.user?.profile?.image_original || '';
    }

    return {
      id: team.id,
      name: workspace?.name || team?.name || 'Slack',
      accessToken: access_token,
      refreshToken: 'null',
      expiresIn: dayjs().add(100, 'years').unix() - dayjs().unix(),
      picture,
      // The workspace domain (acme for acme.slack.com) tells two workspaces
      // with similar names apart.
      username: workspace?.domain || team?.name || '',
    };
  }

  private async slackGet(accessToken: string, path: string) {
    try {
      return await (
        await fetch(`https://slack.com/api/${path}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
      ).json();
    } catch {
      return undefined;
    }
  }

  @Tool({
    description: 'Get list of channels',
    dataSchema: [],
  })
  async channels(accessToken: string, params: any, id: string) {
    const list = await (
      await fetch(
        `https://slack.com/api/conversations.list?types=public_channel,private_channel`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )
    ).json();

    return list.channels.map((p: any) => ({
      id: p.id,
      name: p.name,
    }));
  }

  // Slack answers HTTP 200 with { ok: false, error } on failures, so the post
  // used to be marked completed with no message in the channel.
  private checkApiError(all: any) {
    if (all?.ok !== false) {
      return;
    }
    const json = JSON.stringify(all);
    const message =
      [all.error, ...(all.errors || [])].filter(Boolean).join(': ') ||
      'Slack rejected the request';
    if (
      [
        'invalid_auth',
        'token_revoked',
        'token_expired',
        'account_inactive',
      ].includes(all.error)
    ) {
      throw new RefreshToken(this.identifier, json, Buffer.from('{}'), message);
    }
    if (all.error === 'ratelimited') {
      throw new Error(message);
    }
    throw new BadBody(this.identifier, json, Buffer.from('{}'), message);
  }

  async post(
    id: string,
    accessToken: string,
    postDetails: PostDetails[],
    integration: Integration
  ): Promise<PostResponse[]> {
    const [firstPost] = postDetails;
    const channel = firstPost.settings.channel;

    // Join the channel first
    await fetch(`https://slack.com/api/conversations.join`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel,
      }),
    });

    // Post the main message. No username / icon_url: the channel's name and
    // picture are the customer's workspace, so messages go out under the app's
    // own bot identity (crea8.one and its icon) instead.
    const posted = await (
      await fetch(`https://slack.com/api/chat.postMessage`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: firstPost.message,
              },
            },
            ...(firstPost.media?.length
              ? firstPost.media.map((m) => ({
                  type: 'image',
                  image_url: m.path,
                  alt_text: '',
                }))
              : []),
          ],
        }),
      })
    ).json();
    this.checkApiError(posted);
    const { ts, channel: responseChannel } = posted;

    // Get permalink for the message
    const { permalink } = await (
      await fetch(
        `https://slack.com/api/chat.getPermalink?channel=${responseChannel}&message_ts=${ts}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )
    ).json();

    return [
      {
        id: firstPost.id,
        postId: ts,
        releaseURL: permalink || '',
        status: 'posted',
      },
    ];
  }

  async comment(
    id: string,
    postId: string,
    lastCommentId: string | undefined,
    accessToken: string,
    postDetails: PostDetails[],
    integration: Integration
  ): Promise<PostResponse[]> {
    const [commentPost] = postDetails;
    const channel = commentPost.settings.channel;
    const threadTs = lastCommentId || postId;

    // Post the threaded reply
    const posted = await (
      await fetch(`https://slack.com/api/chat.postMessage`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel,
          thread_ts: threadTs,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: commentPost.message,
              },
            },
            ...(commentPost.media?.length
              ? commentPost.media.map((m) => ({
                  type: 'image',
                  image_url: m.path,
                  alt_text: '',
                }))
              : []),
          ],
        }),
      })
    ).json();
    this.checkApiError(posted);
    const { ts, channel: responseChannel } = posted;

    // Get permalink for the comment
    const { permalink } = await (
      await fetch(
        `https://slack.com/api/chat.getPermalink?channel=${responseChannel}&message_ts=${ts}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )
    ).json();

    return [
      {
        id: commentPost.id,
        postId: ts,
        releaseURL: permalink || '',
        status: 'posted',
      },
    ];
  }
}
