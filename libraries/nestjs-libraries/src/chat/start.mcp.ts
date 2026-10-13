import { INestApplication } from '@nestjs/common';
import { Request, Response } from 'express';
import { MastraService } from '@gitroom/nestjs-libraries/chat/mastra.service';
import { LoadToolsService } from '@gitroom/nestjs-libraries/chat/load.tools.service';
import { MCPServer } from '@mastra/mcp';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { OAuthService } from '@gitroom/nestjs-libraries/database/prisma/oauth/oauth.service';
import { runWithContext } from './async.storage';
import { createOAuthMiddleware, resolveMcpOrganization } from './oauth-middleware';
import { UPLOAD_WIDGET_URI, uploadWidgetHtml } from '@gitroom/nestjs-libraries/chat/ui/upload.widget';
import { CLIPPING_WIDGET_URI, clippingWidgetHtml } from '@gitroom/nestjs-libraries/chat/ui/clipping.widget';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
import { mcpCorsPath, mcpPublicOrigin } from '@gitroom/nestjs-libraries/chat/mcp.public.origin';
import {
  handleMcpAuthorizationServerMetadata,
  handleMcpProtectedResourceMetadata,
  mcpAuthorizationServerMetadata,
  mcpAuthorizationServers,
  mcpOauthScopes,
  mcpOidcEmailClaimsEnabled,
  mcpProtectedResourceServers,
} from '@gitroom/nestjs-libraries/chat/mcp.oauth.metadata';
import {
  clientIp,
  consumeFixedWindow,
  isMcpTraffic,
  mcpRateLimit,
  rateLimitKey,
} from '@gitroom/nestjs-libraries/throttler/throttler.provider';
const fixAcceptHeader = (req: Request) => {
  const value = 'application/json, text/event-stream';
  req.headers.accept = value;
  const idx = req.rawHeaders.findIndex((h) => h.toLowerCase() === 'accept');
  if (idx !== -1) {
    req.rawHeaders[idx + 1] = value;
  } else {
    req.rawHeaders.push('Accept', value);
  }
};

