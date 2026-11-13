import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const read = (path) => readFileSync(join(here, path), 'utf8');

// Opening tag only. Brace depth skips `=>` inside handlers.
function openingTag(source, marker) {
  const at = source.indexOf(marker);
  assert.ok(at >= 0, `missing ${marker}`);
  const start = source.lastIndexOf('<button', at);
  assert.ok(start >= 0, `${marker} is not on a button`);
  let quote = '';
  let brace = 0;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') brace += 1;
    else if (ch === '}') brace = Math.max(0, brace - 1);
    else if (ch === '>' && brace === 0) {
      return source.slice(start, i + 1);
    }
  }
  assert.fail(`unterminated button near ${marker}`);
}

function assertNamed(source, marker) {
  const tag = openingTag(source, marker);
  assert.match(tag, /aria-label=/, `${marker} icon button has no accessible name`);
  assert.match(
    tag,
    /data-tooltip-content=/,
    `${marker} name is not the tooltip text`
  );
}

const add = read('add.provider.component.tsx');
const launches = read('launches.component.tsx');
const menu = read('menu/menu.tsx');
const layout = read('../new-layout/layout.component.tsx');
const calendar = read('../../app/c8-calendar.scss');

assertNamed(add, 'className="channel-add');
assertNamed(add, 'className="channel-invite');
assertNamed(launches, 'className="channel-collapse');
assertNamed(menu, 'className="channel-menu-btn');

assert.match(add, /aria-label=\{addLabel\}/);
assert.match(add, /aria-label=\{inviteLabel\}/);
assert.match(add, /const addLabel = t\('add_channel', 'Add channel'\)/);
assert.match(add, /const inviteLabel = t\('invite_link_title', 'Invite link'\)/);
assert.match(launches, /aria-label=\{channelsPanelLabel\}/);
assert.match(launches, /Expand channels/);
assert.match(launches, /Collapse channels/);
assert.match(menu, /aria-label=\{channelMenuLabel\}/);
assert.match(menu, /Channel menu/);

assert.match(layout, /c8-shell-loading/);
const loadingHeader = calendar.slice(
  calendar.indexOf('.c8-shell-loading .app-header {'),
  calendar.indexOf('.c8-shell-loading .logo-word')
);
assert.match(loadingHeader, /position:\s*fixed/);
assert.match(loadingHeader, /top:\s*0/);
assert.match(loadingHeader, /height:\s*61px/);
assert.match(loadingHeader, /min-height:\s*61px/);
assert.match(
  calendar,
  /\.c8-shell-loading \.app-header \{\s*height:\s*44px !important;/
);
assert.match(calendar, /\.channel-menu-btn:focus-visible/);
const uiarc = read('../../app/uiarc.scss');
assert.match(uiarc, /\.channel-menu > button \{/);
assert.match(uiarc, /\.channel-menu > button > svg \{/);

console.log('schedule icon buttons have names; loading header is pinned');
