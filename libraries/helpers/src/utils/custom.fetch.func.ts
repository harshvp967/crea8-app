import { CSRF_HEADER, CSRF_REQUIRED_HEADER } from '@gitroom/helpers/auth/cookie.policy';

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
let csrfMemory = '';

function readCsrfToken() {
  if (typeof window === 'undefined') {
    return '';
  }
  if (csrfMemory) {
    return csrfMemory;
  }
  const row = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('csrf='));
  return row ? decodeURIComponent(row.slice('csrf='.length)) : '';
}

// For clients that do not go through customFetch (the CopilotKit chat runtime).
// The API rejects cookie-authenticated POSTs without this header (csrfGuard).
export function csrfHeaders(): Record<string, string> {
  const token = readCsrfToken();
  return token ? { [CSRF_HEADER]: token } : {};
}

function rememberCsrf(token: string | null) {
  if (typeof window === 'undefined' || !token) {
    return;
  }
  csrfMemory = token;
}

export interface Params {
  baseUrl: string;
  beforeRequest?: (url: string, options: RequestInit) => Promise<RequestInit>;
  afterRequest?: (
    url: string,
    options: RequestInit,
    response: Response
  ) => Promise<boolean>;
}
export const customFetch = (
  params: Params,
  auth?: string,
  showorg?: string,
  secured: boolean = true
) => {
  return async function newFetch(url: string, options: RequestInit = {}, retried = false) {
    const loggedAuth =
      typeof window === 'undefined'
        ? undefined
        : new URL(window.location.href).searchParams.get('loggedAuth');
    const newRequestObject = await params?.beforeRequest?.(url, options);
    const authNonSecuredCookie =
      typeof document === 'undefined'
        ? null
        : document.cookie
            .split(';')
            .find((p) => p.includes('auth='))
            ?.split('=')[1];

    const authNonSecuredOrg =
      typeof document === 'undefined'
        ? null
        : document.cookie
            .split(';')
            .find((p) => p.includes('showorg='))
            ?.split('=')[1];

    const authNonSecuredImpersonate =
      typeof document === 'undefined'
        ? null
        : document.cookie
            .split(';')
            .find((p) => p.includes('impersonate='))
            ?.split('=')[1];

    const fetchRequest = await fetch(params.baseUrl + url, {
      ...(secured ? { credentials: 'include' } : {}),
      ...(newRequestObject || options),
      headers: {
        ...(showorg
          ? { showorg }
          : authNonSecuredOrg
          ? { showorg: authNonSecuredOrg }
          : {}),
        ...(options.body instanceof FormData
          ? {}
          : { 'Content-Type': 'application/json' }),
        Accept: 'application/json',
        ...(loggedAuth ? { auth: loggedAuth } : {}),
        ...options?.headers,
        ...(auth
          ? { auth }
          : authNonSecuredCookie
          ? { auth: authNonSecuredCookie }
          : {}),
        ...(authNonSecuredImpersonate
          ? { impersonate: authNonSecuredImpersonate }
          : {}),
        ...(UNSAFE.has((options.method || 'GET').toUpperCase()) && readCsrfToken()
          ? { [CSRF_HEADER]: readCsrfToken() }
          : {}),
      },
      // @ts-ignore
      ...(!options.next && options.cache !== 'force-cache'
        ? { cache: options.cache || 'no-store' }
        : {}),
    });

    rememberCsrf(fetchRequest.headers.get(CSRF_HEADER));
    if (
      !retried &&
      fetchRequest.status === 403 &&
      fetchRequest.headers.get(CSRF_REQUIRED_HEADER) === '1'
    ) {
      rememberCsrf(fetchRequest.headers.get(CSRF_HEADER));
      return newFetch(url, options, true);
    }

    if (
      !params?.afterRequest ||
      (await params?.afterRequest?.(url, options, fetchRequest))
    ) {
      return fetchRequest;
    }

    // @ts-ignore
    return new Promise((res) => {}) as Response;
  };
};

export const fetchBackend = customFetch({
  get baseUrl() {
    return process.env.BACKEND_URL!;
  },
});
