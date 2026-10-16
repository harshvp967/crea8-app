// Composer screenshots for a preview build of main.
// Reads the local API. Writes are answered locally and never reach the server.
// Dialogs are closed with the cancel control.
//
//   PREVIEW_URL   https://<deployment>.vercel.app
//   SHARE_FILE    file with one ?_vercel_share= URL
//   OUT_DIR       folder for {w}x{h}-{view}-{theme}.png
//   COOKIE_FILE   QA auth cookies JSON (default /tmp/qa-cookie-json)
//   SIZE          optional WxH filter
//   THEME         optional light or dark
//   VIEW          optional view name
//
// Run from the qa-shots repo: node tooling/shoot-composer.mjs

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
const views = [
  'create-empty',
  'with-text',
  '15-channels',
  'channel-preview',
  'settings',
  'date-picker',
  'repeat-menu',
  'tags-menu',
  'postnow-open',
  'emoji',
  'media-dialog',
  'close-confirm',
  'edit-existing',
];

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
  '/third-party',
  '/copilot',
];
const blocked = [];

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
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('console', msg.text().slice(0, 220));
});
page.on('pageerror', (error) => console.log('pageerror', error.message.split('\n')[0]));
page.setDefaultTimeout(20000);
page.setDefaultNavigationTimeout(45000);
const failures = [];

function mockBody(pathname, body) {
  let json;
  try {
    json = JSON.parse(body.toString('utf8'));
  } catch {
    return body;
  }
  if (pathname === '/posts/tags' && !json?.tags?.length) {
    json.tags = [
      { id: 'tag-launch', name: 'Launch', color: '#00D9FF' },
      { id: 'tag-northwind', name: 'Northwind', color: '#F5A524' },
      { id: 'tag-notes', name: 'Notes', color: '#7C5CFC' },
    ];
    return Buffer.from(JSON.stringify(json));
  }
  if ((pathname === '/third-party' || pathname === '/copilot') && !Array.isArray(json) && !json?.tags) {
    return Buffer.from('[]');
  }
  if (pathname === '/media' && !json?.results?.length) {
    json.pages = 1;
    json.results = [
      ['northwind-cover.jpg', '/no-picture.jpg'],
      ['field-notes.jpg', '/icons/platforms/linkedin.png'],
      ['harbor-mark.jpg', '/icons/platforms/instagram.png'],
      ['schedule-card.jpg', '/icons/platforms/x.png'],
    ].map(([name, path], index) => ({
      id: `media-qa-${index + 1}`,
      name,
      originalName: name,
      path,
      thumbnail: null,
    }));
    return Buffer.from(JSON.stringify(json));
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
      const cors = {
        'access-control-allow-origin': preview,
        'access-control-allow-credentials': 'true',
        'access-control-allow-headers':
          request.headers()['access-control-request-headers'] || '*',
        'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      };
      if (request.method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: cors });
      }
      if (parsed.pathname.startsWith('/copilot')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: cors,
          body: '{}',
        });
      }
      if (request.method() !== 'GET' && request.method() !== 'HEAD') {
        blocked.push(`${request.method()} ${parsed.pathname}`);
        return route.fulfill({ status: 204, headers: cors, body: '' });
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
      } catch {
        return route.fulfill({
          status: 502,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'local api unavailable' }),
        });
      }
      const body = mockBody(parsed.pathname, await response.body());
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

async function settle() {
  await page
    .waitForFunction(() => {
      const running = document.getAnimations().filter((animation) => {
        if (animation.playState !== 'running') return false;
        const target = animation.effect && animation.effect.target;
        if (!(target instanceof Element)) return false;
        if (target.closest('.copilotKitButton, .copilotKitWindow, .po-spin, .copilotKitPopup')) {
          return false;
        }
        return true;
      });
      return running.length === 0;
    }, { timeout: 4000 })
    .catch(() => {});
  await page.waitForTimeout(180);
}

