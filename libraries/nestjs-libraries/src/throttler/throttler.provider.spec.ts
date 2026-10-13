import {
  authRateLimit,
  clientIp,
  consumeFixedWindow,
  isMcpTraffic,
  isPublicApiPath,
  LINK_PUBLIC_LIMITS,
  mcpRateLimit,
  publicApiRateLimit,
  rateLimitKey,
} from '@gitroom/nestjs-libraries/throttler/throttler.provider';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';

describe('rate limit rules', () => {
  const previous = {
    AUTH_RATE_LIMIT: process.env.AUTH_RATE_LIMIT,
    API_LIMIT: process.env.API_LIMIT,
    API_LIMIT_READ: process.env.API_LIMIT_READ,
    MCP_RATE_LIMIT: process.env.MCP_RATE_LIMIT,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('limits login-class routes to 5 per 15 minutes unless overridden', () => {
    delete process.env.AUTH_RATE_LIMIT;
    expect(authRateLimit()).toEqual({ limit: 5, ttl: 15 * 60 * 1000 });
    process.env.AUTH_RATE_LIMIT = '8';
    expect(authRateLimit().limit).toBe(8);
  });

  it('gives public writes a tighter budget than public reads', () => {
    delete process.env.API_LIMIT;
    delete process.env.API_LIMIT_READ;
    expect(publicApiRateLimit('POST')).toEqual({ bucket: 'write', limit: 90, ttl: 60 * 60 * 1000 });
    expect(publicApiRateLimit('GET').bucket).toBe('read');
    expect(publicApiRateLimit('GET').limit).toBeGreaterThan(publicApiRateLimit('POST').limit);
    expect(isPublicApiPath('/public/v1/posts')).toBe(true);
    expect(isPublicApiPath('/public/link/click')).toBe(false);
  });

  it('keeps lead capture stricter than link clicks', () => {
    expect(LINK_PUBLIC_LIMITS.contact.limit).toBeLessThan(LINK_PUBLIC_LIMITS.click.limit);
    expect(LINK_PUBLIC_LIMITS.subscribe.limit).toBeLessThan(LINK_PUBLIC_LIMITS.click.limit);
  });

  it('recognises MCP traffic and defaults to 120 per minute', () => {
    delete process.env.MCP_RATE_LIMIT;
    expect(mcpRateLimit().limit).toBe(120);
    expect(isMcpTraffic('/mcp')).toBe(true);
    expect(isMcpTraffic('/mcp/key')).toBe(true);
    expect(isMcpTraffic('/mcp-oauth-claude')).toBe(true);
    expect(isMcpTraffic('/sse/key')).toBe(true);
    expect(isMcpTraffic('/public/v1/posts')).toBe(false);
    expect(isMcpTraffic('/.well-known/oauth-protected-resource')).toBe(false);
  });

  it('reads the client from the first forwarded address', () => {
    expect(clientIp({ headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' }, ip: '10.0.0.8' })).toBe(
      '203.0.113.5'
    );
    expect(clientIp({ headers: {}, ip: '10.0.0.8' })).toBe('10.0.0.8');
  });

  it('blocks the next call after the window is full and sets a retry', async () => {
    const key = rateLimitKey('auth-ip', `spec-${Date.now()}`);
    await expect(consumeFixedWindow(key, 2, 60_000)).resolves.toEqual({ ok: true, retryAfter: 0 });
    await expect(consumeFixedWindow(key, 2, 60_000)).resolves.toEqual({ ok: true, retryAfter: 0 });
    const blocked = await consumeFixedWindow(key, 2, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    await ioRedis.del(`rl:${key}`);
  });

  it('does not share a counter between two identities', async () => {
    const left = rateLimitKey('public:write', 'org-a');
    const right = rateLimitKey('public:write', 'org-b');
    await consumeFixedWindow(left, 1, 60_000);
    await expect(consumeFixedWindow(right, 1, 60_000)).resolves.toEqual({ ok: true, retryAfter: 0 });
    await expect(consumeFixedWindow(left, 1, 60_000)).resolves.toMatchObject({ ok: false });
    await ioRedis.del(`rl:${left}`);
    await ioRedis.del(`rl:${right}`);
  });
});
