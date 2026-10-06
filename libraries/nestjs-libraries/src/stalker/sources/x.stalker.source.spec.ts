import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';
import {
  resetXAppBearerCache,
  X_APP_BEARER_REDIS_KEY,
  X_AUTH_ERROR,
  X_DENIED_ERROR,
  X_DOWN_ERROR,
  X_KEYS_REJECTED,
  X_PLAN_ERROR,
  X_RATE_ERROR,
  XStalkerSource,
} from '@gitroom/nestjs-libraries/stalker/sources/x.stalker.source';

const KEY = 'consumer-key-value';
const SECRET = 'consumer-secret-value';
const APP_TOKEN = 'app-only-bearer-token';
const FRESH_TOKEN = 'refreshed-app-bearer';
const DEDICATED = 'dedicated-bearer-token';

const jsonResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});

const tweetBody = {
  data: [
    {
      id: '99',
      text: 'crea8one just shipped',
      author_id: '7',
      public_metrics: { like_count: 2, reply_count: 1 },
    },
  ],
  includes: { users: [{ id: '7', name: 'Ada', username: 'ada' }] },
};

const tokenOk = (accessToken = APP_TOKEN, expiresIn?: number) =>
  jsonResponse(200, {
    token_type: 'bearer',
    access_token: accessToken,
    ...(expiresIn ? { expires_in: expiresIn } : {}),
  });

const searchOk = () => jsonResponse(200, tweetBody);

