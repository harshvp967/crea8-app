const ROBOTS_TAG = 'noindex, nofollow';
const ROBOTS_TXT = 'User-agent: *\nDisallow: /\n';

function withRobots(response) {
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', ROBOTS_TAG);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/robots.txt') {
      return withRobots(
        new Response(ROBOTS_TXT, {
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        })
      );
    }
    if (url.pathname === '/sitemap.xml' || url.pathname === '/sitemap.txt') {
      return withRobots(new Response('Not found', { status: 404 }));
    }
    return withRobots(await env.ASSETS.fetch(request));
  },
};
