import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { OAuthRepository } from '@gitroom/nestjs-libraries/database/prisma/oauth/oauth.repository';
import { CreateOAuthAppDto } from '@gitroom/nestjs-libraries/dtos/oauth/create-oauth-app.dto';
import { UpdateOAuthAppDto } from '@gitroom/nestjs-libraries/dtos/oauth/update-oauth-app.dto';
import { RegisterClientDto } from '@gitroom/nestjs-libraries/dtos/oauth/register-client.dto';
import { makeSecureId } from '@gitroom/nestjs-libraries/services/make.secure.id';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { extractBearerToken } from '@gitroom/nestjs-libraries/chat/oauth-types';
import { createHash } from 'crypto';
import { OAuthApp } from '@prisma/client';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';

// Refresh tokens are not a column. They live in Redis, hashed, so this does
// not change the Prisma schema. 90 days, then the client signs in again.
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 90;

type RefreshRecord = {
  authorizationId: string;
  clientId: string;
  userId: string;
  organizationId: string;
};

const refreshTokenKey = (token: string) =>
  `oauth:rt:${createHash('sha256').update(token).digest('hex')}`;

const refreshCurrentKey = (authorizationId: string) =>
  `oauth:rt:current:${authorizationId}`;

const openAiOAuthClientId = () =>
  process.env.OPENAI_OAUTH_CLIENT_ID?.trim();

const enableOidcEmailClaims = () => Boolean(openAiOAuthClientId());

// Verified-domain match: exact host or a subdomain of it (spoof-safe, the
// leading dot means evilclaude.ai and claude.ai.evil.com are both rejected)
const isVerifiedHost = (host: string, verifiedDomains: string[]) =>
  verifiedDomains.some(
    (domain) => host === domain || host.endsWith('.' + domain)
  );

type EmailClaimsApp = Pick<OAuthApp, 'clientId' | 'dynamic' | 'redirectUris'>;

// Schemes a browser would execute instead of navigating away from the
// consent screen, so they can never be a redirect_uri
const browserSchemes = [
  'javascript:',
  'data:',
  'blob:',
  'file:',
  'vbscript:',
  'about:',
];

@Injectable()
export class OAuthService {
  constructor(private _oauthRepository: OAuthRepository) {}

  async getApp(orgId: string) {
    const app = await this._oauthRepository.getAppByOrgId(orgId);
    if (!app) return false;
    const { clientSecret, ...rest } = app;
    return rest;
  }

  async createApp(orgId: string, dto: CreateOAuthAppDto) {
    const existing = await this._oauthRepository.getAppByOrgId(orgId);
    if (existing) {
      throw new HttpException(
        'You can only have one OAuth application per organization',
        HttpStatus.BAD_REQUEST
      );
    }

    const clientId = 'pca_' + makeSecureId(32);
    const clientSecret = 'pcs_' + makeSecureId(48);
    const encryptedSecret = AuthService.fixedEncryption(clientSecret);

    const app = await this._oauthRepository.createApp(orgId, {
      name: dto.name,
      description: dto.description,
      pictureId: dto.pictureId,
      redirectUrl: dto.redirectUrl,
      clientId,
      clientSecret: encryptedSecret,
    });

    return { ...app, clientSecret };
  }

  async updateApp(orgId: string, dto: UpdateOAuthAppDto) {
    return this._oauthRepository.updateApp(orgId, {
      ...(dto.name && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.pictureId !== undefined && { pictureId: dto.pictureId }),
      ...(dto.redirectUrl && { redirectUrl: dto.redirectUrl }),
    });
  }

  async deleteApp(orgId: string) {
    const app = await this._oauthRepository.getAppByOrgId(orgId);
    if (!app) {
      throw new HttpException('No OAuth app found', HttpStatus.NOT_FOUND);
    }
    const authorizations = await this._oauthRepository.authorizationIdsForApp(app.id);
    await this._oauthRepository.revokeAllForApp(app.id);
    await this._oauthRepository.deleteApp(orgId);
    for (const authorization of authorizations) {
      await this.revokeRefreshToken(authorization.id);
    }
    return { success: true };
  }

