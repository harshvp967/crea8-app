// Public host for the MCP server. mcp.crea8.one is a Railway custom domain
// on the same backend process as the API, so OAuth issuer and metadata must
// follow the host the client actually called.
export const CREA8_MCP_HOST = 'mcp.crea8.one';

type HeaderValue = string | string[] | undefined;

export type HeaderBag = {
  headers: Record<string, HeaderValue> | { [key: string]: HeaderValue };
};

const firstHeader = (value: HeaderValue) =>
  String(Array.isArray(value) ? value[0] : value || '')
    .split(',')[0]
    .trim()
    .toLowerCase();

const originOf = (value?: string) => {
  const raw = (value || '').trim();
  if (!raw) {
    return '';
  }
  try {
    return new URL(raw).origin;
  } catch {
    return '';
  }
};

const hostOf = (value?: string) => {
  const origin = originOf(value);
  if (origin) {
    return new URL(origin).host.toLowerCase();
  }
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0];
};

export const allowedMcpHosts = () => {
  const hosts = new Set<string>([CREA8_MCP_HOST]);
  const add = (value?: string) => {
    const host = hostOf(value);
    if (host) {
      hosts.add(host);
    }
  };
  add(process.env.MCP_URL);
  add(process.env.NEXT_PUBLIC_BACKEND_URL);
  add(process.env.NEXT_PUBLIC_OVERRIDE_BACKEND_URL);
  for (const item of (process.env.MCP_HOSTS || '').split(',')) {
    add(item);
  }
  return hosts;
};

export const mcpFallbackOrigin = () =>
  originOf(process.env.MCP_URL) ||
  originOf(process.env.NEXT_PUBLIC_OVERRIDE_BACKEND_URL) ||
  originOf(process.env.NEXT_PUBLIC_BACKEND_URL) ||
  '';

// Origins the Nest CORS allow-list should include in addition to the app.
export const mcpCorsOrigins = () => {
  const origins = new Set<string>([`https://${CREA8_MCP_HOST}`]);
  const add = (value?: string) => {
    const origin = originOf(
      value && !value.includes('://') ? `https://${value}` : value
    );
    if (origin) {
      origins.add(origin);
    }
  };
  add(process.env.MCP_URL);
  for (const item of (process.env.MCP_HOSTS || '').split(',')) {
    add(item.trim());
  }
  return [...origins];
};

export const mcpPublicOrigin = (req?: HeaderBag) => {
  if (req) {
    const host = firstHeader(req.headers['x-forwarded-host']) || firstHeader(req.headers.host);
    if (host && allowedMcpHosts().has(host)) {
      const proto = firstHeader(req.headers['x-forwarded-proto']);
      const scheme =
        proto === 'http' || proto === 'https'
          ? proto
          : host.startsWith('localhost') || host.startsWith('127.0.0.1')
            ? 'http'
            : 'https';
      return `${scheme}://${host}`;
    }
  }
  return mcpFallbackOrigin();
};

// Issuers advertised from the MCP host. /mcp-oauth-claude uses the dynamic
// issuer, so its authorization-server metadata is the dynamic document.
export const mcpAuthorizationServers: Record<
  string,
  { path: string; registration: boolean }
> = {
  '/mcp-oauth-chatgpt': {
    path: '/mcp-oauth-chatgpt',
    registration: false,
  },
  '/mcp-oauth-dynamic': {
    path: '/mcp-oauth-dynamic',
    registration: true,
  },
};

export const mcpOauthAuthorizationServer: Record<string, string> = {
  '/mcp-oauth-chatgpt': '/mcp-oauth-chatgpt',
  '/mcp-oauth': '/mcp-oauth-dynamic',
  '/mcp-oauth-claude': '/mcp-oauth-dynamic',
  '/mcp-oauth-dynamic': '/mcp-oauth-dynamic',
};

export const mcpGrantTypes = ['authorization_code', 'refresh_token'] as const;

export const mcpAuthorizationServerMetadata = (
  origin: string,
  server: { path: string; registration: boolean },
  options: { frontendUrl?: string; scopes: string[]; userinfo?: boolean }
) => ({
  // RFC 8414: metadata served at /.well-known/oauth-authorization-server/<path>
  // belongs to the path-based issuer <origin>/<path>
  issuer: new URL(server.path, origin).toString(),
  authorization_endpoint: `${options.frontendUrl}/oauth/authorize`,
  token_endpoint: `${origin}/oauth/token`,
  ...(server.registration && {
    registration_endpoint: `${origin}/oauth/register`,
  }),
  ...(options.userinfo && {
    userinfo_endpoint: `${origin}/oauth/userinfo`,
  }),
  response_types_supported: ['code'],
  grant_types_supported: [...mcpGrantTypes],
  token_endpoint_auth_methods_supported: [
    'client_secret_basic',
    'client_secret_post',
    'none',
  ],
  code_challenge_methods_supported: ['S256'],
  scopes_supported: options.scopes,
});

export const mcpCorsPath = (path: string) => {
  const value = (path || '/').split('?')[0];
  return (
    value === '/mcp' ||
    value.startsWith('/mcp/') ||
    value.startsWith('/mcp-oauth') ||
    value.startsWith('/sse/') ||
    value.startsWith('/message/') ||
    value.startsWith('/.well-known/oauth-protected-resource') ||
    value.startsWith('/.well-known/oauth-authorization-server') ||
    value.startsWith('/.well-known/openid-configuration') ||
    value === '/oauth/token' ||
    value === '/oauth/register' ||
    value === '/oauth/userinfo'
  );
};
