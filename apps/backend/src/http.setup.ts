import compression from 'compression';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { csrfGuard } from '@gitroom/nestjs-libraries/security/csrf';
import { apiCorsOptions } from '@gitroom/nestjs-libraries/security/cors';

// Global HTTP layers, in order. Call after startMcp (the MCP layer answers its
// own wildcard CORS) and before app.listen().
//
// CORS goes first, ahead of helmet and csrfGuard. Passing it through
// NestFactory options instead mounts it only at listen(), after every app.use()
// layer, so a request rejected early (the CSRF 403 on POST /copilot/*) left
// without Access-Control-Allow-Origin and the browser showed a CORS error.
export function configureHttp(app: INestApplication, extraCorsOrigins: string[] = []) {
  app.enableCors(apiCorsOptions(extraCorsOrigins));

  const server = app.getHttpAdapter().getInstance();
  server.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts: {
        maxAge: 63072000,
        includeSubDomains: true,
      },
      frameguard: { action: 'sameorigin' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      noSniff: true,
    })
  );
  app.use((_req: unknown, res: { setHeader: (name: string, value: string) => void }, next: () => void) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(self)'
    );
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    })
  );

  app.use(['/copilot/{*splat}', '/posts'], (req: any, res: any, next: any) => {
    json({ limit: '50mb' })(req, res, next);
  });

  app.use(cookieParser());
  app.use(csrfGuard);
  app.use(compression());
}