  async rotateSecret(orgId: string) {
    const app = await this._oauthRepository.getAppByOrgId(orgId);
    if (!app) {
      throw new HttpException('No OAuth app found', HttpStatus.NOT_FOUND);
    }

    const newSecret = 'pcs_' + makeSecureId(48);
    const encrypted = AuthService.fixedEncryption(newSecret);
    await this._oauthRepository.updateClientSecret(orgId, encrypted);
    return { clientSecret: newSecret };
  }

  // Domains allowed to receive DCR redirect_uris, from the
  // DCR_VERIFIED_DOMAINS env (comma separated). An empty list
  // means open registration (self-hosted default)
  private verifiedDomainList() {
    return (process.env.DCR_VERIFIED_DOMAINS || '')
      .split(',')
      .map((domain) => domain.trim().toLowerCase())
      .filter(Boolean);
  }

  async registerDynamicClient(dto: RegisterClientDto) {
    const redirectUris = dto.redirect_uris.map((uri) => uri.trim());
    const verifiedDomains = this.verifiedDomainList();
    for (const uri of redirectUris) {
      let parsed: URL;
      try {
        parsed = new URL(uri);
      } catch {
        throw new HttpException(
          { error: 'invalid_redirect_uri', error_description: `Invalid redirect_uri: ${uri}` },
          HttpStatus.BAD_REQUEST
        );
      }

      // The consent screen navigates to the redirect_uri, so schemes the
      // browser would execute in our origin can never be a callback
      if (browserSchemes.includes(parsed.protocol)) {
        throw new HttpException(
          { error: 'invalid_redirect_uri', error_description: `redirect_uri scheme "${parsed.protocol}" is not allowed` },
          HttpStatus.BAD_REQUEST
        );
      }

      const isLoopback =
        parsed.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
      // Private-use schemes (RFC 8252 §7.1), e.g.
      // cursor://anysphere.cursor-mcp/oauth/callback
      const isPrivateScheme = !['http:', 'https:'].includes(parsed.protocol);
      if (parsed.protocol === 'http:' && !isLoopback) {
        throw new HttpException(
          { error: 'invalid_redirect_uri', error_description: 'redirect_uris must use https or a private-use scheme (http is allowed for loopback only)' },
          HttpStatus.BAD_REQUEST
        );
      }

      // Loopback and private-use callbacks never leave the user's machine
      // (native clients like Cursor, Grok and Claude Code), so only web
      // callbacks are held to the verified domain list
      if (isLoopback || isPrivateScheme || !verifiedDomains.length) {
        continue;
      }

      const host = parsed.hostname.toLowerCase();
      if (!isVerifiedHost(host, verifiedDomains)) {
        throw new HttpException(
          {
            error: 'invalid_redirect_uri',
            error_description: `redirect_uri host "${host}" is not a verified domain`,
          },
          HttpStatus.BAD_REQUEST
        );
      }
    }

    if (dto.grant_types?.length && !dto.grant_types.includes('authorization_code')) {
      throw new HttpException(
        { error: 'invalid_client_metadata', error_description: 'Only the authorization_code grant type is supported' },
        HttpStatus.BAD_REQUEST
      );
    }

    // Registration happens before consent, so abandoned flows leave orphan
    // clients behind; opportunistically prune the ones nobody ever authorized
    this._oauthRepository
      .deleteStaleDynamicApps(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      .catch(() => {});

    const isPublicClient = dto.token_endpoint_auth_method === 'none';
    // The token endpoint accepts the secret from either place; the stored
    // method only mirrors back what the client asked for
    const tokenEndpointAuthMethod = isPublicClient
      ? 'none'
      : dto.token_endpoint_auth_method === 'client_secret_basic'
      ? 'client_secret_basic'
      : 'client_secret_post';
    const clientId = 'pcd_' + makeSecureId(32);
    const clientSecret = isPublicClient ? undefined : 'pcs_' + makeSecureId(48);

    const app = await this._oauthRepository.createDynamicApp({
      name: dto.client_name?.trim().slice(0, 100) || 'MCP Client',
      redirectUrl: redirectUris[0],
      redirectUris: JSON.stringify(redirectUris),
      clientId,
      clientSecret: clientSecret && AuthService.fixedEncryption(clientSecret),
      tokenEndpointAuthMethod,
    });

    return {
      client_id: clientId,
      ...(clientSecret ? { client_secret: clientSecret, client_secret_expires_at: 0 } : {}),
      client_id_issued_at: Math.floor(app.createdAt.getTime() / 1000),
      client_name: app.name,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: tokenEndpointAuthMethod,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      scope: 'mcp:read mcp:write',
    };
  }

  // Email claims (openid/email scope + userinfo) go to the static ChatGPT app
  // and to dynamically registered clients whose web callbacks all live on a
  // verified domain (DCR_VERIFIED_DOMAINS). Everything else, including every
  // dynamic client on a self-hosted install with no verified domains, only
  // gets the mcp scopes
  private allowsEmailClaims(app: EmailClaimsApp) {
    if (!enableOidcEmailClaims()) {
      return false;
    }
    if (app.clientId === openAiOAuthClientId()) {
      return true;
    }
    if (!app.dynamic) {
      return false;
    }

    const verifiedDomains = this.verifiedDomainList();
    if (!verifiedDomains.length) {
      return false;
    }

    const webHosts: string[] = [];
    for (const uri of JSON.parse(app.redirectUris || '[]') as string[]) {
      try {
        const parsed = new URL(uri);
        if (parsed.protocol === 'https:') {
          webHosts.push(parsed.hostname.toLowerCase());
        }
      } catch {
        return false;
      }
    }

    return (
      webHosts.length > 0 &&
      webHosts.every((host) => isVerifiedHost(host, verifiedDomains))
    );
  }

  private grantedScope(app: EmailClaimsApp) {
    return [
      ...(this.allowsEmailClaims(app) ? ['openid', 'email'] : []),
      'mcp:read',
      'mcp:write',
    ].join(' ');
  }

  async validateAuthorizationRequest(
    clientId: string,
    options?: {
      redirectUri?: string;
      codeChallenge?: string;
      codeChallengeMethod?: string;
    }
  ) {
    const app = await this._oauthRepository.getAppByClientId(clientId);
    if (!app) {
      throw new HttpException('Invalid client_id', HttpStatus.BAD_REQUEST);
    }

    // Dynamically registered clients must use their registered redirect_uris
    // and PKCE; statically registered apps keep the existing lenient flow
    if (app.dynamic) {
      const registered: string[] = JSON.parse(app.redirectUris || '[]');
      if (!options?.redirectUri || !registered.includes(options.redirectUri)) {
        throw new HttpException('Invalid redirect_uri', HttpStatus.BAD_REQUEST);
      }
      if (app.tokenEndpointAuthMethod === 'none' && !options?.codeChallenge) {
        throw new HttpException(
          'code_challenge is required for this client',
          HttpStatus.BAD_REQUEST
        );
      }
      if (
        options?.codeChallenge &&
        options?.codeChallengeMethod &&
        options.codeChallengeMethod !== 'S256'
      ) {
        throw new HttpException(
          'Only the S256 code_challenge_method is supported',
          HttpStatus.BAD_REQUEST
        );
      }
    }

    return app;
  }

  async createAuthorizationCode(
    oauthAppId: string,
    userId: string,
    organizationId: string,
    pkce?: {
      codeChallenge?: string;
      codeChallengeMethod?: string;
      redirectUri?: string;
    }
  ) {
    const code = makeSecureId(32);
    const encryptedCode = AuthService.fixedEncryption(code);
    const codeExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const authorization = await this._oauthRepository.createAuthorization({
      oauthAppId,
      userId,
      organizationId,
      authorizationCode: encryptedCode,
      codeExpiresAt,
      codeChallenge: pkce?.codeChallenge,
      codeChallengeMethod: pkce?.codeChallengeMethod,
      redirectUri: pkce?.redirectUri,
    });
    await this.revokeRefreshToken(authorization.id);

    return code;
  }

  private assertClientAuthenticated(
    app: Pick<OAuthApp, 'dynamic' | 'tokenEndpointAuthMethod' | 'clientSecret'>,
    clientSecret?: string
  ) {
    const isPublicClient = app.dynamic && app.tokenEndpointAuthMethod === 'none';
    if (isPublicClient) {
      return;
    }
    if (
      !clientSecret ||
      !app.clientSecret ||
      app.clientSecret !== AuthService.fixedEncryption(clientSecret)
    ) {
      throw new HttpException(
        { error: 'invalid_client' },
        HttpStatus.UNAUTHORIZED
      );
    }
  }

  private async readRefreshToken(token: string): Promise<RefreshRecord | null> {
    const key = refreshTokenKey(token);
    const raw = await ioRedis.get(key);
    if (!raw) {
      return null;
    }
    let record: RefreshRecord;
    try {
      record = JSON.parse(raw) as RefreshRecord;
    } catch {
      return null;
    }
    if (!record?.authorizationId || !record.clientId || !record.userId || !record.organizationId) {
      return null;
    }
    const current = await ioRedis.get(refreshCurrentKey(record.authorizationId));
    if (current !== key) {
      return null;
    }
    return record;
  }

  private async issueRefreshToken(record: RefreshRecord) {
    const token = 'por_' + makeSecureId(40);
    const key = refreshTokenKey(token);
    const currentKey = refreshCurrentKey(record.authorizationId);
    const previousKey = await ioRedis.get(currentKey);
    await ioRedis.set(key, JSON.stringify(record));
    await ioRedis.expire(key, REFRESH_TTL_SECONDS);
    await ioRedis.set(currentKey, key);
    await ioRedis.expire(currentKey, REFRESH_TTL_SECONDS);
    if (previousKey && previousKey !== key) {
      await ioRedis.del(previousKey);
    }
    return token;
  }

  private async revokeRefreshToken(authorizationId: string) {
    const currentKey = refreshCurrentKey(authorizationId);
    const previousKey = await ioRedis.get(currentKey);
    if (previousKey) {
      await ioRedis.del(previousKey);
    }
    await ioRedis.del(currentKey);
  }

  async exchangeCodeForToken(
    code: string,
    clientId: string,
    clientSecret?: string,
    codeVerifier?: string,
    redirectUri?: string
  ) {
    const app = await this._oauthRepository.getAppByClientId(clientId);
    if (!app) {
      throw new HttpException(
        { error: 'invalid_client' },
        HttpStatus.UNAUTHORIZED
      );
    }

    // Public clients (dynamic registration with token_endpoint_auth_method=none)
    // authenticate with PKCE instead of a client secret. Confidential clients
    // still present client_secret the same way as before.
    this.assertClientAuthenticated(app, clientSecret);

    if (!code) {
      throw new HttpException(
        { error: 'invalid_grant' },
        HttpStatus.BAD_REQUEST
      );
    }

    const encryptedCode = AuthService.fixedEncryption(code);
    const auth = await this._oauthRepository.findByCode(encryptedCode);
    if (!auth || auth.oauthAppId !== app.id) {
      throw new HttpException(
        { error: 'invalid_grant' },
        HttpStatus.BAD_REQUEST
      );
    }

    if (!auth.codeExpiresAt || new Date() > auth.codeExpiresAt) {
      throw new HttpException(
        { error: 'invalid_grant', error_description: 'Code has expired' },
        HttpStatus.BAD_REQUEST
      );
    }

    if (auth.codeChallenge) {
      if (!codeVerifier) {
        throw new HttpException(
          { error: 'invalid_grant', error_description: 'code_verifier is required' },
          HttpStatus.BAD_REQUEST
        );
      }
      const hashed = createHash('sha256').update(codeVerifier).digest('base64url');
      if (hashed !== auth.codeChallenge) {
        throw new HttpException(
          { error: 'invalid_grant', error_description: 'Invalid code_verifier' },
          HttpStatus.BAD_REQUEST
        );
      }
    }

    if (auth.redirectUri && redirectUri !== auth.redirectUri) {
      throw new HttpException(
        { error: 'invalid_grant', error_description: 'redirect_uri does not match the authorization request' },
        HttpStatus.BAD_REQUEST
      );
    }

    const token = 'pos_' + makeSecureId(40);
    const encryptedToken = AuthService.fixedEncryption(token);
    // Read PKCE before the code row is cleared. The repository nulls the challenge.
    const usedPkce = Boolean(auth.codeChallenge);
    const authorizationId = auth.id;
    const userId = auth.userId;
    const {
      organizationId,
      organization: { paymentId },
    } = await this._oauthRepository.exchangeCodeForToken(
      authorizationId,
      encryptedToken
    );

    // Refresh tokens are only for authorization_code grants that used PKCE.
    // A grant without PKCE keeps the previous access-token response.
    const refreshToken = usedPkce
      ? await this.issueRefreshToken({
          authorizationId,
          clientId: app.clientId,
          userId,
          organizationId,
        })
      : undefined;

    return {
      id: organizationId,
      cus: paymentId,
      access_token: token,
      token_type: 'bearer',
      scope: this.grantedScope(app),
      ...(refreshToken ? { refresh_token: refreshToken } : {}),
    };
  }

  async refreshAccessToken(
    refreshToken: string | undefined,
    clientId: string,
    clientSecret?: string
  ) {
    if (!refreshToken) {
      throw new HttpException(
        { error: 'invalid_request', error_description: 'refresh_token is required' },
        HttpStatus.BAD_REQUEST
      );
    }

    const app = await this._oauthRepository.getAppByClientId(clientId);
    if (!app) {
      throw new HttpException(
        { error: 'invalid_client' },
        HttpStatus.UNAUTHORIZED
      );
    }
    this.assertClientAuthenticated(app, clientSecret);

    const record = await this.readRefreshToken(refreshToken);
    if (!record || record.clientId !== app.clientId) {
      throw new HttpException(
        { error: 'invalid_grant' },
        HttpStatus.BAD_REQUEST
      );
    }

    const auth = await this._oauthRepository.findActiveById(record.authorizationId);
    if (
      !auth ||
      auth.oauthAppId !== app.id ||
      auth.userId !== record.userId ||
      auth.organizationId !== record.organizationId
    ) {
      await this.revokeRefreshToken(record.authorizationId);
      throw new HttpException(
        { error: 'invalid_grant' },
        HttpStatus.BAD_REQUEST
      );
    }

    const token = 'pos_' + makeSecureId(40);
    const encryptedToken = AuthService.fixedEncryption(token);
    const updated = await this._oauthRepository.replaceAccessToken(
      auth.id,
      encryptedToken
    );
    const nextRefresh = await this.issueRefreshToken({
      authorizationId: auth.id,
      clientId: app.clientId,
      userId: auth.userId,
      organizationId: auth.organizationId,
    });

    return {
      id: updated.organizationId,
      cus: updated.organization.paymentId,
      access_token: token,
      token_type: 'bearer' as const,
      scope: this.grantedScope(app),
      refresh_token: nextRefresh,
    };
  }

  async getOrgByOAuthToken(token: string) {
    const encrypted = AuthService.fixedEncryption(token);
    return this._oauthRepository.findByAccessToken(encrypted);
  }

  async getUserInfo(authorization?: string) {
    if (!enableOidcEmailClaims()) {
      throw new HttpException(
        {
          error: 'not_found',
          error_description: 'OIDC email claims are not enabled',
        },
        HttpStatus.NOT_FOUND
      );
    }

    const token = extractBearerToken(authorization);
    if (!token) {
      throw new HttpException(
        { error: 'invalid_token', error_description: 'Bearer token required' },
        HttpStatus.UNAUTHORIZED
      );
    }

    const authorizationRecord = await this.getOrgByOAuthToken(token);
    if (!authorizationRecord) {
      throw new HttpException(
        { error: 'invalid_token', error_description: 'Token is invalid or revoked' },
        HttpStatus.UNAUTHORIZED
      );
    }

    if (!this.allowsEmailClaims(authorizationRecord.oauthApp)) {
      throw new HttpException(
        {
          error: 'insufficient_scope',
          error_description:
            'This OAuth client is not authorized to access email claims',
        },
        HttpStatus.FORBIDDEN
      );
    }

    const { user } = authorizationRecord;
    return {
      sub: user.id,
      email: user.email,
      email_verified: user.activated,
    };
  }

  async getApprovedApps(userId: string) {
    return this._oauthRepository.getApprovedApps(userId);
  }

  async revokeApp(userId: string, authId: string) {
    await this._oauthRepository.revokeAuthorization(userId, authId);
    await this.revokeRefreshToken(authId);
    return { success: true };
  }
}
