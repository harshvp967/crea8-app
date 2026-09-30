/**
 * Rewrites the root package.json inside a production image build so pnpm
 * installs the backend/orchestrator runtime set plus the compiler, then
 * `pnpm prune --prod` can drop the compiler.
 *
 * The workspace app manifests do not declare dependencies (they all live in
 * the root package.json), so `pnpm deploy --filter postiz-backend` would
 * ship an empty node_modules. This script is the equivalent: keep the
 * packages the server entrypoints actually import, at the same specifiers
 * already pinned in package.json.
 *
 * It is only meant to run against a copy of the repo inside Docker. It must
 * not be run in the checkout that Vercel or local dev uses.
 */
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const pkgPath = path.join(rootDir, 'package.json');
const original = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const alias = {
  '@gitroom/backend/': 'apps/backend/src/',
  '@gitroom/frontend/': 'apps/frontend/src/',
  '@gitroom/helpers/': 'libraries/helpers/src/',
  '@gitroom/nestjs-libraries/': 'libraries/nestjs-libraries/src/',
  '@gitroom/react/': 'libraries/react-shared-libraries/src/',
  '@gitroom/plugins/': 'libraries/plugins/src/',
  '@gitroom/orchestrator/': 'apps/orchestrator/src/',
  '@gitroom/extension/': 'apps/extension/src/',
};

const builtins = new Set([
  'assert',
  'async_hooks',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'diagnostics_channel',
  'dns',
  'domain',
  'events',
  'fs',
  'http',
  'http2',
  'https',
  'inspector',
  'module',
  'net',
  'os',
  'path',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'timers',
  'tls',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'wasi',
  'worker_threads',
  'zlib',
]);

const exts = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];

function resolveFile(spec) {
  const candidates = [spec];
  for (const ext of exts) candidates.push(spec + ext);
  for (const ext of exts) candidates.push(path.join(spec, 'index' + ext));
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

function resolveImport(fromFile, spec) {
  if (spec.startsWith('.')) {
    return resolveFile(path.resolve(path.dirname(fromFile), spec));
  }
  for (const [prefix, dest] of Object.entries(alias)) {
    if (spec === prefix.slice(0, -1) || spec.startsWith(prefix)) {
      const rest = spec.startsWith(prefix) ? spec.slice(prefix.length) : '';
      return resolveFile(path.join(rootDir, dest, rest));
    }
  }
  return null;
}

function packageName(spec) {
  const bare = spec.startsWith('node:') ? spec.slice(5) : spec;
  const head = bare.startsWith('@')
    ? bare.split('/').slice(0, 2).join('/')
    : bare.split('/')[0];
  if (builtins.has(head)) return null;
  return head;
}

const specRe =
  /(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]|require(?:\.resolve)?\(\s*['"]([^'"]+)['"]\s*\)|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function specsOf(file) {
  const text = fs.readFileSync(file, 'utf8');
  const found = [];
  for (const match of text.matchAll(specRe)) {
    found.push(match[1] || match[2] || match[3]);
  }
  return found;
}

const entries = [
  path.join(rootDir, 'apps/backend/src/main.ts'),
  path.join(rootDir, 'apps/orchestrator/src/main.ts'),
];

const seen = new Set();
const queue = [...entries];
const external = new Set();
const unresolved = [];

while (queue.length) {
  const file = queue.pop();
  if (!file || seen.has(file)) continue;
  seen.add(file);
  let specs;
  try {
    specs = specsOf(file);
  } catch {
    continue;
  }
  for (const spec of specs) {
    if (!spec) continue;
    const resolved = resolveImport(file, spec);
    if (resolved) {
      if (!seen.has(resolved)) queue.push(resolved);
      continue;
    }
    if (spec.startsWith('.') || spec.startsWith('@gitroom/')) {
      unresolved.push(`${spec} from ${path.relative(rootDir, file)}`);
      continue;
    }
    const name = packageName(spec);
    if (name) external.add(name);
  }
}

if (unresolved.length) {
  console.error(unresolved.slice(0, 20).join('\n'));
  throw new Error(
    `Could not resolve ${unresolved.length} workspace import(s). The image would boot with missing files.`
  );
}

// Imported at runtime but absent from the root manifest. Nest pulls
// source-map-support transitively today; pin the lockfile version so prune
// cannot drop it when the parent package is a devDependency.
const fallbackSpecifiers = {
  'source-map-support': '0.5.21',
};

// Required by emitted helpers / Nest / ws even when no source file imports them.
const extraRuntime = [
  'rxjs',
  'tslib',
  'reflect-metadata',
  'bufferutil',
  'utf-8-validate',
  'source-map-support',
];

for (const name of extraRuntime) external.add(name);

const buildToolNames = new Set([
  'typescript',
  'prisma',
  '@nestjs/cli',
  '@nestjs/schematics',
  'cross-env',
]);

function specifierFor(name) {
  return (
    original.dependencies?.[name] ||
    original.devDependencies?.[name] ||
    fallbackSpecifiers[name] ||
    null
  );
}

const dependencies = {};
const skippedTransitive = [];
for (const name of [...external].sort()) {
  if (buildToolNames.has(name)) continue;
  const spec = specifierFor(name);
  if (!spec) {
    skippedTransitive.push(name);
    continue;
  }
  dependencies[name] = spec;
}

const devDependencies = {};
for (const name of buildToolNames) {
  const spec = specifierFor(name);
  if (!spec) throw new Error(`Missing build tool specifier for ${name}`);
  devDependencies[name] = spec;
}
// Every @types package from the root manifest. Several live in dependencies
// (@types/multer, @types/mime) and augment globals or override a package's
// own types. Missing them makes `nest build` fail even though the full
// workspace install typechecks. They are devDependencies here so
// `pnpm prune --prod` does not ship them.
for (const [name, spec] of Object.entries({
  ...(original.devDependencies || {}),
  ...(original.dependencies || {}),
})) {
  if (name.startsWith('@types/')) devDependencies[name] = spec;
}
// The full workspace install hoists @types/jsdom from jest-environment-jsdom.
// jsdom 22 itself ships no types; without this package `Array.from` on a
// jsdom NodeList collapses to unknown[] under TypeScript 5.5 and `nest build`
// fails. Same version the lockfile already resolves.
devDependencies['@types/jsdom'] = '20.0.1';

const rewritten = {
  ...original,
  dependencies,
  devDependencies,
  scripts: {
    ...original.scripts,
    // prisma generate is run explicitly in the image build. The root
    // postinstall shells out to pnpm dlx, which we do not want here.
    postinstall: 'node -e "process.exit(0)"',
  },
};

fs.writeFileSync(pkgPath, JSON.stringify(rewritten, null, 2) + '\n');

const npmrcPath = path.join(rootDir, '.npmrc');
if (fs.existsSync(npmrcPath)) {
  const npmrc = fs
    .readFileSync(npmrcPath, 'utf8')
    .split('\n')
    .filter((line) => !line.startsWith('restrict-manifest-changes'))
    .join('\n');
  fs.writeFileSync(npmrcPath, npmrc.endsWith('\n') ? npmrc : npmrc + '\n');
}

console.log(
  `Server runtime dependencies: ${Object.keys(dependencies).length}. Build-only: ${Object.keys(devDependencies).length}. Reachable files: ${seen.size}.`
);
console.log(
  `Left as transitive dependencies (installed by their parents): ${skippedTransitive.sort().join(', ') || '(none)'}`
);
