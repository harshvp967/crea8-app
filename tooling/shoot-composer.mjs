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
  'no-channel',
  'error-toast',
  'all-channels',
  'tags-sheet',
  'repeat-sheet',
  'date-picker',
  'date-picker-time',
  'customer-dropdown',
  'discard-confirm',
  'add-signature',
  'emoji-picker',
  'add-comment',
  'delay-popover',
  'postnow-menu',
  'channel-settings',
  'post-preview',
  'media-library',
];
const misses = [];

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
  if (pathname === '/integrations/list' && Array.isArray(json?.integrations)) {
    let named = json.integrations.some((item) => item?.customer?.id && item?.customer?.name);
    if (!named) {
      const channel = json.integrations.find((item) => item?.id) || json.integrations[0];
      if (channel) {
        channel.customer = { id: 'cust-northwind', name: 'Northwind' };
      }
    }
    return Buffer.from(JSON.stringify(json));
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
        const list = parsed.pathname === '/integrations/function';
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: cors,
          body: list ? '[]' : '{}',
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


function fileName(width, height, state, theme) {
  return `${width}x${height}-${state}-${theme}.png`;
}

async function miss(name, reason) {
  misses.push(`${name}: ${reason}`);
  console.log('MISS', name, reason);
}

async function visible(selector) {
  return page.locator(selector).first().isVisible().catch(() => false);
}

async function closeSheet(opener, menu) {
  if (!(await visible(menu))) return;
  const trigger = page.locator(opener).first();
  if (await trigger.isVisible().catch(() => false)) {
    await trigger.click({ timeout: 4000 }).catch(() => {});
  }
  if (await visible(menu)) {
    await page.locator('.composer-tabs-title').first().click({ timeout: 4000 }).catch(() => {});
  }
  await page.waitForTimeout(150);
}

async function selectAllChannels() {
  const picks = page.locator('.composer .po-pick');
  const count = await picks.count();
  for (let index = 0; index < count; index += 1) {
    const pick = picks.nth(index);
    const selected = await pick.evaluate((node) => node.classList.contains('is-on')).catch(() => false);
    if (selected) continue;
    await pick.scrollIntoViewIfNeeded().catch(() => {});
    await pick.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(40);
  }
  await page.waitForSelector('.po-selected', { timeout: 8000 });
  await settle();
}

async function captureStates(theme, width, height) {
  const name = (state) => fileName(width, height, state, theme);
  await openCalendar(theme, width, height, 'week');
  await openComposer();

  if (wanted(name('no-channel'))) {
    await shot(name('no-channel'));
  }

  if (wanted(name('error-toast'))) {
    const cta = page.locator('.po-split-main').first();
    const disabled = await cta.isDisabled().catch(() => true);
    if (disabled) {
      await miss(name('error-toast'), 'CTA is disabled until a channel is selected and does not raise a toast');
    } else {
      await cta.click();
      const toast = page.locator('.app-toast');
      try {
        await toast.waitFor({ state: 'visible', timeout: 4000 });
        await shot(name('error-toast'));
      } catch {
        await miss(name('error-toast'), 'CTA click did not show an error toast');
      }
    }
  }

  if (wanted(name('all-channels')) || wanted(name('tags-sheet')) || wanted(name('repeat-sheet')) || wanted(name('date-picker')) || wanted(name('date-picker-time')) || wanted(name('customer-dropdown')) || wanted(name('discard-confirm')) || wanted(name('add-signature')) || wanted(name('emoji-picker')) || wanted(name('add-comment')) || wanted(name('delay-popover')) || wanted(name('postnow-menu')) || wanted(name('channel-settings')) || wanted(name('post-preview')) || wanted(name('media-library'))) {
    await selectAllChannels();
  }

  if (wanted(name('all-channels'))) {
    await page.locator('.po-current-row').scrollIntoViewIfNeeded();
    if (await visible('.po-selected')) {
      await shot(name('all-channels'));
    } else {
      await miss(name('all-channels'), 'selected-channel pill did not render');
    }
  }

  if (wanted(name('tags-sheet'))) {
    try {
      await page.locator('.po-tags').first().click({ timeout: 8000 });
      await page.waitForSelector('.po-tags-menu', { state: 'visible', timeout: 8000 });
      await shot(name('tags-sheet'));
    } catch {
      await miss(name('tags-sheet'), 'tags menu did not open');
    }
    await closeSheet('.po-tags', '.po-tags-menu');
  }

  if (wanted(name('repeat-sheet'))) {
    try {
      await page.locator('.po-repeat').first().click({ timeout: 8000 });
      await page.waitForSelector('.po-repeat-menu', { state: 'visible', timeout: 8000 });
      await shot(name('repeat-sheet'));
    } catch {
      await miss(name('repeat-sheet'), 'repeat menu did not open');
    }
    await closeSheet('.po-repeat', '.po-repeat-menu');
  }

  if (wanted(name('date-picker')) || wanted(name('date-picker-time'))) {
    try {
      await page.locator('.po-date-chip').first().click({ timeout: 8000 });
      await page.waitForSelector('.po-date-pop', { state: 'visible', timeout: 8000 });
      if (wanted(name('date-picker'))) await shot(name('date-picker'));
    } catch (error) {
      if (wanted(name('date-picker'))) await miss(name('date-picker'), error.message.split('\n')[0]);
      if (wanted(name('date-picker-time'))) await miss(name('date-picker-time'), 'date picker did not open');
    }
    if (wanted(name('date-picker-time')) && (await visible('.po-date-pop'))) {
      try {
        const opened = await page.locator('.po-date-pop .po-date-native, .po-date-pop .po-date-clock').first().evaluate((node) => {
          const input = node.matches('input') ? node : node.querySelector('input');
          const target = input || node;
          target.focus();
          target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          return document.activeElement === target || document.activeElement === input;
        });
        await settle();
        if (!opened) throw new Error('time field did not take focus');
        await shot(name('date-picker-time'));
      } catch (error) {
        await miss(name('date-picker-time'), error.message.split('\n')[0]);
      }
    } else if (wanted(name('date-picker-time')) && !(await visible('.po-date-pop'))) {
      const timeFile = path.join(outDir, name('date-picker-time'));
      if (!fs.existsSync(timeFile)) {
        await miss(name('date-picker-time'), 'date picker did not open');
      }
    }
    if (await visible('.po-date-close')) {
      await page.locator('.po-date-close').click({ timeout: 4000 }).catch(() => {});
    } else if (await visible('.po-date-pop')) {
      await page.locator('.po-date-chip').first().click({ timeout: 4000 }).catch(() => {});
    }
    await page.waitForTimeout(150);
  }

  if (wanted(name('customer-dropdown'))) {
    const customer = page.locator('.composer .select-customer').first();
    const customerTrigger = customer.locator('> div').first();
    if (!(await customer.count())) {
      await miss(name('customer-dropdown'), 'no named customer on the intercepted channel list');
    } else {
      await customer.scrollIntoViewIfNeeded().catch(() => {});
      try {
      await customerTrigger.click({ timeout: 8000 });
        await page.waitForSelector('.composer .customer-menu', { state: 'visible', timeout: 8000 });
        await shot(name('customer-dropdown'));
        await page.evaluate(() => {
          document.querySelectorAll('.composer .customer-menu').forEach((node) => {
            node.style.pointerEvents = 'none';
          });
        });
        await customerTrigger.click({ timeout: 5000 });
        if (await visible('.composer .customer-menu')) {
          await page.locator('.composer-tabs-title').first().click({ timeout: 4000 }).catch(() => {});
        }
      } catch {
        await miss(name('customer-dropdown'), 'customer menu did not open');
      }
    }
  }

  if (wanted(name('discard-confirm'))) {
    const editor = page.locator('.composer .ProseMirror').first();
    if (await editor.isVisible().catch(() => false)) {
      await editor.click({ timeout: 5000 }).catch(() => {});
      await page.keyboard.type('Note');
    }
    try {
      await page.locator('.composer .composer-close-phone').first().click({ timeout: 8000 });
      await page.waitForSelector('.po-sure-no', { state: 'visible', timeout: 8000 });
      await shot(name('discard-confirm'));
      const keep = page.getByRole('button', { name: 'Keep editing' });
      if (await keep.isVisible().catch(() => false)) {
        await keep.click({ timeout: 5000 }).catch(() => {});
      }
      if (await visible('.po-sure-modal')) {
        await page.keyboard.press('Escape');
      }
      await page.waitForSelector('.po-sure-modal', { state: 'hidden', timeout: 4000 });
    } catch {
      await miss(name('discard-confirm'), 'discard confirmation did not open');
    }
  }

  if (wanted(name('add-signature'))) {
    const pen = page.locator('.composer-editor [aria-label="Add signature"]').first();
    if (!(await pen.isVisible().catch(() => false))) {
      await miss(name('add-signature'), 'signature button is not visible');
    } else {
      try {
        const opened = await pen.evaluate((node) => {
          node.scrollIntoView({ block: 'center', inline: 'center' });
          node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          return true;
        });
        if (!opened) throw new Error('signature button missing');
        await page.getByText('Add Signature').last().waitFor({ state: 'visible', timeout: 8000 });
        await shot(name('add-signature'));
        const close = page.locator('.mantine-Modal-close').last();
        if (await close.isVisible().catch(() => false)) await close.click();
        else await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      } catch {
        await miss(name('add-signature'), 'signature dialog did not open');
      }
    }
  }

  if (wanted(name('emoji-picker'))) {
    const opened = await page.evaluate(() => {
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
        const top = node.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 80;
        scroller.scrollTop = Math.max(0, top);
      }
      node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      return true;
    });
    if (!opened) {
      await miss(name('emoji-picker'), 'emoji button is not visible');
    } else {
      try {
        await page.waitForSelector('.EmojiPickerReact', { state: 'visible', timeout: 8000 });
        await shot(name('emoji-picker'));
        await page.evaluate(() => {
          const nodes = [...document.querySelectorAll('[data-tooltip-content]')].filter((item) =>
            /emoji/i.test(item.getAttribute('data-tooltip-content') || '')
          );
          const node = nodes.find((item) => item.getBoundingClientRect().width > 8);
          node?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        });
        await page.waitForTimeout(200);
      } catch {
        await miss(name('emoji-picker'), 'emoji picker did not open');
      }
    }
  }

  if (wanted(name('add-comment')) || wanted(name('delay-popover'))) {
    const add = page.locator('.po-add-row').first();
    if (!(await add.isVisible().catch(() => false))) {
      if (wanted(name('add-comment'))) await miss(name('add-comment'), 'add comment control is not visible');
      if (wanted(name('delay-popover'))) await miss(name('delay-popover'), 'add comment control is not visible');
    } else {
      await add.scrollIntoViewIfNeeded();
      await add.click();
      await settle();
      if (wanted(name('add-comment'))) await shot(name('add-comment'));
      if (wanted(name('delay-popover'))) {
        const delay = page.locator('.po-delay').first();
        if (!(await delay.isVisible().catch(() => false))) {
          await miss(name('delay-popover'), 'delay control did not appear on the new comment');
        } else {
          await delay.click();
          try {
            await page.getByPlaceholder('Custom min').waitFor({ state: 'visible', timeout: 8000 });
            await shot(name('delay-popover'));
            await page.locator('.composer-tabs-title').first().click({ timeout: 4000 });
          } catch {
            await miss(name('delay-popover'), 'delay popover did not open');
          }
        }
      }
    }
  }

  if (wanted(name('postnow-menu'))) {
    const chevron = page.locator('.composer .po-split-chevron').first();
    if (!(await chevron.isVisible().catch(() => false))) {
      await miss(name('postnow-menu'), 'post now chevron is not visible');
    } else {
      try {
        await chevron.scrollIntoViewIfNeeded();
        await chevron.click({ timeout: 8000 });
        const opened = await page.locator('.po-post-menu').isVisible().catch(() => false);
        if (!opened) {
          await chevron.evaluate((node) => {
            node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          });
        }
        await page.waitForSelector('.po-post-menu', { state: 'visible', timeout: 8000 });
        await shot(name('postnow-menu'));
        await page.locator('.composer-tabs-title').first().click({ timeout: 4000 }).catch(() => {});
      } catch {
        await miss(name('postnow-menu'), 'post now menu did not open');
        await page.locator('.composer-tabs-title').first().click({ timeout: 3000 }).catch(() => {});
      }
    }
  }

  if (wanted(name('channel-settings'))) {
    const channel = page.locator('.composer .po-selected').first();
    if (!(await channel.isVisible().catch(() => false))) {
      await miss(name('channel-settings'), 'no selected channel to open settings');
    } else {
      const toggle = page.locator('.po-settings-toggle').first();
      try {
        await channel.scrollIntoViewIfNeeded();
        await channel.evaluate((node) => {
          const target = node.querySelector('img') || node;
          target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        });
        await toggle.waitFor({ state: 'visible', timeout: 8000 });
        await toggle.click({ timeout: 8000 });
        await page.waitForFunction(() => {
          const root = document.querySelector('#social-settings');
          if (!root) return false;
          return [...root.children].some((node) => {
            const style = getComputedStyle(node);
            return style.display !== 'none' && node.getBoundingClientRect().height > 24;
          });
        }, { timeout: 8000 });
        await page.locator('#social-settings').scrollIntoViewIfNeeded();
        await shot(name('channel-settings'));
        await toggle.click();
      } catch {
        await miss(name('channel-settings'), 'channel settings did not expand');
      }
    }
  }

  if (wanted(name('post-preview'))) {
    const tab = page.getByRole('tab', { name: 'Post Preview' });
    if (await tab.isVisible().catch(() => false)) {
      await tab.click({ timeout: 8000 }).catch(() => {});
      await settle();
    }
    const preview = page.locator('.composer-preview');
    if (await preview.isVisible().catch(() => false)) {
      await shot(name('post-preview'));
    } else {
      await miss(name('post-preview'), 'preview pane is not visible');
    }
    const editorTab = page.getByRole('tab', { name: 'Editor' });
    if (await editorTab.isVisible().catch(() => false)) {
      await editorTab.click({ timeout: 8000 }).catch(() => {});
      await settle();
    }
  }

  if (wanted(name('media-library'))) {
    const opened = await page.evaluate(() => {
      const node = document.querySelector('.po-attach .cursor-pointer, .po-attach button');
      if (!node) return false;
      const scroller = node.closest('#social-content');
      if (scroller) {
        const top = node.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 80;
        scroller.scrollTop = Math.max(0, top);
      }
      node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      return true;
    });
    if (!opened) {
      await miss(name('media-library'), 'media button is not visible');
    } else {
      try {
        await page.waitForSelector('.po-media-modal', { state: 'visible', timeout: 8000 });
        await shot(name('media-library'));
        const cancelMedia = page.locator('.po-media-modal button', { hasText: 'Cancel' });
        if (await cancelMedia.isVisible().catch(() => false)) await cancelMedia.click();
        else await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      } catch {
        await miss(name('media-library'), 'media library did not open');
      }
    }
  }
}

