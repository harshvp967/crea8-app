import { EventEmitter } from 'events';
import {
  createOAuthMiddleware,
  resolveMcpOrganization,
} from '@gitroom/nestjs-libraries/chat/oauth-middleware';

class FakeResponse extends EventEmitter {
  statusCode = 0;
  headers: Record<string, string> = {};
  body = '';

  writeHead(status: number, headers: Record<string, string>) {
    this.statusCode = status;
    this.headers = headers;
    return this;
  }

  end(body?: string) {
    this.body = body || '';
    return this;
  }
}

describe('MCP auth', () => {
  const middleware = createOAuthMiddleware({
    oauth: {
      resource: 'https://mcp.crea8.one/mcp',
      authorizationServers: ['https://mcp.crea8.one/mcp-oauth-dynamic'],
      scopesSupported: ['mcp:read'],
      validateToken: async (token: string) => {
        if (token === 'pos_good') {
          return { valid: true, subject: 'org-1' };
        }
        return { valid: false, error: 'invalid_token', errorDescription: 'Invalid API Key or OAuth token' };
      },
    },
    mcpPath: '/mcp',
  });

  const call = async (method: string, path: string, authorization?: string) => {
    const req = { method, headers: authorization ? { authorization } : {} } as never;
    const res = new FakeResponse();
    const result = await middleware(req, res as never, new URL(path, 'https://mcp.crea8.one'));
    return { result, res };
  };

  it('rejects a missing bearer token on the MCP path', async () => {
    const { result, res } = await call('POST', '/mcp');
    expect(result).toEqual({ proceed: false, handled: true });
    expect(res.statusCode).toBe(401);
    expect(res.headers['WWW-Authenticate']).toContain('Bearer');
    expect(res.body).toContain('Bearer token required');
  });

  it('rejects an unknown token and lets a valid one through', async () => {
    const denied = await call('POST', '/mcp', 'Bearer nope');
    expect(denied.res.statusCode).toBe(401);
    expect(denied.result.proceed).toBe(false);
    const allowed = await call('POST', '/mcp', 'Bearer pos_good');
    expect(allowed.result.proceed).toBe(true);
    expect(allowed.result.tokenValidation).toEqual({ valid: true, subject: 'org-1' });
  });

  it('serves protected-resource metadata without a token', async () => {
    const { result, res } = await call('GET', '/.well-known/oauth-protected-resource');
    expect(result.handled).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('https://mcp.crea8.one/mcp');
  });

  it('resolves pos_ oauth tokens and plain API keys to an organization', async () => {
    const lookup = {
      getOrgByOAuthToken: jest.fn(async (token: string) =>
        token === 'pos_live' ? { organization: { id: 'org-oauth' } } : null
      ),
      getOrgByApiKey: jest.fn(async (token: string) => (token === 'api-key' ? { id: 'org-key' } : null)),
    };
    await expect(resolveMcpOrganization('', lookup)).resolves.toBeNull();
    await expect(resolveMcpOrganization('pos_live', lookup)).resolves.toEqual({ id: 'org-oauth' });
    await expect(resolveMcpOrganization('pos_missing', lookup)).resolves.toBeNull();
    await expect(resolveMcpOrganization('api-key', lookup)).resolves.toEqual({ id: 'org-key' });
    expect(lookup.getOrgByApiKey).not.toHaveBeenCalledWith('pos_live');
  });
});
