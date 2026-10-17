import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

// Browser origins allowed to call the API with the session cookie.
// One list for Nest's CORS layer and the CopilotKit runtime, so they never drift.
export function frontendCorsOrigins(): string[] {
  return [
    process.env.FRONTEND_URL,
    'http://localhost:6274',
    ...(process.env.MAIN_URL ? [process.env.MAIN_URL] : []),
    ...(process.env.EXTRA_CORS_ORIGINS || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  ].filter((o): o is string => !!o);
}

export function apiCorsOptions(extraOrigins: string[] = []): CorsOptions {
  return {
    ...(!process.env.NOT_SECURED ? { credentials: true } : {}),
    // Cache preflights (browsers cap this at 2h). Every API call sends custom
    // headers, so without this each request paid an extra OPTIONS round trip.
    maxAge: 7200,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'auth',
      'showorg',
      'impersonate',
      'x-postiz-org',
      'x-postiz-include-deleted',
      'x-copilotkit-runtime-client-gql-version',
      'x-csrf-token',
    ],
    exposedHeaders: [
      'reload',
      'onboarding',
      'activate',
      'x-csrf-token',
      'x-csrf-required',
      'x-copilotkit-runtime-client-gql-version',
      ...(process.env.NOT_SECURED ? ['auth', 'showorg', 'impersonate'] : []),
    ],
    origin: [...frontendCorsOrigins(), ...extraOrigins],
  };
}

// CopilotKit's runtime copies its own CORS headers onto the response.
export function copilotRuntimeCors() {
  return {
    origin: frontendCorsOrigins(),
    credentials: !process.env.NOT_SECURED,
  };
}
