import { JsonWebTokenError, sign, TokenExpiredError, verify } from 'jsonwebtoken';

export const GTA6CLIPS_ISS = 'gta6clips.app';
export const GTA6CLIPS_AUD = 'crea8.one';
export const GTA6CLIPS_MAX_TTL_SEC = 600;

export type Gta6clipsPlanClaim = 'paid' | 'free';

export type Gta6clipsClaims = {
  sub: string;
  email: string;
  email_verified: true;
  jti: string;
  iat: number;
  exp: number;
  gta6clips_plan: Gta6clipsPlanClaim;
};

// Only the exact string "paid" is paid. Missing, "free", and every other value fail closed.
export function gta6clipsPlanClaim(value: unknown): Gta6clipsPlanClaim {
  return value === 'paid' ? 'paid' : 'free';
}

export function gta6clipsPlanRecord(plan: Gta6clipsPlanClaim, recordedAt: Date) {
  return {
    gta6clips_plan: plan,
    recordedAt: recordedAt.toISOString(),
  };
}

export function storedGta6clipsPlan(metadata: unknown): Gta6clipsPlanClaim {
  return explicitGta6clipsPlan(metadata) || 'free';
}

// Null when the exchange never recorded a claim. "free" is only an explicit downgrade.
export function explicitGta6clipsPlan(metadata: unknown): Gta6clipsPlanClaim | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }
  if (!Object.prototype.hasOwnProperty.call(metadata, 'gta6clips_plan')) {
    return null;
  }
  return gta6clipsPlanClaim((metadata as { gta6clips_plan?: unknown }).gta6clips_plan);
}

export type TokenFailure =
  | 'disabled'
  | 'invalid'
  | 'expired'
  | 'audience'
  | 'ttl'
  | 'replay';

export type TokenCheck =
  | { ok: true; claims: Gta6clipsClaims }
  | { ok: false; reason: TokenFailure };

export function gta6clipsSecret() {
  return (process.env.GTA6CLIPS_LINK_SECRET || '').trim();
}

export function verifyGta6clipsToken(
  token: string | undefined,
  secret: string | undefined,
  usedJti: ReadonlySet<string>,
  nowSec = Math.floor(Date.now() / 1000)
): TokenCheck {
  const key = (secret || '').trim();
  if (!key) {
    return { ok: false, reason: 'disabled' };
  }
  if (!token || !token.trim()) {
    return { ok: false, reason: 'invalid' };
  }

  let payload: Record<string, unknown>;
  try {
    const decoded = verify(token, key, {
      algorithms: ['HS256'],
      issuer: GTA6CLIPS_ISS,
      audience: GTA6CLIPS_AUD,
      clockTimestamp: nowSec,
    });
    if (!decoded || typeof decoded === 'string') {
      return { ok: false, reason: 'invalid' };
    }
    payload = decoded as Record<string, unknown>;
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      return { ok: false, reason: 'expired' };
    }
    const message = err instanceof JsonWebTokenError ? err.message : '';
    if (/audience/i.test(message)) {
      return { ok: false, reason: 'audience' };
    }
    return { ok: false, reason: 'invalid' };
  }

  const iat = Number(payload.iat);
  const exp = Number(payload.exp);
  const sub = typeof payload.sub === 'string' ? payload.sub.trim() : '';
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const jti = typeof payload.jti === 'string' ? payload.jti.trim() : '';
  if (!sub || !email || !email.includes('@') || !jti || !Number.isFinite(iat) || !Number.isFinite(exp)) {
    return { ok: false, reason: 'invalid' };
  }
  if (payload.email_verified !== true) {
    return { ok: false, reason: 'invalid' };
  }
  if (exp <= nowSec) {
    return { ok: false, reason: 'expired' };
  }
  if (exp > iat + GTA6CLIPS_MAX_TTL_SEC) {
    return { ok: false, reason: 'ttl' };
  }
  if (usedJti.has(jti)) {
    return { ok: false, reason: 'replay' };
  }

  return {
    ok: true,
    claims: {
      sub,
      email,
      email_verified: true,
      jti,
      iat,
      exp,
      gta6clips_plan: gta6clipsPlanClaim(payload.gta6clips_plan),
    },
  };
}

export function signGta6clipsToken(
  claims: Omit<Gta6clipsClaims, 'email_verified' | 'gta6clips_plan'> & {
    email_verified?: true;
    gta6clips_plan?: unknown;
  },
  secret: string
) {
  const payload: Record<string, unknown> = {
    sub: claims.sub,
    email: claims.email,
    email_verified: true,
    jti: claims.jti,
    iat: claims.iat,
    exp: claims.exp,
  };
  if (Object.prototype.hasOwnProperty.call(claims, 'gta6clips_plan')) {
    payload.gta6clips_plan = claims.gta6clips_plan;
  }
  return sign(
    payload,
    secret,
    {
      algorithm: 'HS256',
      issuer: GTA6CLIPS_ISS,
      audience: GTA6CLIPS_AUD,
    }
  );
}