async function park() {
  const size = page.viewportSize();
  await page.mouse.move(2, Math.max(2, (size?.height || 400) - 2));
  await page.waitForTimeout(80);
}

async function shot(name) {
  const file = path.join(outDir, name);
  if (fs.existsSync(file) && fs.statSync(file).size > 1000) {
    console.log('skip', name);
    return;
  }
  await settle();
  await park();
  await page.screenshot({ path: file, animations: 'disabled', timeout: 15000 });
  console.log('ok', name);
}

function wanted(name) {
  if (process.env.VIEW && !name.includes(`-${process.env.VIEW}-`)) return false;
  return true;
}

async function openCalendar(theme, width, height, display) {
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
  await page.goto(`${preview}/launches?display=${display}`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForSelector('.cal-mode', { timeout: 25000 });
  await settle();
}

async function openComposer() {
  const side = page.locator('.c8-sidebar button[title="Composer"]');
  if (await side.isVisible().catch(() => false)) {
    await side.click();
  } else {
    await page.locator('button', { hasText: 'Composer' }).last().click();
  }
  const skip = page.getByRole('button', { name: 'Continue without set' });
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
  }
  await page.waitForSelector('.composer .po-pick', { timeout: 20000 });
  await page.waitForTimeout(600);
  const picks = await page.locator('.composer .po-pick').count();
  if (picks < 15) {
    throw new Error(`only ${picks} channels`);
  }
  const alive = await page.locator('.composer').count();
  if (!alive) {
    throw new Error('composer closed');
  }
  await settle();
}

async function dismissSure() {
  const no = page.locator('.po-sure-no');
  if (await no.isVisible().catch(() => false)) {
    await no.click();
    await page.waitForTimeout(200);
  }
}

