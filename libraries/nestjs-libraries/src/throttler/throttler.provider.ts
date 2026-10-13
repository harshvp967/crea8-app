import { ThrottlerGuard } from '@nestjs/throttler';
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { createHash } from 'crypto';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';

export function clientIp(req: { headers?: Record<string, any>; ip?: string }) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '');
  return forwarded.split(',')[0].trim() || req.ip || 'unknown';
}

export function rateLimitIdentity(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

export function rateLimitKey(scope: string, id: string) {
  return `${scope}:${rateLimitIdentity(id)}`;
}

const positive = (raw: string | undefined, fallback: number) => {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export function authRateLimit() {
  return {
    limit: positive(process.env.AUTH_RATE_LIMIT, 5),
    ttl: positive(process.env.AUTH_RATE_WINDOW_MS, 15 * 60 * 1000),
  };
}

export function mcpRateLimit() {
  return {
    limit: positive(process.env.MCP_RATE_LIMIT, 120),
    ttl: positive(process.env.MCP_RATE_WINDOW_MS, 60 * 1000),
  };
}

export function publicApiRateLimit(method: string) {
  const write = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
  return {
    bucket: write ? 'write' : 'read',
    limit: write
      ? positive(process.env.API_LIMIT, 90)
      : positive(process.env.API_LIMIT_READ, 600),
    ttl: 60 * 60 * 1000,
  };
}

export const LINK_PUBLIC_LIMITS = {
  click: { ttl: 60 * 60 * 1000, limit: 240 },
  view: { ttl: 60 * 60 * 1000, limit: 240 },
  subscribe: { ttl: 60 * 60 * 1000, limit: 30 },
  contact: { ttl: 60 * 60 * 1000, limit: 10 },
  unlock: { ttl: 60 * 60 * 1000, limit: 20 },
};

export function isPublicApiPath(url: string) {
  const path = (url || '').split('?')[0];
  return path === '/public/v1' || path.startsWith('/public/v1/');
}

export function isMcpTraffic(url: string) {
  const path = (url || '').split('?')[0];
  return (
    path === '/mcp' ||
    path.startsWith('/mcp/') ||
    path.startsWith('/mcp-oauth') ||
    path.startsWith('/sse/') ||
    path.startsWith('/message/')
  );
}

export async function consumeFixedWindow(
  key: string,
  limit: number,
  windowMs: number
) {
  const redisKey = `rl:${key}`;
  const count = await ioRedis.incr(redisKey);
  const ttl = await ioRedis.pttl(redisKey);
  if (count === 1 || ttl < 0) {
    await ioRedis.pexpire(redisKey, windowMs);
  }
  if (count > limit) {
    const remaining = await ioRedis.pttl(redisKey);
    return {
      ok: false as const,
      retryAfter: Math.max(1, Math.ceil((remaining > 0 ? remaining : windowMs) / 1000)),
    };
  }
  return { ok: true as const, retryAfter: 0 };
}

function tooMany(res: { setHeader: (name: string, value: string) => void }, retryAfter: number) {
  res.setHeader('Retry-After', String(retryAfter));
  throw new HttpException(
    { statusCode: 429, message: 'Too many requests', retryAfter },
    HttpStatus.TOO_MANY_REQUESTS
  );
}

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  public override async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const url = req.originalUrl || req.url || '';
    if (!isPublicApiPath(url) || req.method === 'OPTIONS') {
      return true;
    }
    const rule = publicApiRateLimit(req.method);
    const id = (req as Request & { org?: { id?: string } }).org?.id || clientIp(req);
    const result = await consumeFixedWindow(
      rateLimitKey(`public:${rule.bucket}`, id),
      rule.limit,
      rule.ttl
    );
    if (!result.ok) {
      tooMany(context.switchToHttp().getResponse(), result.retryAfter);
    }
    return true;
  }

  protected override async getTracker(req: Record<string, any>): Promise<string> {
    const id = req.org?.id || clientIp(req);
    return id + '_' + (String(req.url || '').indexOf('/posts') > -1 ? 'posts' : 'other');
  }
}

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const { limit, ttl } = authRateLimit();
    const keys = [rateLimitKey('auth-ip', clientIp(req))];
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    if (email) {
      keys.push(rateLimitKey('auth-email', email));
    }
    for (const key of keys) {
      const result = await consumeFixedWindow(key, limit, ttl);
      if (!result.ok) {
        tooMany(context.switchToHttp().getResponse(), result.retryAfter);
      }
    }
    return true;
  }
}

// route-level guard for public endpoints, keyed by the client address the
// proxy forwards rather than the org the global guard expects
@Injectable()
export class ThrottlerRealIpGuard extends ThrottlerGuard {
  protected override async getTracker(
    req: Record<string, any>
  ): Promise<string> {
    return clientIp(req);
  }
}
