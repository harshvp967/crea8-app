import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// esbuild follows jsdom's require("canvas") into the real package and stops
// on the native addon, which Workers cannot load. jsdom already treats a
// failed require as "no canvas". Swap the package entry for this build only.
const require = createRequire(import.meta.url);
const canvasEntry = require.resolve('canvas');
const original = readFileSync(canvasEntry);
const stub = `'use strict';
const error = new Error('node-canvas is not available on Cloudflare Workers');
error.code = 'MODULE_NOT_FOUND';
throw error;
`;

writeFileSync(canvasEntry, stub);
let status = 1;
try {
  const result = spawnSync('opennextjs-cloudflare', ['build'], {
    stdio: 'inherit',
    env: { ...process.env, OPENNEXT_CLOUDFLARE: '1' },
  });
  status = result.status ?? 1;
} finally {
  writeFileSync(canvasEntry, original);
}
process.exit(status);
