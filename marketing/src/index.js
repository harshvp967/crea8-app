import { PAGE_PATHS } from '../site/paths.mjs';
import { siteStealth } from '../site/stealth.mjs';

const ROBOTS_DENY = 'noindex, nofollow';
const ROBOTS_ALLOW = 'index, follow';
const ROBOTS_TXT_DENY = 'User-agent: *\nDisallow: /\n';
const ROBOTS_META = /<meta name="robots" content="(?:noindex, nofollow|index, follow)">/;

function indexable(env, url, status) {
  if (siteStealth(env) || status === 404) return false;
  return url.pathname !== '/404' && url.pathname !== '/404.html';
}

function robotsTag(allowed) {
  return allowed ? ROBOTS_ALLOW : ROBOTS_DENY;
}

function robotsTxt(stealth) {
  if (stealth) return ROBOTS_TXT_DENY;
  return 'User-agent: *\nAllow: /\n';
}

function sitemap(origin) {
  const urls = PAGE_PATHS.map((path) => {
    const loc = path === '/' ? `${origin}/` : `${origin}${path}`;
    return `  <url><loc>${loc}</loc></url>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function tagged(response, allowed) {
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', robotsTag(allowed));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function serveAsset(request, env) {
  const url = new URL(request.url);
  const response = await env.ASSETS.fetch(request);
  const allowed = indexable(env, url, response.status);
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', robotsTag(allowed));
  const type = headers.get('content-type') || '';
  if (!type.includes('text/html')) {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
  const html = await response.text();
  headers.delete('content-length');
  return new Response(html.replace(ROBOTS_META, `<meta name="robots" content="${robotsTag(allowed)}">`), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const stealth = siteStealth(env);
    if (url.pathname === '/robots.txt') {
      return tagged(
        new Response(robotsTxt(stealth), {
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        }),
        !stealth
      );
    }
    if (url.pathname === '/llms.txt' || url.pathname === '/sitemap.txt') {
      return tagged(new Response('Not found', { status: 404 }), false);
    }
    if (url.pathname === '/sitemap.xml') {
      if (stealth) return tagged(new Response('Not found', { status: 404 }), false);
      return tagged(
        new Response(sitemap(url.origin), {
          headers: { 'content-type': 'application/xml; charset=utf-8' },
        }),
        true
      );
    }
    return serveAsset(request, env);
  },
};
