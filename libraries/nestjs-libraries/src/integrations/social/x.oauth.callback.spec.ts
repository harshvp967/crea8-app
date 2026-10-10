import { xOAuthCallbackUrl } from '@gitroom/nestjs-libraries/integrations/social/x.oauth.callback';

describe('x OAuth callback', () => {
  const previous = {
    x: process.env.X_URL,
    front: process.env.FRONTEND_URL,
  };

  afterEach(() => {
    process.env.X_URL = previous.x;
    process.env.FRONTEND_URL = previous.front;
  });

  it('prefers X_URL and strips a trailing slash', () => {
    process.env.X_URL = 'https://app.example.com/';
    process.env.FRONTEND_URL = 'https://other.example.com';
    expect(xOAuthCallbackUrl()).toBe(
      'https://app.example.com/integrations/social/x'
    );
  });

  it('uses FRONTEND_URL when X_URL is empty', () => {
    process.env.X_URL = '';
    process.env.FRONTEND_URL = 'https://app.example.com';
    expect(xOAuthCallbackUrl()).toBe(
      'https://app.example.com/integrations/social/x'
    );
  });

  it('refuses to build a callback when both origins are missing', () => {
    delete process.env.X_URL;
    delete process.env.FRONTEND_URL;
    expect(() => xOAuthCallbackUrl()).toThrow(/X_URL/);
  });
});
