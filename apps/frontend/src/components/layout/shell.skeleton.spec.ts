import assert from 'assert';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  insertComposer,
  primaryNavNames,
  shellSkeletonNavNames,
} from './shell.nav.ts';

const here = dirname(fileURLToPath(import.meta.url));
const layout = readFileSync(
  join(here, '../new-layout/layout.component.tsx'),
  'utf8'
);
const menu = readFileSync(join(here, 'top.menu.tsx'), 'utf8');
const sidebar = readFileSync(join(here, 'c8.sidebar.tsx'), 'utf8');
const skeleton = layout.slice(
  layout.indexOf('export const AppShellSkeleton'),
  layout.indexOf('export const LayoutComponent')
);
const live = layout.slice(layout.indexOf('export const LayoutComponent'));
const legacyPhoneTabs = ['Calendar', 'Composer', 'Agent', 'Analytics', 'More'];

assert.deepStrictEqual(
  shellSkeletonNavNames(),
  insertComposer(primaryNavNames(), 'Composer')
);
assert.notDeepStrictEqual(shellSkeletonNavNames(), legacyPhoneTabs);
assert.ok(skeleton.includes('<C8Sidebar'));
assert.ok(!skeleton.includes('<MobileTabBar'));
assert.ok(!skeleton.includes('h-[28px] w-[28px] rounded-full'));
for (const label of legacyPhoneTabs) {
  assert.ok(!skeleton.includes(`>${label}<`), label);
}
assert.ok(menu.includes('primaryNav.map'));
assert.ok(sidebar.includes('insertComposer('));
assert.ok(live.includes('<MobileTabBar'));

console.log('shell skeleton nav matches the live schedule nav');
