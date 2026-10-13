import type { NextFunction, Request, Response } from 'express';
import { createOAuthMiddleware } from './oauth-middleware';
import { mcpPublicOrigin } from './mcp.public.origin';

export type McpAuthorizationServer = {
  path: string;
  registration: boolean;
};

// Path-based issuers. The origin is the host that received the request
// (mcp.crea8.one or the API host), not a single env URL baked in at boot.
// RFC 8414: metadata at /.well-known/oauth-authorization-server/<path>
// belongs to the issuer <origin>/<path>.
export const mcpAuthorizationServers: Record<string, McpAuthorizationServer> = {
  // ChatGPT app submission. No registration_endpoint, so the builder uses
  // the pre-defined client instead of dynamic client registration.
  '/mcp-oauth-chatgpt': {
    path: '/mcp-oauth-chatgpt',
    registration: false,
  },
  // DCR for Cursor and every other self-registering client.
  '/mcp-oauth-dynamic': {
    path: '/mcp-oauth-dynamic',
    registration: true,
  },
  // Claude directory URL is /mcp-oauth-claude. Clients insert that path into
  // the authorization-server well-known URL, so this issuer has to answer.
  // Same token, register, and authorize endpoints as the dynamic issuer.
  '/mcp-oauth-claude': {
    path: '/mcp-oauth-claude',
    registration: true,
  },
};

// RFC 9728 protected resource path -> authorization server path.
// /mcp-oauth is the former ChatGPT path and still uses the dynamic issuer.
export const mcpProtectedResourceServers: Record<string, string> = {
  '/mcp-oauth-chatgpt': '/mcp-oauth-chatgpt',
  '/mcp-oauth': '/mcp-oauth-dynamic',
  '/mcp-oauth-claude': '/mcp-oauth-claude',
  '/mcp-oauth-dynamic': '/mcp-oauth-dynamic',
};

export const mcpOidcEmailClaimsEnabled = () =>
  Boolean(process.env.OPENAI_OAUTH_CLIENT_ID?.trim());

export const mcpOauthScopes = () => [
  ...(mcpOidcEmailClaimsEnabled() ? ['openid', 'email'] : []),
  'mcp:read',
  'mcp:write',
];

export const mcpAuthorizationServerMetadata = (
  origin: string,
  server: McpAuthorizationServer
) => ({
  issuer: new URL(server.path, origin).toString(),
  authorization_endpoint: `${process.env.FRONTEND_URL}/oauth/authorize`,
  token_endpoint: `${origin}/oauth/token`,
  ...(server.registration && {
    registration_endpoint: `${origin}/oauth/register`,
  }),
  ...(mcpOidcEmailClaimsEnabled() && {
    userinfo_endpoint: `${origin}/oauth/userinfo`,
  }),
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code'],
  token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
  code_challenge_methods_supported: ['S256'],
  scopes_supported: mcpOauthScopes(),
});

// req.path is the mount-relative path Express leaves after
// app.use('/.well-known/oauth-authorization-server', ...).
export const handleMcpAuthorizationServerMetadata = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const server = mcpAuthorizationServers[req.path];
  if (!server) {
    next();
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.writeHead(204);
    res.end();
    return;
  }
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'max-age=3600');
  res.json(mcpAuthorizationServerMetadata(mcpPublicOrigin(req), server));
};

export const handleMcpProtectedResourceMetadata = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authorizationServer = mcpProtectedResourceServers[req.path];
  if (!authorizationServer) {
    next();
    return;
  }

  const origin = mcpPublicOrigin(req);
  const url = new URL('/.well-known/oauth-protected-resource', origin);
  await createOAuthMiddleware({
    oauth: {
      resource: new URL(req.path, origin).toString(),
      authorizationServers: [new URL(authorizationServer, origin).toString()],
      scopesSupported: mcpOauthScopes(),
    },
    mcpPath: req.path,
  })(req, res, url);
};
