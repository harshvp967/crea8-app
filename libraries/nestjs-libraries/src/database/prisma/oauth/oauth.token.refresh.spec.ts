import { createHash } from 'crypto';
import { HttpException } from '@nestjs/common';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { OAuthController } from '@gitroom/backend/api/routes/oauth.controller';

const mockRedis = new Map<string, string>();

jest.mock('@gitroom/nestjs-libraries/redis/redis.service', () => ({
  ioRedis: {
    get: (key: string) => Promise.resolve(mockRedis.get(key) ?? null),
    set: (key: string, value: string) => {
      mockRedis.set(key, value);
      return Promise.resolve('OK');
    },
    del: (key: string) => {
      mockRedis.delete(key);
      return Promise.resolve(1);
    },
    expire: () => Promise.resolve(1),
  },
}));

import { OAuthService } from '@gitroom/nestjs-libraries/database/prisma/oauth/oauth.service';

const oauthError = async (run: () => Promise<unknown>) => {
  try {
    await run();
  } catch (err) {
    expect(err).toBeInstanceOf(HttpException);
    return err as HttpException;
  }
  throw new Error('expected an OAuth error');
};

describe('POST /oauth/token refresh_token', () => {
  const secret = 'test-oauth-refresh-secret';

  beforeAll(() => {
    process.env.JWT_SECRET = secret;
  });

  beforeEach(() => {
    mockRedis.clear();
  });

  const challengeFor = (verifier: string) =>
    createHash('sha256').update(verifier).digest('base64url');

  const memory = () => {
    const apps = new Map<string, any>();
    const auths = new Map<string, any>();
    const repository = {
      getAppByClientId: async (clientId: string) => {
        for (const app of apps.values()) {
          if (app.clientId === clientId && !app.deletedAt) {
            return app;
          }
        }
        return null;
      },
      findByCode: async (encryptedCode: string) => {
        for (const auth of auths.values()) {
          if (auth.authorizationCode === encryptedCode && !auth.revokedAt) {
            return auth;
          }
        }
        return null;
      },
      exchangeCodeForToken: async (id: string, encryptedToken: string) => {
        const auth = auths.get(id);
        auth.accessToken = encryptedToken;
        auth.authorizationCode = null;
        auth.codeExpiresAt = null;
        auth.codeChallenge = null;
        auth.codeChallengeMethod = null;
        auth.redirectUri = null;
        return {
          organizationId: auth.organizationId,
          organization: { paymentId: auth.organization.paymentId },
        };
      },
      findActiveById: async (id: string) => {
        const auth = auths.get(id);
        if (!auth || auth.revokedAt) {
          return null;
        }
        return {
          id: auth.id,
          oauthAppId: auth.oauthAppId,
          userId: auth.userId,
          organizationId: auth.organizationId,
        };
      },
      replaceAccessToken: async (id: string, encryptedToken: string) => {
        const auth = auths.get(id);
        auth.accessToken = encryptedToken;
        return {
          organizationId: auth.organizationId,
          organization: { paymentId: auth.organization.paymentId },
        };
      },
    };
    return { apps, auths, repository };
  };

  type AppRow = {
    id: string;
    clientId: string;
    clientSecret: string | null;
    dynamic: boolean;
    tokenEndpointAuthMethod: string | null;
    redirectUris: string | null;
    deletedAt: Date | null;
  };

  type AuthRow = {
    id: string;
    oauthAppId: string;
    userId: string;
    organizationId: string;
    authorizationCode: string | null;
    codeExpiresAt: Date | null;
    codeChallenge: string | null;
    codeChallengeMethod: string | null;
    redirectUri: string | null;
    accessToken: string | null;
    revokedAt: Date | null;
    organization: { paymentId: string };
  };

  const publicApp = (clientId: string, id = `app-${clientId}`): AppRow => ({
    id,
    clientId,
    clientSecret: null,
    dynamic: true,
    tokenEndpointAuthMethod: 'none',
    redirectUris: '[]',
    deletedAt: null,
  });

  const confidentialApp = (clientId: string, plainSecret: string, id = `app-${clientId}`): AppRow => ({
    id,
    clientId,
    clientSecret: AuthService.fixedEncryption(plainSecret),
    dynamic: false,
    tokenEndpointAuthMethod: 'client_secret_post',
    redirectUris: null,
    deletedAt: null,
  });

  const codeRow = (overrides: Partial<AuthRow>): AuthRow => ({
    id: 'auth-1',
    oauthAppId: 'app-public',
    userId: 'user-1',
    organizationId: 'org-1',
    authorizationCode: null,
    codeExpiresAt: new Date(Date.now() + 60_000),
    codeChallenge: null,
    codeChallengeMethod: null,
    redirectUri: null,
    accessToken: null,
    revokedAt: null,
    organization: { paymentId: 'cus_1' },
    ...overrides,
  });

  it('issues a refresh token for a PKCE authorization_code grant and not without PKCE', async () => {
    const store = memory();
    store.apps.set('public', publicApp('pcd_public', 'app-public'));
    store.apps.set('confidential', confidentialApp('pca_secret', 'pcs_secret', 'app-secret'));
    const verifier = 'pkce-verifier-pkce-verifier-pkce-verifier';
    store.auths.set(
      'auth-pkce',
      codeRow({
        id: 'auth-pkce',
        authorizationCode: AuthService.fixedEncryption('code-pkce'),
        codeChallenge: challengeFor(verifier),
        codeChallengeMethod: 'S256',
      })
    );
    store.auths.set(
      'auth-plain',
      codeRow({
        id: 'auth-plain',
        oauthAppId: 'app-secret',
        userId: 'user-2',
        organizationId: 'org-2',
        authorizationCode: AuthService.fixedEncryption('code-plain'),
        organization: { paymentId: 'cus_2' },
        accessToken: AuthService.fixedEncryption('pos_existing'),
      })
    );
    const kept = store.auths.get('auth-plain').accessToken;
    const service = new OAuthService(store.repository as any);

    const pkce = await service.exchangeCodeForToken(
      'code-pkce',
      'pcd_public',
      undefined,
      verifier
    );
    expect(pkce.access_token.startsWith('pos_')).toBe(true);
    expect(pkce.token_type).toBe('bearer');
    expect(pkce.refresh_token.startsWith('por_')).toBe(true);
    expect(store.auths.get('auth-pkce').accessToken).toBe(
      AuthService.fixedEncryption(pkce.access_token)
    );

    const plain = await service.exchangeCodeForToken(
      'code-plain',
      'pca_secret',
      'pcs_secret'
    );
    expect(plain.access_token.startsWith('pos_')).toBe(true);
    expect(plain).not.toHaveProperty('refresh_token');
    expect(store.auths.get('auth-plain').accessToken).not.toBe(kept);
    expect(store.auths.get('auth-plain').accessToken).toBe(
      AuthService.fixedEncryption(plain.access_token)
    );
  });

  it('rotates a refresh token for the same client and user and rejects reuse, a bad token, and a foreign client', async () => {
    const store = memory();
    store.apps.set('public', publicApp('pcd_owner', 'app-owner'));
    store.apps.set('other', publicApp('pcd_other', 'app-other'));
    const verifier = 'pkce-verifier-pkce-verifier-pkce-verifier';
    store.auths.set(
      'auth-1',
      codeRow({
        id: 'auth-1',
        oauthAppId: 'app-owner',
        authorizationCode: AuthService.fixedEncryption('code-1'),
        codeChallenge: challengeFor(verifier),
        codeChallengeMethod: 'S256',
      })
    );
    store.auths.set(
      'auth-other',
      codeRow({
        id: 'auth-other',
        oauthAppId: 'app-other',
        userId: 'user-9',
        organizationId: 'org-9',
        accessToken: AuthService.fixedEncryption('pos_untouched'),
        organization: { paymentId: 'cus_9' },
      })
    );
    const untouched = store.auths.get('auth-other').accessToken;
    const service = new OAuthService(store.repository as any);
    const issued = await service.exchangeCodeForToken(
      'code-1',
      'pcd_owner',
      undefined,
      verifier
    );

    const first = await service.refreshAccessToken(issued.refresh_token, 'pcd_owner');
    expect(first.access_token).not.toBe(issued.access_token);
    expect(first.refresh_token).not.toBe(issued.refresh_token);
    expect(first.id).toBe('org-1');
    expect(first.cus).toBe('cus_1');
    expect(store.auths.get('auth-1').userId).toBe('user-1');
    expect(store.auths.get('auth-1').accessToken).toBe(
      AuthService.fixedEncryption(first.access_token)
    );
    expect(store.auths.get('auth-other').accessToken).toBe(untouched);

    const reused = await oauthError(() =>
      service.refreshAccessToken(issued.refresh_token, 'pcd_owner')
    );
    expect(reused.getStatus()).toBe(400);
    expect(reused.getResponse()).toEqual({ error: 'invalid_grant' });

    const bad = await oauthError(() =>
      service.refreshAccessToken('por_not-a-real-token', 'pcd_owner')
    );
    expect(bad.getResponse()).toEqual({ error: 'invalid_grant' });

    const foreign = await oauthError(() =>
      service.refreshAccessToken(first.refresh_token, 'pcd_other')
    );
    expect(foreign.getResponse()).toEqual({ error: 'invalid_grant' });

    const sameClient = await service.refreshAccessToken(first.refresh_token, 'pcd_owner');
    expect(sameClient.access_token.startsWith('pos_')).toBe(true);
    expect(sameClient.refresh_token.startsWith('por_')).toBe(true);
    expect(store.auths.get('auth-1').userId).toBe('user-1');
    expect(store.auths.get('auth-1').oauthAppId).toBe('app-owner');
  });

  it('rejects a refresh token after the grant is revoked or the user no longer matches', async () => {
    const store = memory();
    store.apps.set('public', publicApp('pcd_owner', 'app-owner'));
    const verifier = 'pkce-verifier-pkce-verifier-pkce-verifier';
    const seed = (id: string, code: string) => {
      store.auths.set(
        id,
        codeRow({
          id,
          oauthAppId: 'app-owner',
          authorizationCode: AuthService.fixedEncryption(code),
          codeChallenge: challengeFor(verifier),
          codeChallengeMethod: 'S256',
        })
      );
    };
    seed('auth-revoked', 'code-revoked');
    seed('auth-user', 'code-user');
    const service = new OAuthService(store.repository as any);
    const revokedGrant = await service.exchangeCodeForToken(
      'code-revoked',
      'pcd_owner',
      undefined,
      verifier
    );
    const userGrant = await service.exchangeCodeForToken(
      'code-user',
      'pcd_owner',
      undefined,
      verifier
    );

    store.auths.get('auth-revoked').revokedAt = new Date();
    const revoked = await oauthError(() =>
      service.refreshAccessToken(revokedGrant.refresh_token, 'pcd_owner')
    );
    expect(revoked.getResponse()).toEqual({ error: 'invalid_grant' });

    store.auths.get('auth-user').userId = 'user-2';
    const foreignUser = await oauthError(() =>
      service.refreshAccessToken(userGrant.refresh_token, 'pcd_owner')
    );
    expect(foreignUser.getResponse()).toEqual({ error: 'invalid_grant' });
  });

  it('routes refresh_token, keeps authorization_code, and still rejects client_credentials', async () => {
    const service = {
      refreshAccessToken: jest.fn(async () => ({ access_token: 'pos_new', refresh_token: 'por_new' })),
      exchangeCodeForToken: jest.fn(async () => ({ access_token: 'pos_code' })),
    };
    const controller = new OAuthController(service as any);
    const basic = `Basic ${Buffer.from('pcd_basic:pcs_basic').toString('base64')}`;

    await expect(
      controller.token(
        { grant_type: 'refresh_token', refresh_token: 'por_1' },
        basic
      )
    ).resolves.toEqual({ access_token: 'pos_new', refresh_token: 'por_new' });
    expect(service.refreshAccessToken).toHaveBeenCalledWith('por_1', 'pcd_basic', 'pcs_basic');

    await controller.token({
      grant_type: 'authorization_code',
      code: 'code-1',
      client_id: 'pcd_body',
      client_secret: 'pcs_body',
      code_verifier: 'verifier',
      redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
    });
    expect(service.exchangeCodeForToken).toHaveBeenCalledWith(
      'code-1',
      'pcd_body',
      'pcs_body',
      'verifier',
      'https://claude.ai/api/mcp/auth_callback'
    );

    const rejected = await oauthError(() =>
      controller.token({
        grant_type: 'client_credentials',
        client_id: 'pcd_body',
        client_secret: 'pcs_body',
      })
    );
    expect(rejected.getStatus()).toBe(400);
    expect(rejected.getResponse()).toEqual({ error: 'unsupported_grant_type' });
    expect(service.exchangeCodeForToken).toHaveBeenCalledTimes(1);
  });
});
