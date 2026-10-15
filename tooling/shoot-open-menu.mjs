// Open the post menu on a future scheduled post. Read-only: the click is the
// ⋮ only. Dates are rewritten in the intercepted response.
import { chromium } from '/workspace/node_modules/playwright-core/index.mjs';
import fs from 'fs';
import path from 'path';

const preview = process.env.PREVIEW_URL;
const shareFile = process.env.SHARE_FILE;
const outDir = process.env.OUT_DIR;
const cookieFile = process.env.COOKIE_FILE || '/tmp/qa-cookie-json';
if (!preview || !shareFile || !outDir) {
  console.error('PREVIEW_URL, SHARE_FILE, and OUT_DIR are required');
  process.exit(1);
}
const stored = JSON.parse(fs.readFileSync(cookieFile, 'utf8'));
const apiCookie = stored.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
const apiPrefixes = [
  '/user', '/integrations', '/posts', '/sets', '/signatures',
  '/announcements', '/notifications', '/billing', '/settings', '/customers', '/media',
];
const sizes = [[390, 844], [820, 1180], [1366, 768]];
const views = ['day', 'week', 'month', 'list'];
const themes = ['light', 'dark'];

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({ viewport: { width: 820, height: 1180 } });
const page = await context.newPage();
let cache = null;

function routeFor() {
  return async (route) => {
    const request = route.request();
    let parsed;
    try { parsed = new URL(request.url()); } catch { return route.continue(); }
    if (parsed.hostname === 'app.crea8.one' && parsed.pathname.startsWith('/_next/')) {
      const cookies = await context.cookies(preview);
      const headers = { ...request.headers() };
      delete headers.host;
      headers.cookie = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
      const response = await route.fetch({ url: preview + parsed.pathname + parsed.search, headers });
      return route.fulfill({ response });
    }
    const apiHost = parsed.hostname === 'api.crea8.one';
    const isApi = (parsed.origin === preview || apiHost) && apiPrefixes.some((prefix) => parsed.pathname === prefix || parsed.pathname.startsWith(prefix + '/'));
    if (!isApi || parsed.search.includes('_rsc=') || request.resourceType() === 'document') return route.continue();
    if (request.method() === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': preview,
          'access-control-allow-credentials': 'true',
          'access-control-allow-headers': request.headers()['access-control-request-headers'] || '*',
          'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        },
      });
    }
    const headers = { ...request.headers() };
    delete headers.host;
    headers.origin = 'http://localhost:4200';
    headers.cookie = apiCookie;
    let response;
    try {
      response = await route.fetch({ url: 'http://127.0.0.1:3000' + parsed.pathname + parsed.search, headers });
    } catch {
      return route.fulfill({ status: 502, contentType: 'application/json', body: '{"message":"local api unavailable"}' });
    }
    let body = await response.body();
    if (parsed.pathname === '/integrations/list' || parsed.pathname === '/posts' || parsed.pathname === '/posts/list') {
      try {
        const json = JSON.parse(body.toString('utf8'));
        if (parsed.pathname === '/integrations/list' && json?.integrations?.[0] && !json.integrations[0].customer) {
          json.integrations[0].customer = { id: 'cust-qa', name: 'Northwind' };
        }
        if (Array.isArray(json?.p)) {
          if (json.p.length && !cache) cache = json.p.slice(0, 3);
          if (!json.p.length && cache && parsed.pathname === '/posts') json.p = cache.map((post) => ({ ...post }));
          const start = Date.parse(parsed.searchParams.get('startDate') || '');
          const end = Date.parse(parsed.searchParams.get('endDate') || '');
          let future = Date.now() + 2 * 3600000;
          if (Number.isFinite(start)) future = Math.max(future, start + 2 * 3600000);
          if (Number.isFinite(end)) future = Math.min(future, end - 60000);
          const iso = new Date(future).toISOString();
          for (const post of json.p) {
            post.d = iso;
            post.s = 'QUEUE';
          }
        }
        body = Buffer.from(JSON.stringify(json));
      } catch {
        /* keep the original body */
      }
    }
    if (!apiHost) return route.fulfill({ response, body });
    const respHeaders = response.headers();
    respHeaders['access-control-allow-origin'] = preview;
    respHeaders['access-control-allow-credentials'] = 'true';
    return route.fulfill({ status: response.status(), headers: respHeaders, body });
  };
}

const share = fs.readFileSync(shareFile, 'utf8').trim();
await page.goto(share, { waitUntil: 'domcontentloaded', timeout: 90000 });
if (!(await context.cookies()).some((cookie) => cookie.name === '_vercel_jwt')) {
  throw new Error('preview share did not set _vercel_jwt');
}
await context.addCookies(stored.map((cookie) => ({
  name: cookie.name, value: cookie.value, url: preview,
  httpOnly: cookie.name === 'auth', secure: true, sameSite: 'Lax',
})));
await context.route('**/*', routeFor());

await page.setViewportSize({ width: 820, height: 1180 });
await page.goto(`${preview}/launches?display=week`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForSelector('.cal-post', { timeout: 25000 });

for (const theme of themes) {
  for (const [width, height] of sizes) {
    for (const view of views) {
      const name = `${width}x${height}-${view}-menu-${theme}.png`;
      const file = path.join(outDir, name);
      try {
        await page.setViewportSize({ width, height });
        await context.addCookies([{ name: 'mode', value: theme, url: preview, secure: true, sameSite: 'Lax' }]);
        await page.goto(`${preview}/launches?display=${view}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
        await page.waitForSelector('.cal-mode', { timeout: 25000 });
        if (view === 'list') {
          await page.locator('.cal-list-states div', { hasText: 'Scheduled' }).first().click({ timeout: 8000 });
        }
        await page.waitForSelector('.cal-post', { timeout: 20000 });
        const point = await page.evaluate(async () => {
          const post = document.querySelector('.cal-post');
          post.scrollIntoView({ block: 'center', inline: 'nearest' });
          await new Promise((resolve) => setTimeout(resolve, 450));
          const rect = post.querySelector('.cal-post-more').getBoundingClientRect();
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        });
        if (point.x < 0 || point.y < 0 || point.x > width || point.y > height) {
          throw new Error(`button offscreen ${Math.round(point.x)},${Math.round(point.y)}`);
        }
        await page.mouse.click(point.x, point.y);
        await page.waitForTimeout(400);
        const open = await page.evaluate(() => {
          const bar = document.querySelector('.cal-post-bar.is-overlay, .cal-post.is-open .cal-post-bar');
          if (!bar || !document.querySelector('.cal-post.is-open')) return false;
          const box = bar.getBoundingClientRect();
          return getComputedStyle(bar).display !== 'none' && box.width > 20 && box.height > 20;
        });
        await page.mouse.move(2, Math.max(2, height - 2));
        await page.screenshot({ path: file });
        console.log(open ? 'ok' : 'CLOSED', name);
      } catch (error) {
        console.log('FAIL', name, error.message.split('\n')[0]);
        await page.screenshot({ path: file }).catch(() => {});
      }
    }
  }
}
await browser.close();
