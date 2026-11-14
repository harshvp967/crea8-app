import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../src/index.js';
import { REQUIRED_PATHS, channels, comingSoon, pages } from '../site/pages.mjs';
import { renderPage } from '../site/render.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

const REQUIRED_META = '<meta name="robots" content="noindex, nofollow">';
const BANNED = [/postiz/i, /30\+/, /\bINR\b/, /₹/, /AI video/i, /clipping/i, /\/auth\/(?:login|register)/];

function fail(message) {
  console.error(message);
  process.exitCode = 1;
  throw new Error(message);
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function buildFiles() {
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  await cp(path.join(root, 'site', 'site.css'), path.join(dist, 'site.css'));
  for (const file of await readdir(path.join(root, 'assets', 'brand'))) {
    await cp(path.join(root, 'assets', 'brand', file), path.join(dist, file));
  }
  await mkdir(path.join(dist, 'icons'), { recursive: true });
  for (const file of await readdir(path.join(root, 'assets', 'icons'))) {
    await cp(path.join(root, 'assets', 'icons', file), path.join(dist, 'icons', file));
  }
  await mkdir(path.join(dist, 'fonts'), { recursive: true });
  for (const font of ['inter-latin.woff2', 'bricolage-grotesque-latin.woff2']) {
    await cp(path.join(root, 'assets', 'fonts', font), path.join(dist, 'fonts', font));
  }
  await writeFile(path.join(dist, 'robots.txt'), 'User-agent: *\nDisallow: /\n');

  const seen = new Set();
  for (const page of pages) {
    if (seen.has(page.path)) fail(`Duplicate page ${page.path}`);
    seen.add(page.path);
    const file = path.join(dist, page.file);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, renderPage(page));
  }
}

function assertPages() {
  const paths = pages.map((page) => page.path);
  for (const required of REQUIRED_PATHS) {
    if (!paths.includes(required)) fail(`Missing page ${required}`);
  }
  if (!paths.includes('/404')) fail('Missing 404 page');
  if (paths.length !== REQUIRED_PATHS.length + 1) {
    fail(`Page list has ${paths.length} entries`);
  }
}

async function assertHtml() {
  const files = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.endsWith('.html')) files.push(full);
    }
  }
  await walk(dist);
  if (files.length !== pages.length) fail(`Expected ${pages.length} HTML files, found ${files.length}`);
  for (const file of files) {
    const html = await readFile(file, 'utf8');
    if (!html.includes(REQUIRED_META)) fail(`${file} is missing robots meta`);
    if (!html.includes('https://app.crea8.one/register')) fail(`${file} is missing Start`);
    if (!html.includes('https://app.crea8.one/login')) fail(`${file} is missing Log in`);
    if (!html.includes('https://app.crea8.one/privacy')) fail(`${file} is missing privacy`);
    if (!html.includes('https://app.crea8.one/terms')) fail(`${file} is missing terms`);
    if (!html.includes('crea8.one')) fail(`${file} is missing the brand`);
    for (const pattern of BANNED) {
      if (pattern.test(html)) fail(`${file} matches ${pattern}`);
    }
  }
  if (await exists(path.join(dist, 'sitemap.xml'))) fail('sitemap.xml must not exist');
  if (await exists(path.join(dist, 'sitemap.txt'))) fail('sitemap.txt must not exist');
  const robots = await readFile(path.join(dist, 'robots.txt'), 'utf8');
  if (robots !== 'User-agent: *\nDisallow: /\n') fail('robots.txt is not deny-all');
  const home = await readFile(path.join(dist, 'index.html'), 'utf8');
  for (const name of ['AI-first marketers', 'Developers', 'Automation teams']) {
    if (!home.includes(name)) fail(`Home is missing ${name}`);
  }
}

async function assertIcons() {
  for (const item of [...channels, ...comingSoon]) {
    const file = path.join(dist, 'icons', item.icon);
    if (!(await exists(file))) fail(`Missing icon ${item.icon}`);
  }
}

function assertConfig() {
  return readFile(path.join(root, 'wrangler.jsonc'), 'utf8').then((raw) => {
    const config = JSON.parse(raw);
    if (config.name !== 'crea8-marketing') fail('Worker name must be crea8-marketing');
    if (config.main !== 'src/index.js') fail('Worker main is wrong');
    if (config.assets?.directory !== './dist') fail('Assets directory must be ./dist');
    if (config.assets?.not_found_handling !== '404-page') fail('404 handling must be 404-page');
    if (config.assets?.run_worker_first !== true) fail('Worker must run first on every request');
    const bannedKey = findKey(config, new Set(['routes', 'route', 'custom_domain', 'custom_domains']));
    if (bannedKey) fail(`Wrangler config sets ${bannedKey}`);
  });
}

function findKey(value, banned) {
  if (!value || typeof value !== 'object') return '';
  for (const [key, child] of Object.entries(value)) {
    if (banned.has(key)) return key;
    const nested = findKey(child, banned);
    if (nested) return nested;
  }
  return '';
}

async function assertWorker() {
  const source = await readFile(path.join(root, 'src', 'index.js'), 'utf8');
  if (!source.includes("'X-Robots-Tag'") || !source.includes("'noindex, nofollow'")) {
    fail('Worker does not set X-Robots-Tag');
  }
  const calls = [];
  const env = {
    ASSETS: {
      async fetch(request) {
        calls.push(new URL(request.url).pathname);
        const missing = new URL(request.url).pathname === '/missing';
        return new Response(missing ? 'missing' : 'asset', {
          status: missing ? 404 : 200,
          headers: { 'content-type': 'text/plain' },
        });
      },
    },
  };
  const headerOf = async (pathname) => {
    const response = await worker.fetch(new Request(`https://crea8.one${pathname}`), env);
    return { response, header: response.headers.get('X-Robots-Tag'), body: await response.text() };
  };
  for (const pathname of ['/', '/schedule', '/site.css', '/missing']) {
    const { header } = await headerOf(pathname);
    if (header !== 'noindex, nofollow') fail(`${pathname} header is ${header}`);
  }
  const robots = await headerOf('/robots.txt');
  if (robots.header !== 'noindex, nofollow' || robots.body !== 'User-agent: *\nDisallow: /\n') {
    fail('Worker robots.txt is wrong');
  }
  if (calls.includes('/robots.txt')) fail('robots.txt was served from assets');
  const sitemap = await headerOf('/sitemap.xml');
  if (sitemap.response.status !== 404 || sitemap.header !== 'noindex, nofollow') {
    fail('sitemap.xml was not denied');
  }
  if (calls.includes('/sitemap.xml')) fail('sitemap.xml was served from assets');
}

assertPages();
await buildFiles();
await assertHtml();
await assertIcons();
await assertConfig();
await assertWorker();
console.log(`Built ${pages.length} HTML files in ${dist}`);
