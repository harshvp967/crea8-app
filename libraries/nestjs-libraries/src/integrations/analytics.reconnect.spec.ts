import {
  analyticsFailureNeedsReconnect,
  Disconnect,
  NotEnoughScopes,
  RefreshToken,
} from '@gitroom/nestjs-libraries/integrations/social.abstract';

describe('analyticsFailureNeedsReconnect', () => {
  it('treats a dead token or revoked grant as reconnect', () => {
    expect(
      analyticsFailureNeedsReconnect(
        new Error('Error validating access token: Session has expired')
      )
    ).toBe(true);
    expect(
      analyticsFailureNeedsReconnect(
        new Error(JSON.stringify({ error: { code: 'access_token_invalid' } }))
      )
    ).toBe(true);
    expect(
      analyticsFailureNeedsReconnect(new Error('Request failed: Unauthorized'))
    ).toBe(true);
    expect(analyticsFailureNeedsReconnect(new Error('invalid_grant'))).toBe(
      true
    );
  });

  it('treats an HTTP 401 from the provider as reconnect', () => {
    const error = new Error('Request failed');
    (error as { response?: { status: number } }).response = { status: 401 };
    expect(analyticsFailureNeedsReconnect(error)).toBe(true);
  });

  it('treats refresh, disconnect, and missing scopes as reconnect', () => {
    expect(
      analyticsFailureNeedsReconnect(
        new RefreshToken('facebook', '{}', '{}')
      )
    ).toBe(true);
    expect(
      analyticsFailureNeedsReconnect(new Disconnect('tiktok', '{}', '{}'))
    ).toBe(true);
    expect(analyticsFailureNeedsReconnect(new NotEnoughScopes())).toBe(true);
  });

  it('leaves ordinary analytics failures alone', () => {
    expect(
      analyticsFailureNeedsReconnect(
        new Error('(#100) The value must be a valid insights metric')
      )
    ).toBe(false);
    expect(
      analyticsFailureNeedsReconnect(new Error('Analytics request timed out'))
    ).toBe(false);
    expect(
      analyticsFailureNeedsReconnect(
        new Error('X analytics is unavailable for this account')
      )
    ).toBe(false);
    expect(
      analyticsFailureNeedsReconnect(
        new Error('TikTok API rate limit exceeded, please try again later')
      )
    ).toBe(false);
    expect(analyticsFailureNeedsReconnect(new Error(''))).toBe(false);
    const serverError = new Error('upstream failed');
    (serverError as { response?: { status: number } }).response = {
      status: 500,
    };
    expect(analyticsFailureNeedsReconnect(serverError)).toBe(false);
  });
});
