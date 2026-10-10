// X redirects the browser to the frontend. The API builds that URL, so the
// value has to exist on the backend (Railway), not only on Vercel.
export function xOAuthCallbackUrl() {
  const base = (process.env.X_URL || process.env.FRONTEND_URL || '')
    .trim()
    .replace(/\/+$/, '');

  if (!/^https?:\/\//i.test(base)) {
    throw new Error(
      'X OAuth callback is not configured. Set X_URL on the backend to the public frontend origin registered in the X app. X_URL on Vercel is not available to the API. When X_URL is unset, FRONTEND_URL is used.'
    );
  }

  return `${base}/integrations/social/x`;
}
