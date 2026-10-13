import { initializeSentryServer } from '@gitroom/react/sentry/initialize.sentry.server';

initializeSentryServer(
  process.env.NODE_ENV,
  process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || ''
);