function stripTrailingSlash(url: string | undefined) {
  return (url || '').trim().replace(/\/$/, '');
}

// The browser calls the Nest API directly. NEXT_PUBLIC_BACKEND_URL is that
// origin (docker uses the public host plus /api, which nginx strips).
// If it is missing or equal to the Next frontend, fetch('/auth/register')
// stays on the frontend and Vercel returns 404 HTML. Server-side calls
// already use BACKEND_INTERNAL_URL; the browser should use that too.
export function browserBackendUrl() {
  const configured = stripTrailingSlash(process.env.NEXT_PUBLIC_BACKEND_URL);
  const frontend = stripTrailingSlash(process.env.FRONTEND_URL);
  const internal = stripTrailingSlash(process.env.BACKEND_INTERNAL_URL);

  if (configured && configured !== frontend) {
    return configured;
  }

  if (internal && internal !== frontend) {
    return internal;
  }

  return configured;
}
