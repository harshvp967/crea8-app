import http from 'http';
import type { Server } from 'http';
import express from 'express';
import {
  handleMcpAuthorizationServerMetadata,
  handleMcpProtectedResourceMetadata,
} from './mcp.oauth.metadata';

const withEnv = async (
  values: Record<string, string | undefined>,
  run: () => Promise<void>
) => {
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
    await run();
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

const get = (port: number, path: string, host: string) =>
  new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = http.get(
      {
        hostname: '127.0.0.1',
        port,
        path,
        headers: {
          'x-forwarded-host': host,
          'x-forwarded-proto': 'https',
          connection: 'close',
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () =>
          resolve({
            status: res.statusCode || 0,
            body: Buffer.concat(chunks).toString('utf8'),
          })
        );
      }
    );
    req.on('error', reject);
  });

describe('MCP OAuth metadata routes', () => {
  let server: Server;
  let port = 0;

  beforeAll(async () => {
    const app = express();
    app.use('/.well-known/oauth-authorization-server', handleMcpAuthorizationServerMetadata);
    app.use('/.well-known/oauth-protected-resource', handleMcpProtectedResourceMetadata);
    server = await new Promise<Server>((resolve) => {
      const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    });
    const address = server.address();
    port = typeof address === 'object' && address ? address.port : 0;
  });

  afterAll(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      })
  );

  const metadataEnv: Record<string, string | undefined> = {
    FRONTEND_URL: 'https://app.crea8.one',
    NEXT_PUBLIC_BACKEND_URL: 'https://api.crea8.one',
    MCP_URL: undefined,
    OPENAI_OAUTH_CLIENT_ID: undefined,
  };

  it('serves Claude authorization-server metadata on both public hosts', async () => {
    await withEnv(metadataEnv, async () => {
      for (const host of ['mcp.crea8.one', 'api.crea8.one']) {
        const response = await get(
          port,
          '/.well-known/oauth-authorization-server/mcp-oauth-claude',
          host
        );
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({
          issuer: `https://${host}/mcp-oauth-claude`,
          authorization_endpoint: 'https://app.crea8.one/oauth/authorize',
          token_endpoint: `https://${host}/oauth/token`,
          registration_endpoint: `https://${host}/oauth/register`,
          response_types_supported: ['code'],
          grant_types_supported: ['authorization_code'],
          token_endpoint_auth_methods_supported: [
            'client_secret_basic',
            'client_secret_post',
            'none',
          ],
          code_challenge_methods_supported: ['S256'],
          scopes_supported: ['mcp:read', 'mcp:write'],
        });
      }
    });
  });

  it('serves Claude protected-resource metadata on both public hosts', async () => {
    await withEnv(metadataEnv, async () => {
      for (const host of ['mcp.crea8.one', 'api.crea8.one']) {
        const response = await get(
          port,
          '/.well-known/oauth-protected-resource/mcp-oauth-claude',
          host
        );
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body)).toEqual({
          resource: `https://${host}/mcp-oauth-claude`,
          authorization_servers: [`https://${host}/mcp-oauth-claude`],
          scopes_supported: ['mcp:read', 'mcp:write'],
          bearer_methods_supported: ['header'],
        });
      }
    });
  });

  it('keeps ChatGPT without registration and dynamic with registration', async () => {
    await withEnv(metadataEnv, async () => {
      const chatgpt = await get(
        port,
        '/.well-known/oauth-authorization-server/mcp-oauth-chatgpt',
        'mcp.crea8.one'
      );
      expect(chatgpt.status).toBe(200);
      const chatgptBody = JSON.parse(chatgpt.body);
      expect(chatgptBody.issuer).toBe('https://mcp.crea8.one/mcp-oauth-chatgpt');
      expect(chatgptBody.registration_endpoint).toBeUndefined();

      const dynamic = await get(
        port,
        '/.well-known/oauth-authorization-server/mcp-oauth-dynamic',
        'api.crea8.one'
      );
      expect(dynamic.status).toBe(200);
      const dynamicBody = JSON.parse(dynamic.body);
      expect(dynamicBody.issuer).toBe('https://api.crea8.one/mcp-oauth-dynamic');
      expect(dynamicBody.registration_endpoint).toBe('https://api.crea8.one/oauth/register');
      expect(dynamicBody.token_endpoint).toBe('https://api.crea8.one/oauth/token');
    });
  });

  it('leaves unknown metadata paths unanswered', async () => {
    await withEnv(metadataEnv, async () => {
      const authorization = await get(
        port,
        '/.well-known/oauth-authorization-server/mcp-oauth-missing',
        'mcp.crea8.one'
      );
      expect(authorization.status).toBe(404);
      const resource = await get(
        port,
        '/.well-known/oauth-protected-resource/not-a-resource',
        'mcp.crea8.one'
      );
      expect(resource.status).toBe(404);
    });
  });
});
