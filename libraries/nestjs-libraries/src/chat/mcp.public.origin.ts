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