describe('XStalkerSource', () => {
  const previous = {
    bearer: process.env.X_STALKER_BEARER_TOKEN,
    key: process.env.X_API_KEY,
    secret: process.env.X_API_SECRET,
  };
  const fetchMock = jest.fn();
  const logs: string[] = [];
  const spies: jest.SpyInstance[] = [];

  const restoreEnv = (name: 'X_STALKER_BEARER_TOKEN' | 'X_API_KEY' | 'X_API_SECRET', value: string | undefined) => {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  };

  beforeEach(async () => {
    delete process.env.X_STALKER_BEARER_TOKEN;
    delete process.env.X_API_KEY;
    delete process.env.X_API_SECRET;
    await resetXAppBearerCache();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    logs.length = 0;
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      spies.push(
        jest.spyOn(console, method).mockImplementation((...args: unknown[]) => {
          logs.push(args.map((item) => String(item)).join(' '));
        })
      );
    }
  });

  afterEach(() => {
    for (const spy of spies) {
      spy.mockRestore();
    }
    spies.length = 0;
  });

  afterAll(() => {
    restoreEnv('X_STALKER_BEARER_TOKEN', previous.bearer);
    restoreEnv('X_API_KEY', previous.key);
    restoreEnv('X_API_SECRET', previous.secret);
  });

  const source = () => new XStalkerSource();

  const assertSecretsStayOutOfLogs = () => {
    const blob = logs.join('\n');
    expect(blob).not.toContain(KEY);
    expect(blob).not.toContain(SECRET);
    expect(blob).not.toContain(APP_TOKEN);
    expect(blob).not.toContain(FRESH_TOKEN);
    expect(blob).not.toContain(DEDICATED);
  };

  const tokenCalls = () =>
    fetchMock.mock.calls.filter((call) => String(call[0]).includes('/oauth2/token'));

  const searchCalls = () =>
    fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('/2/tweets/search/recent')
    );

  it('stays off until a bearer or both app keys exist', () => {
    const x = source();
    expect(x.enabled()).toBe(false);
    expect(x.statusDetail(false)).toBe('Needs API access');
    process.env.X_API_KEY = KEY;
    expect(x.enabled()).toBe(false);
    process.env.X_API_SECRET = SECRET;
    expect(x.enabled()).toBe(true);
    expect(x.statusDetail(true)).toBe('Official recent search');
    delete process.env.X_API_KEY;
    delete process.env.X_API_SECRET;
    process.env.X_STALKER_BEARER_TOKEN = DEDICATED;
    expect(x.enabled()).toBe(true);
  });

  it('uses the dedicated bearer and does not call the token endpoint', async () => {
    process.env.X_STALKER_BEARER_TOKEN = DEDICATED;
    process.env.X_API_KEY = KEY;
    process.env.X_API_SECRET = SECRET;
    fetchMock.mockResolvedValueOnce(searchOk());

    const rows = await source().search('crea8one', new Date());

    expect(tokenCalls()).toHaveLength(0);
    expect(searchCalls()[0][1].headers.Authorization).toBe(`Bearer ${DEDICATED}`);
    expect(rows[0].externalId).toBe('x-post:99');
    expect(rows[0].authorHandle).toBe('ada');
    assertSecretsStayOutOfLogs();
  });

  it('exchanges the app key and secret for a bearer and caches it', async () => {
    process.env.X_API_KEY = KEY;
    process.env.X_API_SECRET = SECRET;
    fetchMock.mockResolvedValueOnce(tokenOk(APP_TOKEN, 3600));
    fetchMock.mockResolvedValueOnce(searchOk());
    fetchMock.mockResolvedValueOnce(searchOk());

    const x = source();
    await x.search('crea8one', new Date());
    await x.search('crea8one', new Date());

    expect(tokenCalls()).toHaveLength(1);
    const [, init] = tokenCalls()[0];
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(
      'Basic ' + Buffer.from(`${KEY}:${SECRET}`).toString('base64')
    );
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(String(init.body)).toBe('grant_type=client_credentials');
    expect(searchCalls()).toHaveLength(2);
    expect(searchCalls()[0][1].headers.Authorization).toBe(`Bearer ${APP_TOKEN}`);
    expect(searchCalls()[1][1].headers.Authorization).toBe(`Bearer ${APP_TOKEN}`);
    const cached = JSON.parse((await ioRedis.get(X_APP_BEARER_REDIS_KEY)) || '{}');
    expect(cached.token).toBe(APP_TOKEN);
    assertSecretsStayOutOfLogs();
  });

  it('reads a bearer that is already in Redis', async () => {
    process.env.X_API_KEY = KEY;
    process.env.X_API_SECRET = SECRET;
    await ioRedis.set(
      X_APP_BEARER_REDIS_KEY,
      JSON.stringify({ token: APP_TOKEN, expiresAt: Date.now() + 60_000 })
    );
    fetchMock.mockResolvedValueOnce(searchOk());

    await source().search('crea8one', new Date());

    expect(tokenCalls()).toHaveLength(0);
    expect(searchCalls()[0][1].headers.Authorization).toBe(`Bearer ${APP_TOKEN}`);
  });

  it('refreshes the app bearer once after a 401 and retries the search', async () => {
    process.env.X_API_KEY = KEY;
    process.env.X_API_SECRET = SECRET;
    fetchMock
      .mockResolvedValueOnce(tokenOk(APP_TOKEN))
      .mockResolvedValueOnce(jsonResponse(401, { title: 'Unauthorized', status: 401 }))
      .mockResolvedValueOnce(tokenOk(FRESH_TOKEN))
      .mockResolvedValueOnce(searchOk());

    const rows = await source().search('crea8one', new Date());

    expect(rows).toHaveLength(1);
    expect(tokenCalls()).toHaveLength(2);
    expect(searchCalls()[1][1].headers.Authorization).toBe(`Bearer ${FRESH_TOKEN}`);
    const cached = JSON.parse((await ioRedis.get(X_APP_BEARER_REDIS_KEY)) || '{}');
    expect(cached.token).toBe(FRESH_TOKEN);
    assertSecretsStayOutOfLogs();
  });

  it('maps client-not-enrolled and higher-access 403s to the plan message', async () => {
    process.env.X_API_KEY = KEY;
    process.env.X_API_SECRET = SECRET;
    fetchMock
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(
        jsonResponse(403, {
          title: 'Client Forbidden',
          type: 'https://api.x.com/2/problems/client-not-enrolled',
          detail: 'client-not-enrolled',
        })
      );

    await expect(source().search('crea8one', new Date())).rejects.toThrow(X_PLAN_ERROR);
    expect(tokenCalls()).toHaveLength(1);

    await resetXAppBearerCache();
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(
        jsonResponse(403, {
          detail: 'This app needs a higher X API access level',
          status: 403,
        })
      );

    await expect(source().search('crea8one', new Date())).rejects.toThrow(X_PLAN_ERROR);
    assertSecretsStayOutOfLogs();
  });

  it('maps a 401 plan error after one refresh, and a plain 401 to authentication failed', async () => {
    process.env.X_API_KEY = KEY;
    process.env.X_API_SECRET = SECRET;
    const enrolled = jsonResponse(401, {
      type: 'https://api.x.com/2/problems/client-not-enrolled',
      detail: 'client-not-enrolled',
    });
    fetchMock
      .mockResolvedValueOnce(tokenOk(APP_TOKEN))
      .mockResolvedValueOnce(enrolled)
      .mockResolvedValueOnce(tokenOk(FRESH_TOKEN))
      .mockResolvedValueOnce(enrolled);

    await expect(source().search('crea8one', new Date())).rejects.toThrow(X_PLAN_ERROR);

    await resetXAppBearerCache();
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(tokenOk(APP_TOKEN))
      .mockResolvedValueOnce(jsonResponse(401, { detail: 'Unauthorized' }))
      .mockResolvedValueOnce(tokenOk(FRESH_TOKEN))
      .mockResolvedValueOnce(jsonResponse(401, { detail: 'Unauthorized' }));

    await expect(source().search('crea8one', new Date())).rejects.toThrow(X_AUTH_ERROR);
    assertSecretsStayOutOfLogs();
  });

  it('maps rate limits, query errors, generic denials, and outages', async () => {
    process.env.X_API_KEY = KEY;
    process.env.X_API_SECRET = SECRET;
    const cases: [number, unknown, string][] = [
      [429, { detail: 'Rate limit exceeded' }, X_RATE_ERROR],
      [400, { detail: 'Invalid query' }, 'X: search query was rejected'],
      [403, { detail: 'Forbidden' }, X_DENIED_ERROR],
      [503, { detail: 'Service unavailable' }, X_DOWN_ERROR],
      [402, { title: 'CreditsDepleted', detail: 'does not have any credits' }, X_PLAN_ERROR],
    ];
    for (const [status, body, message] of cases) {
      await resetXAppBearerCache();
      fetchMock.mockReset();
      fetchMock.mockResolvedValueOnce(tokenOk()).mockResolvedValueOnce(jsonResponse(status, body));
      await expect(source().search('crea8one', new Date())).rejects.toThrow(message);
    }
    assertSecretsStayOutOfLogs();
  });

  it('does not refresh a dedicated bearer, and reports rejected app keys', async () => {
    process.env.X_STALKER_BEARER_TOKEN = DEDICATED;
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { type: 'https://api.x.com/2/problems/client-not-enrolled' })
    );
    await expect(source().search('crea8one', new Date())).rejects.toThrow(X_PLAN_ERROR);
    expect(tokenCalls()).toHaveLength(0);

    delete process.env.X_STALKER_BEARER_TOKEN;
    process.env.X_API_KEY = KEY;
    process.env.X_API_SECRET = SECRET;
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { detail: 'Unauthorized' }));
    const error = await source()
      .search('crea8one', new Date())
      .catch((err: Error) => err);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(X_KEYS_REJECTED);
    expect((error as Error).message).not.toContain(KEY);
    expect((error as Error).message).not.toContain(SECRET);
    assertSecretsStayOutOfLogs();
  });
});
