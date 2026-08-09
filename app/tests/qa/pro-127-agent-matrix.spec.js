import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { auditTapTargets, collectErrors, freezeMotion } from './measure.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const previewUrl = pathToFileURL(
  path.join(repoRoot, '_context/mockups/2026-08-09-scrum-standup/direction-a-agent-matrix.html'),
).href;

async function openPreview(page) {
  const errors = collectErrors(page);
  await page.goto(previewUrl);
  await freezeMotion(page);
  await expect(page.getByRole('heading', { name: 'Scrum Standup' })).toBeVisible();
  return errors;
}

test('PRO-127 matrix preview: fixed agent/status grid is touch-safe', async ({ page }) => {
  const errors = await openPreview(page);

  await expect(page.locator('.agent-row')).toHaveCount(5);
  await expect(page.locator('.standup-cell')).toHaveCount(15);
  await expect(page.locator('.briefing__stack > .card').nth(0)).toHaveAccessibleName('Scrum standup');
  await expect(page.locator('.briefing__stack > .card').nth(1)).toHaveAccessibleName('Home context');

  const offenders = await auditTapTargets(page, { selector: 'button' });
  expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
  expect(errors).toEqual([]);
});

test('PRO-127 matrix preview: real cell taps open and close in-context Linear detail', async ({ page }) => {
  const errors = await openPreview(page);

  await page.locator('.standup-cell[data-agent="Derek"][data-column="blockers"]').click();
  await expect(page.getByRole('dialog', { name: 'API field decision' })).toBeVisible();
  await expect(page.locator('[data-detail-key]')).toHaveText('Derek · blockers');
  await expect(page.locator('[data-detail-note]')).toHaveText('Awaiting input on the quality payload shape.');

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'API field decision' })).toBeHidden();

  await page.locator('[data-theme-toggle]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'cosy');
  await expect(page.locator('[data-theme-toggle]')).toHaveText('Switch to fun');
  expect(errors).toEqual([]);
});

test('PRO-127 matrix preview: observable guardrails show grouping basis and overflow indicator', async ({ page }) => {
  await openPreview(page);

  await expect(page.locator('.standup-cell--clear .standup-cell__title')).toHaveText([
    'No blockers',
    'No blockers',
    'No blockers',
  ]);

  const groupedLabels = await page.locator('.standup-cell .attribution').allTextContents();
  expect.soft(groupedLabels).toEqual(['Grouped by route:ops', 'Grouped by route:ops']);

  const overflowIndicators = await page.locator('.standup-cell').filter({ hasText: /\+\d+/ }).count();
  expect.soft(overflowIndicators).toBeGreaterThan(0);
});
