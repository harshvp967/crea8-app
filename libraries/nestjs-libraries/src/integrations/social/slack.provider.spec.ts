import { SlackProvider } from '@gitroom/nestjs-libraries/integrations/social/slack.provider';

const json = (body: unknown) =>
  ({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: new Headers(),
    clone() {
      return this;
    },
  } as any);

const oauth = (scope: string) => ({
  ok: true,
  access_token: 'xoxb-token',
  scope,
  bot_user_id: 'UBOT',
  team: { id: 'T123', name: 'Acme Inc' },
});

const ALL =
  'channels:read,chat:write,users:read,groups:read,channels:join,chat:write.customize';

describe('SlackProvider.authenticate', () => {
  const realFetch = global.fetch;
  let calls: string[];

  const mockSlack = (responses: Record<string, unknown>) => {
    calls = [];
    global.fetch = jest.fn(async (url: any) => {
      const method = String(url).split('/api/')[1].split('?')[0];
      calls.push(method);
      return json(responses[method] ?? { ok: false, error: 'unknown' });
    }) as any;
  };

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('names the channel after the workspace and uses its icon', async () => {
    mockSlack({
      'oauth.v2.access': oauth(`${ALL},team:read`),
      'team.info': {
        ok: true,
        team: {
          name: 'Acme Inc',
          domain: 'acme',
          icon: {
            image_132: 'https://x/132.png',
            image_230: 'https://x/230.png',
          },
        },
      },
    });

    const res = await new SlackProvider().authenticate({
      code: 'c',
      codeVerifier: 'v',
    });

    expect(res).toMatchObject({
      id: 'T123',
      name: 'Acme Inc',
      picture: 'https://x/230.png',
      username: 'acme',
    });
    expect(calls).not.toContain('users.info');
  });

  it('still connects without team:read, falling back to the bot picture', async () => {
    mockSlack({
      'oauth.v2.access': oauth(ALL),
      'team.info': { ok: false, error: 'missing_scope' },
      'users.info': {
        ok: true,
        user: {
          name: 'crea8one',
          profile: { image_original: 'https://x/bot.png' },
        },
      },
    });

    const res = await new SlackProvider().authenticate({
      code: 'c',
      codeVerifier: 'v',
    });

    expect(res).toMatchObject({
      id: 'T123',
      name: 'Acme Inc',
      picture: 'https://x/bot.png',
      username: 'Acme Inc',
    });
  });

  it('requests team:read in the auth URL', async () => {
    const { url } = await new SlackProvider().generateAuthUrl();
    expect(url).toContain('chat:write.customize,team:read');
  });
});