async function closePopovers() {
  if (await page.locator('.po-date-pop').isVisible().catch(() => false)) {
    await page.locator('.po-date-chip').click();
  }
  if (await page.locator('.po-repeat-menu').isVisible().catch(() => false)) {
    await page.locator('.po-repeat').click();
  }
  if (await page.locator('.po-tags-menu').isVisible().catch(() => false)) {
    await page.locator('.po-tags').click();
  }
  if (await page.locator('.EmojiPickerReact').isVisible().catch(() => false)) {
    await page.locator('[data-tooltip-content="Insert Emoji"]').first().click();
  }
  if (await page.locator('.po-media-modal').isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
  await page.evaluate(() => {
    document.querySelectorAll('.po-post-menu').forEach((node) => {
      node.style.removeProperty('display');
    });
  });
  await dismissSure();
}

async function selectChannel() {
  const picked = await page.evaluate(() => {
    const picks = [...document.querySelectorAll('.po-pick')];
    const match = picks.find((node) => /x/i.test(node.querySelector('img')?.alt || '')) || picks[0];
    if (!match) return false;
    match.click();
    return true;
  });
  if (!picked) throw new Error('no channel pick');
  await page.waitForTimeout(200);
}

async function showPreview() {
  const tab = page.getByRole('tab', { name: 'Post Preview' });
  if (await tab.isVisible().catch(() => false)) {
    await tab.click();
    await settle();
  }
}

async function showEditor() {
  const tab = page.getByRole('tab', { name: 'Editor' });
  if (await tab.isVisible().catch(() => false)) {
    await tab.click();
    await settle();
  }
}

async function captureCreate(theme, width, height) {
  await openCalendar(theme, width, height, 'week');
  await openComposer();
  if (wanted(`${width}x${height}-create-empty-${theme}.png`)) {
    await shot(`${width}x${height}-create-empty-${theme}.png`);
  }
  if (wanted(`${width}x${height}-15-channels-${theme}.png`)) {
    await page.locator('.po-picks').scrollIntoViewIfNeeded();
    await shot(`${width}x${height}-15-channels-${theme}.png`);
  }

  await selectChannel();
  const editor = page.locator('.composer .ProseMirror').first();
  await editor.click();
  await page.keyboard.type('Launch week notes for Northwind.');
  await settle();

  if (wanted(`${width}x${height}-with-text-${theme}.png`)) {
    await showEditor();
    await shot(`${width}x${height}-with-text-${theme}.png`);
  }
  if (wanted(`${width}x${height}-channel-preview-${theme}.png`)) {
    await showPreview();
    await shot(`${width}x${height}-channel-preview-${theme}.png`);
    await showEditor();
  }
  if (wanted(`${width}x${height}-settings-${theme}.png`)) {
    await page.locator('.po-selected img').first().click();
    await page.locator('.po-settings-toggle, .po-settings > div').first().click();
    await page.waitForSelector('#social-settings :is(select, input, label, .c8-select-face)', { timeout: 8000 });
    await settle();
    await shot(`${width}x${height}-settings-${theme}.png`);
    await page.locator('.po-settings-toggle, .po-settings > div').first().click();
  }
  if (wanted(`${width}x${height}-date-picker-${theme}.png`)) {
    await page.locator('.po-date-chip').click();
    await page.waitForSelector('.po-date-pop', { timeout: 8000 });
    await settle();
    await shot(`${width}x${height}-date-picker-${theme}.png`);
    await page.locator('.po-date-chip').click();
  }
  if (wanted(`${width}x${height}-repeat-menu-${theme}.png`)) {
    await page.locator('.po-repeat').click();
    await page.waitForSelector('.po-repeat-menu', { timeout: 8000 });
    await settle();
    await shot(`${width}x${height}-repeat-menu-${theme}.png`);
    await page.locator('.po-repeat').click();
  }
  if (wanted(`${width}x${height}-tags-menu-${theme}.png`)) {
    await page.locator('.po-tags').click();
    await page.waitForSelector('.po-tags-menu', { timeout: 8000 });
    await settle();
    await shot(`${width}x${height}-tags-menu-${theme}.png`);
    await page.locator('.po-tags').click();
  }
  if (wanted(`${width}x${height}-postnow-open-${theme}.png`)) {
    await page.locator('.po-split-chevron').hover();
    await page.waitForSelector('.po-post-menu', { timeout: 8000 });
    await page.evaluate(() => {
      const menu = document.querySelector('.po-post-menu');
      if (menu) menu.style.setProperty('display', 'flex', 'important');
    });
    await settle();
    await shot(`${width}x${height}-postnow-open-${theme}.png`);
    await page.evaluate(() => {
      document.querySelectorAll('.po-post-menu').forEach((node) => {
        node.style.removeProperty('display');
      });
    });
  }
  if (wanted(`${width}x${height}-emoji-${theme}.png`)) {
    await page.evaluate(() => {
      document.querySelectorAll('.po-post-menu').forEach((node) => {
        node.style.setProperty('display', 'none', 'important');
      });
    });
    const clickEmoji = () =>
      page.evaluate(() => {
        const nodes = [...document.querySelectorAll('[data-tooltip-content]')].filter((item) =>
          /emoji/i.test(item.getAttribute('data-tooltip-content') || '')
        );
        const node = nodes.find((item) => {
          const box = item.getBoundingClientRect();
          return box.width > 8 && box.height > 8;
        });
        if (!node) return false;
        const scroller = node.closest('#social-content');
        if (scroller) {
          const top =
            node.getBoundingClientRect().top -
            scroller.getBoundingClientRect().top +
            scroller.scrollTop -
            80;
          scroller.scrollTop = Math.max(0, top);
        }
        node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        return true;
      });
    if (!(await clickEmoji())) throw new Error('emoji button missing');
    await page.waitForSelector('.EmojiPickerReact', { state: 'visible', timeout: 8000 });
    await settle();
    await shot(`${width}x${height}-emoji-${theme}.png`);
    await clickEmoji();
    await page.waitForSelector('.EmojiPickerReact', { state: 'hidden', timeout: 8000 });
  }
  if (wanted(`${width}x${height}-media-dialog-${theme}.png`)) {
    await page.evaluate(() => {
      const node = document.querySelector('.po-attach .cursor-pointer');
      const scroller = node?.closest('#social-content');
      if (node && scroller) {
        const top =
          node.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top +
          scroller.scrollTop -
          80;
        scroller.scrollTop = Math.max(0, top);
      }
      node?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await page.waitForSelector('.po-media-modal', { timeout: 8000 });
    await settle();
    await shot(`${width}x${height}-media-dialog-${theme}.png`);
    const cancelMedia = page.locator('.po-media-modal button', { hasText: 'Cancel' });
    if (await cancelMedia.isVisible().catch(() => false)) {
      await cancelMedia.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(250);
    await dismissSure();
  }
  if (wanted(`${width}x${height}-close-confirm-${theme}.png`)) {
    await page.locator('.composer-tabs .composer-close-phone').click();
    await page.waitForSelector('.po-sure-no', { timeout: 8000 });
    await settle();
    await shot(`${width}x${height}-close-confirm-${theme}.png`);
    await page.locator('.po-sure-no').click();
  }
}

async function captureEdit(theme, width, height) {
  const name = `${width}x${height}-edit-existing-${theme}.png`;
  if (!wanted(name)) return;
  await openCalendar(theme, width, height, 'list');
  const scheduled = page.locator('.cal-list-states div', { hasText: 'Scheduled' }).first();
  if (await scheduled.count()) {
    await scheduled.click();
  }
  await page.waitForSelector('.cal-post-body', { timeout: 15000 });
  await page.locator('.cal-post-body').first().click();
  await page.waitForSelector('.composer', { timeout: 20000 });
  await settle();
  await shot(name);
}

await unlock();

for (const theme of themes) {
  if (process.env.THEME && process.env.THEME !== theme) continue;
  for (const [width, height] of sizes) {
    if (process.env.SIZE && process.env.SIZE !== `${width}x${height}`) continue;
    const stamp = `${width}x${height}`;
    try {
      const createNames = views
        .filter((view) => view !== 'edit-existing')
        .map((view) => `${stamp}-${view}-${theme}.png`);
      const missingCreate = createNames.some(
        (name) => wanted(name) && !fs.existsSync(path.join(outDir, name))
      );
      if (missingCreate) {
        await captureCreate(theme, width, height);
      } else {
        console.log('skip create', stamp, theme);
      }
    } catch (error) {
      const message = error.message.split('\n')[0];
      console.log('FAIL create', stamp, theme, message);
      failures.push(`${stamp} create ${theme}: ${message}`);
      await page.screenshot({
        path: path.join(outDir, `${stamp}-create-fail-${theme}.png`),
        timeout: 8000,
      }).catch(() => {});
      await dismissSure().catch(() => {});
    }
    try {
      const editName = `${stamp}-edit-existing-${theme}.png`;
      if (wanted(editName) && !fs.existsSync(path.join(outDir, editName))) {
        await captureEdit(theme, width, height);
      }
    } catch (error) {
      const message = error.message.split('\n')[0];
      console.log('FAIL edit', stamp, theme, message);
      failures.push(`${stamp} edit ${theme}: ${message}`);
      await page.screenshot({
        path: path.join(outDir, `${stamp}-edit-fail-${theme}.png`),
        timeout: 8000,
      }).catch(() => {});
    }
  }
}

await browser.close();
const expected = sizes.length * themes.length * views.length;
console.log('shots expected', expected, 'failures', failures.length, 'blocked', blocked.length);
if (blocked.length) {
  console.log('blocked', [...new Set(blocked)].join(', '));
}
if (failures.length) {
  fs.writeFileSync(path.join(outDir, 'failures.txt'), failures.join('\n') + '\n');
  process.exit(1);
}
