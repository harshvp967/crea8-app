jest.mock('@sentry/nestjs', () => ({
  init: jest.fn(),
  setUser: jest.fn(),
  setTag: jest.fn(),
}));

import * as Sentry from '@sentry/nestjs';
import {
  initializeSentry,
  sentryDsn,
  setSentryUserContext,
} from '@gitroom/nestjs-libraries/sentry/initialize.sentry';

describe('sentry gating', () => {
  const previous = {
    SENTRY_DSN: process.env.SENTRY_DSN,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    jest.clearAllMocks();
  });

  it('is a no-op when neither DSN is set', () => {
    delete process.env.SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    expect(sentryDsn()).toBe('');
    expect(initializeSentry('backend')).toBeNull();
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('prefers SENTRY_DSN and still accepts the public DSN', () => {
    process.env.SENTRY_DSN = 'https://example.ingest.sentry.io/1';
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://public.ingest.sentry.io/2';
    expect(sentryDsn()).toBe('https://example.ingest.sentry.io/1');
    delete process.env.SENTRY_DSN;
    expect(sentryDsn()).toBe('https://public.ingest.sentry.io/2');
  });

  it('attaches the user id and organization, not the email', () => {
    setSentryUserContext({
      userId: 'user-1',
      email: 'ada@example.com',
      orgId: 'org-1',
      paymentId: 'cus_123',
    });
    expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'user-1' });
    expect(Sentry.setTag).toHaveBeenCalledWith('organization.id', 'org-1');
    const payload = JSON.stringify((Sentry.setUser as jest.Mock).mock.calls);
    expect(payload).not.toContain('ada@example.com');
  });
});
