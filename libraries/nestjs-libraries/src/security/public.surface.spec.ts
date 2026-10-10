import { BadRequestException } from '@nestjs/common';
import { assertOAuthRedirect } from '@gitroom/helpers/auth/oauth.link';
import { swaggerEnabled } from '@gitroom/helpers/swagger/load.swagger';
import { sanitizePostContent } from '@gitroom/helpers/utils/sanitize.post.content';
import { GithubProvider } from '@gitroom/backend/services/auth/providers/github.provider';
import { lookupAuthProvider } from '@gitroom/backend/services/auth/providers/providers.manager';
import { mediaPublicUrl } from '@gitroom/nestjs-libraries/upload/media.public.url';

describe('public surface guards', () => {
  const previous = {
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    ENABLE_SWAGGER: process.env.ENABLE_SWAGGER,
    NODE_ENV: process.env.NODE_ENV,
    RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
    CLOUDFLARE_BUCKET_URL: process.env.CLOUDFLARE_BUCKET_URL,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('strips scripts and keeps mentions and https links', () => {
    const html = sanitizePostContent(
      '<p>Hi <span data-mention-id="1" data-mention-label="@ada">@ada</span></p><script>alert(1)</script><a href="https://crea8.one">site</a><a href="/about">local</a><a href="//evil.example">bad</a>'
    );
    expect(html).not.toContain('<script');
    expect(html).toContain('data-mention-id="1"');
    expect(html).toContain('https://crea8.one');
    expect(html).toContain('href="/about"');
    expect(html).not.toContain('evil.example');
  });

  it('rejects a broken oauth redirect', () => {
    expect(() => assertOAuthRedirect('')).toThrow(BadRequestException);
    expect(() =>
      assertOAuthRedirect('https://github.com/login/oauth/authorize?client_id=undefined')
    ).toThrow(BadRequestException);
    expect(
      assertOAuthRedirect('https://github.com/login/oauth/authorize?client_id=abc')
    ).toContain('client_id=abc');
  });

  it('returns 400 for an unknown auth provider and a missing GitHub client', () => {
    expect(() => lookupAuthProvider('not-a-provider')).toThrow(BadRequestException);
    try {
      lookupAuthProvider('not-a-provider');
    } catch (err) {
      expect((err as BadRequestException).getStatus()).toBe(400);
    }
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
    expect(() => new GithubProvider().generateLink()).toThrow(BadRequestException);
  });

  it('hides swagger in production unless ENABLE_SWAGGER=true', () => {
    delete process.env.ENABLE_SWAGGER;
    delete process.env.RAILWAY_ENVIRONMENT;
    process.env.NODE_ENV = 'production';
    expect(swaggerEnabled()).toBe(false);
    process.env.ENABLE_SWAGGER = 'true';
    expect(swaggerEnabled()).toBe(true);
    process.env.ENABLE_SWAGGER = 'false';
    process.env.NODE_ENV = 'development';
    expect(swaggerEnabled()).toBe(false);
  });

  it('builds media URLs from CLOUDFLARE_BUCKET_URL', () => {
    process.env.CLOUDFLARE_BUCKET_URL = 'https://media.example.com/';
    expect(mediaPublicUrl('folder/file.png')).toBe(
      'https://media.example.com/folder/file.png'
    );
    delete process.env.CLOUDFLARE_BUCKET_URL;
    expect(() => mediaPublicUrl('file.png')).toThrow(/CLOUDFLARE_BUCKET_URL/);
  });
});