await unlock();

for (const theme of themes) {
  if (process.env.THEME && process.env.THEME !== theme) continue;
  for (const [width, height] of sizes) {
    if (process.env.SIZE && process.env.SIZE !== `${width}x${height}`) continue;
    const stamp = `${width}x${height}`;
    const needed = views.some((view) => view !== 'error-toast' && wanted(fileName(width, height, view, theme)) && !fs.existsSync(path.join(outDir, fileName(width, height, view, theme))));
    if (!needed) {
      console.log('skip', stamp, theme);
      continue;
    }
    try {
      await captureStates(theme, width, height);
    } catch (error) {
      const message = error.message.split('\n')[0];
      console.log('FAIL', stamp, theme, message);
      failures.push(`${stamp} ${theme}: ${message}`);
      await page.screenshot({
        path: path.join(outDir, `${stamp}-fail-${theme}.png`),
        timeout: 8000,
      }).catch(() => {});
      await dismissSure().catch(() => {});
      await page.keyboard.press('Escape').catch(() => {});
    }
  }
}

await browser.close();
const expected = sizes.length * themes.length * views.length;
const uniqueMisses = [...new Set(misses)];
console.log('shots expected', expected, 'failures', failures.length, 'misses', uniqueMisses.length, 'blocked', blocked.length);
if (blocked.length) console.log('blocked', [...new Set(blocked)].join(', '));
if (uniqueMisses.length) {
  fs.writeFileSync(path.join(outDir, 'misses.txt'), uniqueMisses.join('\n') + '\n');
  console.log(uniqueMisses.join('\n'));
}
if (failures.length) {
  fs.writeFileSync(path.join(outDir, 'failures.txt'), failures.join('\n') + '\n');
  process.exit(1);
}
