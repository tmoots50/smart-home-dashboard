import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const readme = readFileSync(resolve(repoRoot, 'README.md'), 'utf8');

test('README public overview describes the live wall dashboard', () => {
  assert.match(readme, /\*\*Status:\*\* live on the wall and in daily use since 2026-04-20\./);
  assert.match(readme, /Meswao Android tablet runs Fully Kiosk Browser/);
  assert.match(readme, /loads the dashboard from Cloudflare Pages/);
});

test('README public overview describes the current backend/data sources', () => {
  assert.match(readme, /Raspberry Pi hosts Home Assistant for live device control/);
  assert.match(readme, /Google Calendar and Google Tasks back the dashboard's calendar, todos, and groceries\./);
});

test('README public overview no longer advertises superseded launch/backend plans', () => {
  assert.doesNotMatch(readme, /in development/i);
  assert.doesNotMatch(readme, /target on-the-wall/i);
  assert.doesNotMatch(readme, /future back end/i);
  assert.doesNotMatch(readme, /Apple Notes/i);
});