export const startMcp = async (app: INestApplication) => {
  const http = app.getHttpAdapter().getInstance() as any;
  http.use((req: Request, res: Response, next: () => void) => {
    if (!mcpCorsPath(req.path || '/')) {
      next();
      return;
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Authorization, Content-Type, Accept, mcp-protocol-version, mcp-session-id, last-event-id'
    );
    res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id, WWW-Authenticate');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });
  // Express 5 keeps user middleware on app.router. Move this layer in front of
  // Nest's CORS so MCP preflights are not ended before these headers are set.
  const router = http.router || http._router;
  const stack = router?.stack;
  if (stack?.length) {
    stack.unshift(stack.pop());
  }

  http.use(async (req: Request, res: Response, next: () => void) => {
    if (req.method === 'OPTIONS' || !isMcpTraffic(req.originalUrl || req.url || '')) {
      next();
      return;
    }
    const token = String(req.headers.authorization || '')
      .replace(/^Bearer\s+/i, '')
      .trim();
    const { limit, ttl } = mcpRateLimit();
    const result = await consumeFixedWindow(
      rateLimitKey('mcp', token || clientIp(req)),
      limit,
      ttl
    );
    if (!result.ok) {
      res.setHeader('Retry-After', String(result.retryAfter));
      res.status(429).json({
        statusCode: 429,
        message: 'Too many requests',
        retryAfter: result.retryAfter,
      });
      return;
    }
    next();
  });

  const mastraService = app.get(MastraService, { strict: false });
  const organizationService = app.get(OrganizationService, { strict: false });
  const oauthService = app.get(OAuthService, { strict: false });
  const loadToolsService = app.get(LoadToolsService, { strict: false });

  const resolveAuth = (token: string) =>
    resolveMcpOrganization(token, {
      getOrgByOAuthToken: (value) => oauthService.getOrgByOAuthToken(value),
      getOrgByApiKey: (value) => organizationService.getOrgByApiKey(value),
    });

  const mastra = await mastraService.mastra();
  const agent = mastra.getAgent('postiz');
  const tools = {
    ...(await agent.listTools()),
    // tools that only make sense inside an MCP host (ui:// widgets)
    ...(await loadToolsService.loadTools(true)),
  };

  // The Claude connector directory does not accept AI media generation tools,
  // so the directory-facing endpoint hides them. Direct connections
  // (/mcp, /mcp/:id, /sse/:id) and the ChatGPT app keep the full toolset.
  const claudeHiddenTools = [
    'generateImageTool',
    'generateVideoTool',
    'videoStatusTool',
    'generateVideoOptions',
    'videoFunctionTool',
    // clipping renders new videos (AI picked cuts, burned-in captions)
    'clippingTool',
    'clippingStatusTool',
    'clippingWidgetTicketTool',
  ];
  const claudeTools = Object.fromEntries(
    Object.entries(tools).filter(([name]) => !claudeHiddenTools.includes(name))
  ) as typeof tools;

  const backendUrl = process.env.NEXT_PUBLIC_OVERRIDE_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
  // this runs before the backend listens: a bucket url that doesn't parse only
  // costs the widget its thumbnails, never the boot
  let storageOrigin: string | undefined;
  try {
    storageOrigin = new URL(UploadFactory.createStorage().publicUrl!('')).origin;
  } catch (err) {}

  // MCP Apps widgets (ui:// resources). They run in the host's sandboxed iframe,
  // which can only reach the domains listed in the csp
  const appResources = {
    [UPLOAD_WIDGET_URI]: {
      name: 'Upload Media',
      description: 'Upload an image or video from the device to the media library',
      html: uploadWidgetHtml(backendUrl!),
      meta: {
        csp: { connectDomains: [new URL(backendUrl!).origin] },
        // the "Copy link" button of the uploaded media
        permissions: { clipboardWrite: {} },
        prefersBorder: true,
      },
    },
    ...(UploadFactory.clippingEnabled()
      ? {
          [CLIPPING_WIDGET_URI]: {
            name: 'Video Clipping',
            description: 'Progress of a video clipping and the clips it made',
            html: clippingWidgetHtml(backendUrl!),
            meta: {
              csp: {
                connectDomains: [new URL(backendUrl!).origin],
                // the thumbnails of the clips live wherever the storage serves files
                ...(storageOrigin ? { resourceDomains: [storageOrigin] } : {}),
              },
              // the "Copy link" button of a clip
              permissions: { clipboardWrite: {} },
              prefersBorder: true,
            },
          },
        }
      : {}),
  };

  const serverConfig = {
    name: 'Crea8one MCP',
    version: '1.0.0',
    tools,
    agents: { postiz: agent },
    appResources,
  };

  const server = new MCPServer(serverConfig);

  // The directory-facing servers don't register the agent - it would be
  // exposed as an annotation-less catch-all ask_postiz tool, which the
  // ChatGPT and Claude directory reviews reject
  const oauthServer = new MCPServer({
    name: 'Crea8one MCP',
    version: '1.0.0',
    tools,
    appResources,
  });

  // a widget of a hidden tool is hidden with it
  const { [CLIPPING_WIDGET_URI]: hiddenWidget, ...claudeAppResources } = appResources as Record<string, (typeof appResources)[typeof UPLOAD_WIDGET_URI]>;

  const claudeOauthServer = new MCPServer({
    name: 'Crea8one MCP',
    version: '1.0.0',
    tools: claudeTools,
    appResources: claudeAppResources,
  });

  // Every OAuth-protected MCP path is its own RFC 9728 protected resource.
  // The token endpoint ignores the RFC 8707 resource param, so the path-based
  // issuers in mcp.oauth.metadata cover all of them.
  const createResourceMiddleware = (mcpPath: string, authorizationServer: string, origin: string) =>
    createOAuthMiddleware({
      oauth: {
        resource: new URL(mcpPath, origin).toString(),
        authorizationServers: [new URL(authorizationServer, origin).toString()],
        scopesSupported: mcpOauthScopes(),
        validateToken: async (token: string) => {
          const org = await resolveAuth(token);
          if (!org) {
            return { valid: false, error: 'invalid_token', errorDescription: 'Invalid API Key or OAuth token' };
          }
          return { valid: true, subject: token };
        },
      },
      mcpPath,
    });

  const oauthResources: Record<string, { authorizationServer: string; mcpServer: MCPServer }> = {
    // ChatGPT app submission (pre-defined client credentials, no DCR)
    '/mcp-oauth-chatgpt': {
      authorizationServer: mcpProtectedResourceServers['/mcp-oauth-chatgpt'],
      mcpServer: oauthServer,
    },
    // Former ChatGPT path, kept for connectors that were created against it
    '/mcp-oauth': {
      authorizationServer: mcpProtectedResourceServers['/mcp-oauth'],
      mcpServer: oauthServer,
    },
    // Claude connector directory submission (DCR, media-generation tools hidden)
    '/mcp-oauth-claude': {
      authorizationServer: mcpProtectedResourceServers['/mcp-oauth-claude'],
      mcpServer: claudeOauthServer,
    },
    // Clients that register themselves through DCR (/oauth/register) - not
    // directory-reviewed, so they get the full toolset (media generation included)
    '/mcp-oauth-dynamic': {
      authorizationServer: mcpProtectedResourceServers['/mcp-oauth-dynamic'],
      mcpServer: oauthServer,
    },
  };

  if (process.env.OPENAI_APP_CHALLANGE) {
    app.use('/.well-known/openai-apps-challenge', (req: Request, res: Response) => {
      res.setHeader('Content-Type', 'text/plain');
      res.send(process.env.OPENAI_APP_CHALLANGE);
    });
  }

  // Only the paths in mcpProtectedResourceServers are OAuth-protected.
  // Answering discovery on any other path (including the root, which clients
  // fall back to) makes them demand OAuth for /mcp/:id too.
  app.use('/.well-known/oauth-protected-resource', handleMcpProtectedResourceMetadata);
  app.use('/.well-known/oauth-authorization-server', handleMcpAuthorizationServerMetadata);

  app.use('/.well-known/openid-configuration', async (req: Request, res: Response, next: () => void) => {
    const server = mcpAuthorizationServers[req.path];
    if (!server || !mcpOidcEmailClaimsEnabled()) {
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
    res.json({
      ...mcpAuthorizationServerMetadata(mcpPublicOrigin(req), server),
      subject_types_supported: ['public'],
      claims_supported: ['sub', 'email', 'email_verified'],
    });
  });

  app.use(Object.keys(oauthResources), async (req: Request, res: Response, next: () => void) => {
    // Skip if this is the /mcp/:id route
    if (req.path !== '/' && req.path !== '') {
      next();
      return;
    }

    // baseUrl is the mount path that matched, e.g. /mcp-oauth-claude
    const { authorizationServer, mcpServer } = oauthResources[req.baseUrl];
    const origin = mcpPublicOrigin(req);
    const url = new URL(req.baseUrl, origin);

    const result = await createResourceMiddleware(req.baseUrl, authorizationServer, origin)(req, res, url);
    if (!result.proceed) return;

    const token = result.tokenValidation?.subject;
    const auth = await resolveAuth(token!);
    if (!auth) {
      res.status(401).json({ error: 'invalid_token', error_description: 'Could not resolve organization' });
      return;
    }

    fixAcceptHeader(req);
    await runWithContext({ requestId: token!, auth }, async () => {
      await mcpServer.startHTTP({
        url: url,
        httpPath: url.pathname,
        options: {
          serverless: true,
          enableJsonResponse: true,
        },
        req,
        res,
      });
    });
  });

  app.use('/mcp', async (req: Request, res: Response, next: () => void) => {
    // Skip if this is the /mcp/:id route
    if (req.path !== '/' && req.path !== '') {
      next();
      return;
    }

    // @ts-ignore
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Expose-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      res.status(401).send('Missing Authorization header');
      return;
    }

    // @ts-ignore
    req.auth = await resolveAuth(token);
    // @ts-ignore
    if (!req.auth) {
      res.status(401).send('Invalid API Key or OAuth token');
      return;
    }

    const url = new URL('/mcp', mcpPublicOrigin(req));

    fixAcceptHeader(req);
    // @ts-ignore
    await runWithContext({ requestId: token, auth: req.auth }, async () => {
      await server.startHTTP({
        url,
        httpPath: url.pathname,
        options: {
          serverless: true,
          enableJsonResponse: true,
        },
        req,
        res,
      });
    });
  });

  app.use('/mcp/:id', async (req: Request, res: Response) => {
    // @ts-ignore
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Expose-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }

    // @ts-ignore
    req.auth = await organizationService.getOrgByApiKey(req.params.id);
    // @ts-ignore
    if (!req.auth) {
      res.status(400).send('Invalid API Key');
      return;
    }

    const url = new URL(`/mcp/${req.params.id}`, mcpPublicOrigin(req));

    fixAcceptHeader(req);
    await runWithContext(
      // @ts-ignore
      { requestId: req.params.id, auth: req.auth },
      async () => {
        await server.startHTTP({
          url,
          httpPath: url.pathname,
          options: {
            serverless: true,
            enableJsonResponse: true,
          },
          req,
          res,
        });
      }
    );
  });

  app.use(['/sse/:id', '/message/:id'], async (req: Request, res: Response) => {
    // @ts-ignore
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Expose-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }

    // @ts-ignore
    req.auth = await organizationService.getOrgByApiKey(req.params.id);
    // @ts-ignore
    if (!req.auth) {
      res.status(400).send('Invalid API Key');
      return;
    }

    const url = new URL(req.originalUrl, mcpPublicOrigin(req));

    await runWithContext(
      // @ts-ignore
      { requestId: req.params.id, auth: req.auth },
      async () => {
        await new MCPServer(serverConfig).startSSE({
          url,
          ssePath: `/sse/${req.params.id}`,
          messagePath: `/message/${req.params.id}`,
          req,
          res,
        });
      }
    );
  });
};
