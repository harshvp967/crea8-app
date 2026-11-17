import { signGta6clipsToken, verifyGta6clipsToken } from '@gitroom/nestjs-libraries/partner/gta6clips.token';

const SECRET = 'test-link-secret';
const NOW = 1_700_000_000;

function token(overrides: Record<string, unknown> = {}, secret = SECRET) {
  return signGta6clipsToken(
    {
      sub: 'member-1',
      email: 'ada@gta6clips.app',
      jti: 'jti-1',
      iat: NOW,
      exp: NOW + 600,
      ...overrides,
    } as never,
    secret
  );
}

describe('gta6clips token', () => {
  it('accepts a good token', () => {
    const checked = verifyGta6clipsToken(token(), SECRET, new Set(), NOW + 10);
    expect(checked.ok).toBe(true);
    if (checked.ok) {
      expect(checked.claims.sub).toBe('member-1');
      expect(checked.claims.email).toBe('ada@gta6clips.app');
      expect(checked.claims.gta6clips_plan).toBe('free');
    }
  });

  it('keeps paid only when gta6clips_plan is exactly paid', () => {
    const paid = verifyGta6clipsToken(token({ gta6clips_plan: 'paid' }), SECRET, new Set(), NOW + 10);
    const free = verifyGta6clipsToken(token({ gta6clips_plan: 'free' }), SECRET, new Set(), NOW + 10);
    const other = verifyGta6clipsToken(token({ gta6clips_plan: 'pro' }), SECRET, new Set(), NOW + 10);
    const flag = verifyGta6clipsToken(token({ gta6clips_plan: true }), SECRET, new Set(), NOW + 10);
    expect(paid.ok && paid.claims.gta6clips_plan).toBe('paid');
    expect(free.ok && free.claims.gta6clips_plan).toBe('free');
    expect(other.ok && other.claims.gta6clips_plan).toBe('free');
    expect(flag.ok && flag.claims.gta6clips_plan).toBe('free');
  });

  it('does not read a paid or plan claim', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(
      JSON.stringify({
        sub: 'member-1',
        email: 'ada@gta6clips.app',
        email_verified: true,
        jti: 'jti-paid-flag',
        iat: NOW,
        exp: NOW + 60,
        iss: 'gta6clips.app',
        aud: 'crea8.one',
        paid: true,
        plan: 'gold',
      })
    ).toString('base64url');
    const { createHmac } = require('crypto') as typeof import('crypto');
    const sig = createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
    const checked = verifyGta6clipsToken(`${header}.${body}.${sig}`, SECRET, new Set(), NOW + 10);
    expect(checked.ok).toBe(true);
    if (checked.ok) {
      expect(checked.claims.gta6clips_plan).toBe('free');
      expect(checked.claims).not.toHaveProperty('paid');
      expect(checked.claims).not.toHaveProperty('plan');
    }
  });

  it('rejects a bad signature', () => {
    expect(verifyGta6clipsToken(token(), 'other-secret', new Set(), NOW + 10)).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('rejects the wrong audience', () => {
    const wrong = signGta6clipsToken(
      { sub: 'member-1', email: 'ada@gta6clips.app', jti: 'jti-1', iat: NOW, exp: NOW + 60 },
      SECRET
    ).split('.');
    const header = wrong[0];
    const body = Buffer.from(
      JSON.stringify({
        sub: 'member-1',
        email: 'ada@gta6clips.app',
        email_verified: true,
        jti: 'jti-2',
        iat: NOW,
        exp: NOW + 60,
        iss: 'gta6clips.app',
        aud: 'somewhere.else',
      })
    ).toString('base64url');
    const { createHmac } = require('crypto') as typeof import('crypto');
    const sig = createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
    expect(verifyGta6clipsToken(`${header}.${body}.${sig}`, SECRET, new Set(), NOW + 10).ok).toBe(false);
    expect(verifyGta6clipsToken(`${header}.${body}.${sig}`, SECRET, new Set(), NOW + 10)).toMatchObject({
      reason: 'audience',
    });
  });

  it('rejects an expired token', () => {
    expect(verifyGta6clipsToken(token({ exp: NOW + 30 }), SECRET, new Set(), NOW + 31)).toMatchObject({
      ok: false,
      reason: 'expired',
    });
  });

  it('rejects exp beyond iat+600', () => {
    expect(verifyGta6clipsToken(token({ exp: NOW + 601 }), SECRET, new Set(), NOW + 10)).toMatchObject({
      ok: false,
      reason: 'ttl',
    });
  });

  it('rejects a replayed jti', () => {
    expect(verifyGta6clipsToken(token(), SECRET, new Set(['jti-1']), NOW + 10)).toMatchObject({
      ok: false,
      reason: 'replay',
    });
  });

  it('disables the perk when the secret is missing', () => {
    expect(verifyGta6clipsToken(token(), '', new Set(), NOW + 10)).toEqual({
      ok: false,
      reason: 'disabled',
    });
    expect(verifyGta6clipsToken(undefined, undefined, new Set(), NOW + 10)).toEqual({
      ok: false,
      reason: 'disabled',
    });
  });
});
