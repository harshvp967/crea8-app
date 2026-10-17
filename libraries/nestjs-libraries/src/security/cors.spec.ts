import { Controller, INestApplication, Module, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { configureHttp } from '@gitroom/backend/http.setup';
import { createCsrfToken } from '@gitroom/nestjs-libraries/security/csrf';

// Regression: the Agent chat (POST /copilot/*) was rejected by csrfGuard before
// Nest's CORS layer ran, so the 403 had no Access-Control-Allow-Origin and the
// browser reported a CORS error instead of a readable response.

const FRONTEND = 'https://app.example.com';

@Controller('/copilot')
class StubCopilotController {
  @Post('/chat')
  chat() {
    return { ok: true };
  }
}

@Module({ controllers: [StubCopilotController] })
class StubModule {}

describe('API CORS on /copilot', () => {
  let app: INestApplication;
  let base: string;
  const previous = {
    FRONTEND_URL: process.env.FRONTEND_URL,
    MAIN_URL: process.env.MAIN_URL,
    EXTRA_CORS_ORIGINS: process.env.EXTRA_CORS_ORIGINS,
    NOT_SECURED: process.env.NOT_SECURED,
  };

  beforeAll(async () => {
    process.env.FRONTEND_URL = FRONTEND;
    delete process.env.MAIN_URL;
    delete process.env.EXTRA_CORS_ORIGINS;
    delete process.env.NOT_SECURED;
    app = await NestFactory.create(StubModule, { logger: false });
    configureHttp(app);
    await app.listen(0, '127.0.0.1');
    base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    await app?.close();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('answers the preflight for the frontend origin with credentials', async () => {
    const res = await fetch(`${base}/copilot/chat`, {
      method: 'OPTIONS',
      headers: {
        Origin: FRONTEND,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-csrf-token',
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe(FRONTEND);
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
    expect(res.headers.get('access-control-allow-headers')).toContain('x-csrf-token');
  });

  it('does not allow an unknown origin, and never a wildcard', async () => {
    const res = await fetch(`${base}/copilot/chat`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://evil.example',
        'Access-Control-Request-Method': 'POST',
      },
    });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('keeps CORS headers on a CSRF rejection so the browser can read it', async () => {
    const res = await fetch(`${base}/copilot/chat`, {
      method: 'POST',
      headers: {
        Origin: FRONTEND,
        'Content-Type': 'application/json',
        Cookie: 'auth=session',
      },
      body: '{}',
    });
    expect(res.status).toBe(403);
    expect(res.headers.get('access-control-allow-origin')).toBe(FRONTEND);
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
    expect(res.headers.get('access-control-expose-headers')).toContain('x-csrf-required');
  });

  it('lets the request through with the CSRF header and keeps CORS headers', async () => {
    const token = createCsrfToken();
    const res = await fetch(`${base}/copilot/chat`, {
      method: 'POST',
      headers: {
        Origin: FRONTEND,
        'Content-Type': 'application/json',
        Cookie: `auth=session; csrf=${token}`,
        'x-csrf-token': token,
      },
      body: '{}',
    });
    expect(res.status).toBe(201);
    expect(res.headers.get('access-control-allow-origin')).toBe(FRONTEND);
  });
});
