// Informational coverage report — which widgets are NOT yet harnessed.
// Never fails: going red on legacy widgets would train SKIP_QA reflexes.
// Instead it prints the gap on every run so it shrinks deliberately
// (CLAUDE.md: new/UX-touched widgets must ship with the harness trio).
import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test('coverage report: widgets without fixture states (informational)', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'canvas', 'report once, not per profile');

  const dir = 'src/widgets';
  const widgets = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.js') && !f.includes('.test.') && !f.includes('.fixtures.'))
    .map((f) => f.replace(/\.js$/, ''));
  const missing = widgets.filter((w) => !fs.existsSync(path.join(dir, `${w}.fixtures.js`)));
  const covered = widgets.length - missing.length;

  const msg = `harness coverage: ${covered}/${widgets.length} widgets — missing: ${missing.join(', ') || 'none'}`;
  testInfo.annotations.push({ type: 'harness-coverage', description: msg });
  console.log(`[coverage] ${msg}`);
  console.log('[coverage] (some are sub-components rendered via a parent — judgment applies; see CLAUDE.md "applicable")');
});
