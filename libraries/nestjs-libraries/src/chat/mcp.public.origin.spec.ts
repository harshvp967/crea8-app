import {
  CREA8_MCP_HOST,
  mcpCorsOrigins,
  mcpCorsPath,
  mcpPublicOrigin,
} from './mcp.public.origin';

const withEnv = (values: Record<string, string | undefined>, run: () => void) => {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(values)) {
    previous[key] = process.env[key];
    if (values[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = values[key];
    }
  }
  try {
    run();
  } finally {
    for (const key of Object.keys(values)) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  }
};

describe('mcp public origin', () => {
  it('uses mcp.crea8.one when that host receives the request', () => {
    withEnv({ MCP_URL: undefined, NEXT_PUBLIC_BACKEND_URL: 'https://api.crea8.one' }, () => {
      expect(
        mcpPublicOrigin({
          headers: {
            host: CREA8_MCP_HOST,
            'x-forwarded-proto': 'https',
          },
        })
      ).toBe('https://mcp.crea8.one');
    });
  });

  it('keeps the API host when the request arrived there', () => {
    withEnv({ NEXT_PUBLIC_BACKEND_URL: 'https://api.crea8.one' }, () => {
      expect(
        mcpPublicOrigin({
          headers: {
            'x-forwarded-host': 'api.crea8.one',
            host: 'internal.railway.internal',
            'x-forwarded-proto': 'https',
          },
        })
      ).toBe('https://api.crea8.one');
    });
  });

  it('does not advertise an unknown proxy host as the issuer', () => {
    withEnv(
      { MCP_URL: 'https://mcp.crea8.one', NEXT_PUBLIC_BACKEND_URL: 'https://api.crea8.one' },
      () => {
        expect(
          mcpPublicOrigin({
            headers: { host: 'postiz-backend.up.railway.app', 'x-forwarded-proto': 'https' },
          })
        ).toBe('https://mcp.crea8.one');
      }
    );
  });

  it('accepts an extra host from MCP_HOSTS', () => {
    withEnv({ MCP_HOSTS: 'mcp.example.com', MCP_URL: undefined, NEXT_PUBLIC_BACKEND_URL: 'http://localhost:3000' }, () => {
      expect(
        mcpPublicOrigin({
          headers: { host: 'mcp.example.com', 'x-forwarded-proto': 'https' },
        })
      ).toBe('https://mcp.example.com');
      expect(mcpCorsOrigins()).toContain('https://mcp.example.com');
      expect(mcpCorsOrigins()).toContain('https://mcp.crea8.one');
    });
  });

  it('treats oauth and mcp paths as cross-origin', () => {
    expect(mcpCorsPath('/mcp')).toBe(true);
    expect(mcpCorsPath('/mcp/key')).toBe(true);
    expect(mcpCorsPath('/mcp-oauth-claude')).toBe(true);
    expect(mcpCorsPath('/oauth/token')).toBe(true);
    expect(mcpCorsPath('/oauth/authorize')).toBe(false);
    expect(mcpCorsPath('/posts')).toBe(false);
  });
});
