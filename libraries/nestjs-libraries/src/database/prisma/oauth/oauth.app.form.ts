export const CLIENT_ID_COPY_LABEL = 'Copy Client ID';
export const REDIRECT_URL_ERROR = 'Enter a full redirect URL.';

// The credentials button copies the client id. The label has to name that value.
export function clientIdCopy(clientId: string) {
  return { label: CLIENT_ID_COPY_LABEL, value: clientId };
}

export function oauthRedirectError(redirectUrl: string) {
  const value = (redirectUrl || '').trim();
  try {
    const parsed = new URL(value);
    if (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      parsed.hostname
    ) {
      return '';
    }
  } catch {
    // An incomplete value is not a URL.
  }
  return REDIRECT_URL_ERROR;
}

// A failed create keeps the form open and returns one error sentence.
export function oauthCreateResult(input: { ok: boolean; message?: unknown }) {
  if (input.ok) {
    return { open: false, error: '' };
  }
  const raw = Array.isArray(input.message)
    ? input.message.filter((item) => typeof item === 'string').join(' ')
    : typeof input.message === 'string'
      ? input.message
      : '';
  const aboutUrl = /redirect|url/i.test(raw);
  return {
    open: true,
    error: aboutUrl || !raw ? REDIRECT_URL_ERROR : raw,
  };
}
