import { PRODUCTION_SITE_ORIGIN, publicSiteOrigin } from '@gitroom/frontend/components/layout/site.origin';
import robots from '@gitroom/frontend/app/robots';
import sitemap from '@gitroom/frontend/app/sitemap';
import { GET } from '@gitroom/frontend/app/api/public/links/route';

describe('public site origin', () => {
  const env = process.env as Record<string, string | undefined>;
  const previousNode = env.NODE_ENV;
  const previousFrontend = env.FRONTEND_URL;
  const previousBackend = env.BACKEND_INTERNAL_URL;

  afterEach(() => {
    env.NODE_ENV = previousNode;
    if (previousFrontend === undefined) {
      delete env.FRONTEND_URL;
    } else {
      env.FRONTEND_URL = previousFrontend;
    }
    if (previousBackend === undefined) {
      delete env.BACKEND_INTERNAL_URL;
    } else {
      env.BACKEND_INTERNAL_URL = previousBackend;
    }
  });

  it('keeps the local origin outside production', () => {
    env.NODE_ENV = 'development';
    delete env.FRONTEND_URL;
    expect(publicSiteOrigin()).toBe('http://localhost:4200');
    env.FRONTEND_URL = 'http://localhost:4200/';
    expect(publicSiteOrigin()).toBe('http://localhost:4200');
  });

  it('ignores a localhost FRONTEND_URL in production', () => {
    env.NODE_ENV = 'production';
    env.FRONTEND_URL = 'http://localhost:4200';
    expect(publicSiteOrigin()).toBe(PRODUCTION_SITE_ORIGIN);
    expect(robots()).toEqual({
      rules: {
        userAgent: '*',
        allow: ['/p/', '/privacy', '/terms', '/data-deletion'],
        disallow: ['/'],
      },
      sitemap: 'https://app.crea8.one/sitemap.xml',
    });
    expect(sitemap().map((entry) => entry.url)).toEqual([
      'https://app.crea8.one/privacy',
      'https://app.crea8.one/terms',
      'https://app.crea8.one/data-deletion',
    ]);
    env.FRONTEND_URL = 'http://127.0.0.1:4200/';
    expect(publicSiteOrigin()).toBe('https://app.crea8.one');
    delete env.FRONTEND_URL;
    expect(publicSiteOrigin()).toBe('https://app.crea8.one');
  });

  it('keeps a non-local production origin', () => {
    env.NODE_ENV = 'production';
    env.FRONTEND_URL = 'https://preview.example/';
    expect(publicSiteOrigin()).toBe('https://preview.example');
  });

  it('proxies GET /api/public/links and keeps only string slugs', async () => {
    env.BACKEND_INTERNAL_URL = 'http://backend:3000/';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ slugs: ['ada', 1, 'bob'] }),
    });
    const original = global.fetch;
    global.fetch = fetchMock as never;
    try {
      const response = await GET();
      expect(fetchMock).toHaveBeenCalledWith('http://backend:3000/public/links', { cache: 'no-store' });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ slugs: ['ada', 'bob'] });
    } finally {
      global.fetch = original;
    }
  });

  it('does not invent slugs when the backend is unset', async () => {
    delete env.BACKEND_INTERNAL_URL;
    const response = await GET();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ slugs: [] });
  });
});
