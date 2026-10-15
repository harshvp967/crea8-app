// Standing calendar screenshots for a preview build.
// One pass: every size in both orientations, light and dark, each view.
//
//   PREVIEW_URL   https://<git-alias>.vercel.app
//   SHARE_FILE    file with one ?_vercel_share= URL (visited once, before routing)
//   OUT_DIR       folder for {w}x{h}-{view}-{theme}.png
//   COOKIE_FILE   QA auth cookies JSON (default /tmp/qa-cookie-json)
//   PUSH=1        commit OUT_DIR and push this qa-shots repo after a clean pass
//
// Run from the qa-shots repo: node tooling/shoot-calendar.mjs

import { chromium } from '/workspace/node_modules/playwright-core/index.mjs';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const preview = process.env.PREVIEW_URL;
const shareFile = process.env.SHARE_FILE;
const outDir = process.env.OUT_DIR;
const cookieFile = process.env.COOKIE_FILE || '/tmp/qa-cookie-json';
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

if (!preview || !shareFile || !outDir) {
  console.error('PREVIEW_URL, SHARE_FILE, and OUT_DIR are required');
  process.exit(1);
}

const bases = [
  [390, 844],
  [402, 874],
  [440, 956],
  [412, 923],
  [384, 832],
  [744, 1133],
  [820, 1180],
  [1032, 1376],
  [1366, 768],
  [1920, 1080],
];
const sizes = bases.flatMap(([width, height]) => [
  [width, height],
  [height, width],
]);
const themes = ['light', 'dark'];
const views = ['day', 'week', 'month', 'list', 'customer', 'slots'];

const stored = JSON.parse(fs.readFileSync(cookieFile, 'utf8'));
const apiCookie = stored.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
const apiPrefixes = [
  '/user',
  '/integrations',
  '/posts',
  '/sets',
  '/signatures',
  '/announcements',
  '/notifications',
  '/billing',
  '/settings',
  '/customers',
  '/media',
];

fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({
  viewport: { width: 820, height: 1180 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const failures = [];

// Local channels have no customer, so the pill never renders. Attach one
// in the intercepted list so the customer shots show "All customers".
async function rewriteApi(pathname, body) {
  if (pathname !== '/integrations/list') return body;
  try {
    const json = JSON.parse(body.toString('utf8'));
    if (json?.integrations?.[0] && !json.integrations[0].customer) {
      json.integrations[0].customer = { id: 'cust-qa', name: 'Northwind' };
      return Buffer.from(JSON.stringify(json));
    }
  } catch {
    return body;
  }
  return body;
}

function routeFor() {
  return async (route) => {
    const request = route.request();
    let parsed;
    try {
      parsed = new URL(request.url());
    } catch {
      return route.continue();
    }
    if (parsed.hostname === 'app.crea8.one' && parsed.pathname.startsWith('/_next/')) {
      const cookies = await context.cookies(preview);
      const headers = { ...request.headers() };
      delete headers.host;
      headers.cookie = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
      const response = await route.fetch({
        url: preview + parsed.pathname + parsed.search,
        headers,
      });
      return route.fulfill({ response });
    }
    const apiHost = parsed.hostname === 'api.crea8.one';
    const isApi =
      (parsed.origin === preview || apiHost) &&
      apiPrefixes.some(
        (prefix) => parsed.pathname === prefix || parsed.pathname.startsWith(prefix + '/')
      );
    if (isApi && !parsed.search.includes('_rsc=') && request.resourceType() !== 'document') {
      if (request.method() === 'OPTIONS') {
        return route.fulfill({
          status: 204,
          headers: {
            'access-control-allow-origin': preview,
            'access-control-allow-credentials': 'true',
            'access-control-allow-headers':
              request.headers()['access-control-request-headers'] || '*',
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
        response = await route.fetch({
          url: 'http://127.0.0.1:3000' + parsed.pathname + parsed.search,
          headers,
        });
      } catch (error) {
        return route.fulfill({
          status: 502,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'local api unavailable' }),
        });
      }
      const body = await rewriteApi(parsed.pathname, await response.body());
      if (!apiHost) {
        return route.fulfill({ response, body });
      }
      const respHeaders = response.headers();
      respHeaders['access-control-allow-origin'] = preview;
      respHeaders['access-control-allow-credentials'] = 'true';
      return route.fulfill({
        status: response.status(),
        headers: respHeaders,
        body,
      });
    }
    return route.continue();
  };
}

async function unlock() {
  await context.unroute('**/*').catch(() => {});
  const share = fs.readFileSync(shareFile, 'utf8').trim();
  await page.goto(share, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const landed = new URL(page.url());
  const jwt = (await context.cookies()).some((cookie) => cookie.name === '_vercel_jwt');
  console.log('share landed', landed.host, landed.pathname, 'jwt', jwt);
  if (!jwt) {
    throw new Error('preview share did not set _vercel_jwt');
  }
  await context.addCookies(
    stored.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      url: preview,
      httpOnly: cookie.name === 'auth',
      secure: true,
      sameSite: 'Lax',
    }))
  );
  await context.route('**/*', routeFor());
}

async function openCalendar(theme, width, height, view) {
  await page.setViewportSize({ width, height });
  await context.addCookies([
    {
      name: 'mode',
      value: theme,
      url: preview,
      httpOnly: false,
      secure: true,
      sameSite: 'Lax',
    },
  ]);
  await page.goto(`${preview}/launches?display=${view}`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.waitForSelector('.cal-mode', { timeout: 25000 });
  await page.waitForTimeout(500);
}

async function readLayout() {
  return page.evaluate(() => {
    const shown = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return 'missing';
      return getComputedStyle(node).display;
    };
    const sticker = document.querySelector('.c8-cal-sticker')?.getBoundingClientRect();
    const well = document.querySelector('.calendar-well')?.getBoundingClientRect();
    const week = document.querySelector('.week-grid')?.getBoundingClientRect();
    const day = document.querySelector('.day-grid, .phone-day-list, .month-grid')?.getBoundingClientRect();
    const tab = document.querySelector('.mobile-tabbar')?.getBoundingClientRect();
    const rail = document.querySelector('.channel-rail');
    const railBox = rail?.getBoundingClientRect();
    return {
      tab: shown('.mobile-tabbar'),
      tabW: tab ? Math.round(tab.width) : 0,
      side: shown('.c8-sidebar'),
      header: shown('.app-header'),
      phoneWeek: shown('.phone-week'),
      dayGrid: !!document.querySelector('.day-grid'),
      phoneList: !!document.querySelector('.phone-day-list'),
      stickerY: sticker ? Math.round(sticker.y) : null,
      wellH: well ? Math.round(well.height) : null,
      weekW: week ? Math.round(week.width) : 0,
      weekH: week ? Math.round(week.height) : 0,
      gridH: day ? Math.round(day.height) : 0,
      railW:
        rail && getComputedStyle(rail).display !== 'none' ? Math.round(railBox.width) : 0,
      docW: document.documentElement.scrollWidth,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      text: (document.querySelector('.calendar-well')?.innerText || '').replace(/\s+/g, ' ').slice(0, 80),
    };
  });
}

function expectLayout(width, height, view, layout) {
  const phone = width <= 639 || height <= 500;
  const desktop = width >= 1200 && height > 500;
  const problems = [];
  if (layout.overflowX) problems.push('horizontal overflow');
  if (layout.stickerY != null && layout.stickerY < 0) problems.push('Schedule tag clipped');
  if (phone) {
    if (layout.tab !== 'flex') problems.push('phone missing tab bar');
    if (layout.side !== 'none') problems.push('phone showing sidebar');
    if (layout.header === 'none') problems.push('phone missing header');
    if (height <= 500) {
      if (view === 'day' || view === 'week' || view === 'month') {
        const gridH = Math.max(layout.weekH || 0, layout.gridH || 0, layout.wellH || 0);
        if (gridH < Math.round(height * 0.7)) problems.push('short calendar has no height');
      }
      if (view === 'week' && layout.weekW < width - 80) problems.push('week grid not full width');
      if (layout.tabW < width - 8) problems.push('tab bar not full width');
    }
  } else if (desktop) {
    if (layout.tab !== 'none') problems.push('desktop showing tab bar');
    if (layout.side === 'none') problems.push('desktop missing sidebar');
    if (layout.header !== 'none') problems.push('desktop showing phone header');
  } else {
    if (layout.tab !== 'none') problems.push('tablet showing tab bar');
    if (layout.side === 'none') problems.push('tablet missing sidebar');
    if (layout.header !== 'none') problems.push('tablet showing phone header');
    if (layout.phoneWeek === 'flex') problems.push('tablet day strip visible');
    if (view === 'day' && layout.phoneList && width >= 768) problems.push('tablet using phone day list');
    if (layout.railW < 100) problems.push('tablet channels column missing');
    if (layout.stickerY != null && layout.stickerY < 8) problems.push('tablet missing top padding');
  }
  return problems;
}

async function openSlots() {
  const row = page.locator('.channel-rail .channel-row').first();
  const rowVisible = await row.isVisible().catch(() => false);
  if (!rowVisible) {
    await page.locator('.channels-trigger').first().click({ timeout: 8000 });
    await page.waitForSelector('.channel-rail.is-open .channel-row', { timeout: 8000 });
  }
  const menu = page.locator('.channel-rail .channel-row .cursor-pointer').first();
  await menu.click({ timeout: 8000, force: true });
  await page.getByText('Edit Time Slots', { exact: true }).click({ timeout: 8000, force: true });
  await page.waitForSelector('.arc-dialog:has(.c8-slots)', { timeout: 10000 });
  await page.waitForFunction(() => {
    const wrap = document.querySelector('.arc-dialog-wrap');
    const dialog = document.querySelector('.arc-dialog:has(.c8-slots)');
    if (!wrap || !dialog) return false;
    const opaque = [wrap, dialog].every(
      (node) => parseFloat(getComputedStyle(node).opacity) >= 0.99
    );
    const running = [wrap, dialog]
      .flatMap((node) => node.getAnimations({ subtree: true }))
      .some((animation) => animation.playState === 'running');
    return opaque && !running;
  }, { timeout: 8000 });
  await page.waitForTimeout(400);
}

await unlock();

for (const theme of themes) {
  for (const [width, height] of sizes) {
    for (const view of views) {
      const name = `${width}x${height}-${view}-${theme}.png`;
      const file = path.join(outDir, name);
      if (fs.existsSync(file) && fs.statSync(file).size > 1000) {
        console.log('skip', name);
        continue;
      }
      try {
        if (view === 'customer' || view === 'slots') {
          await openCalendar(theme, width, height, 'week');
        } else {
          await openCalendar(theme, width, height, view);
        }
        if (view === 'customer') {
          await page.locator('.select-customer').first().click({ timeout: 8000 });
          await page.waitForSelector('.customer-menu', { timeout: 8000 });
          await page.waitForTimeout(200);
        }
        if (view === 'slots') {
          await openSlots();
        }
        const layout = await readLayout();
        const problems =
          view === 'customer' || view === 'slots'
            ? layout.overflowX
              ? ['horizontal overflow']
              : []
            : expectLayout(width, height, view, layout);
        await page.mouse.move(2, Math.max(2, height - 2));
        await Promise.race([
          page.screenshot({ path: file }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('screenshot timeout')), 15000)),
        ]);
        if (problems.length) {
          failures.push(`${name}: ${problems.join(', ')}`);
          console.log('FAIL', name, problems.join(', '), JSON.stringify(layout));
        } else {
          console.log('ok', name);
        }
      } catch (error) {
        failures.push(`${name}: ${error.message.split('\n')[0]}`);
        console.log('FAIL', name, error.message.split('\n')[0]);
        await Promise.race([
          page.screenshot({ path: file }),
          new Promise((resolve) => setTimeout(resolve, 8000)),
        ]).catch(() => {});
      }
    }
  }
}

await browser.close();
console.log('shots', sizes.length * themes.length * views.length, 'failures', failures.length);
if (failures.length) {
  fs.writeFileSync(path.join(outDir, 'failures.txt'), failures.join('\n') + '\n');
  process.exit(1);
}

if (process.env.PUSH === '1') {
  execFileSync('git', ['add', path.relative(repoRoot, outDir), 'tooling/shoot-calendar.mjs'], {
    cwd: repoRoot,
  });
  execFileSync(
    'git',
    ['commit', '-m', `Add ${path.basename(outDir)} calendar shots for the preview matrix.`],
    { cwd: repoRoot }
  );
  execFileSync('git', ['push', '-u', 'origin', 'HEAD'], { cwd: repoRoot });
}
