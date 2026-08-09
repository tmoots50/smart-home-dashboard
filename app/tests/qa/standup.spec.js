import { test, expect } from '@playwright/test';
import { auditTapTargets, captureArtifact, collectErrors, freezeMotion } from './measure.js';

async function openStandup(page, state = 'typical') {
  const errors = collectErrors(page);
  await page.goto(`/harness.html?widget=standup&state=${state}&theme=light`);
  await freezeMotion(page);
  await expect(page.locator('html')).toHaveAttribute('data-harness-ready', '1');
  await expect(page.getByRole('heading', { name: 'Scrum Standup' })).toBeVisible();
  return errors;
}

test('standup/typical: matrix renders all agents, grouped basis, and overflow', async ({ page }, testInfo) => {
  const errors = await openStandup(page);

  await expect(page.locator('.agent-row')).toHaveCount(5);
  await expect(page.locator('.standup-cell')).toHaveCount(15);
  await expect(page.locator('.standup-cell .attribution')).toHaveText([
    'Grouped by route:ops',
    'Grouped by route:ops',
  ]);
  await expect(page.locator('.standup-cell .overflow-count')).toHaveText(['+2', '+1']);
  await expect(page.locator('.standup-cell--clear .standup-cell__title')).toHaveText([
    'No blockers',
    'No blockers',
    'No blockers',
  ]);

  const offenders = await auditTapTargets(page, { selector: '.standup-cell' });
  expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
  expect(errors).toEqual([]);
  await captureArtifact(page, 'standup', testInfo);
});

test('standup/typical: cell tap opens and closes in-context detail', async ({ page }) => {
  const errors = await openStandup(page);

  await page.locator('.standup-cell[data-agent="Smith"][data-column="yesterday"]').click();
  await expect(page.getByRole('dialog', { name: 'Agent routing repair' })).toBeVisible();
  await expect(page.locator('[data-detail-key]')).toHaveText('Smith · yesterday');
  await expect(page.locator('.standup-detail__items')).toContainText('PRO-118');

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Agent routing repair' })).toHaveCount(0);

  await page.locator('.standup-cell[data-agent="Derek"][data-column="blockers"]').click();
  const closeOffenders = await auditTapTargets(page, { selector: '[data-standup-close]' });
  expect(closeOffenders, JSON.stringify(closeOffenders, null, 2)).toEqual([]);
  await page.locator('[data-standup-close]').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.locator('.standup-cell[data-agent="Derek"][data-column="blockers"]').click();
  await page.mouse.click(4, 4);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveClass(/has-overlay/);
  expect(errors).toEqual([]);
});

test('standup/loading: condition is explicit', async ({ page }) => {
  await openStandup(page, 'loading');
  await expect(page.locator('.standup__status')).toHaveText('Loading Linear standup…');
});

test('standup/stale: last-known matrix stays visible with explicit freshness', async ({ page }) => {
  await openStandup(page, 'stale');
  await expect(page.locator('.agent-row')).toHaveCount(5);
  await expect(page.locator('.standup__notice')).toContainText('showing last-known data');
  await expect(page.locator('.standup__freshness')).toContainText('stale');
});

test('standup/unavailable: missing feed is honest and never replaced with demo rows', async ({ page }) => {
  await openStandup(page, 'unavailable');
  await expect(page.locator('.standup__status')).toHaveText('Linear standup is not configured.');
  await expect(page.locator('.agent-row')).toHaveCount(0);
  await expect(page.locator('.standup__freshness')).toHaveText('Linear · unavailable');
});

test('standup/truncated: omitted and unresolved records remain visible', async ({ page }) => {
  await openStandup(page, 'truncated');
  await expect(page.locator('.standup__coverage')).toContainText('3 additional cell entries omitted');
  await expect(page.locator('.standup__coverage')).toContainText('latest 100 issues');
  await expect(page.locator('.standup__unresolved')).toContainText('2 unassigned records');
  await expect(page.locator('.standup__unresolved')).toContainText('Grouped by project:Smart Home Dashboard');
});

test('standup edge fixtures: no updates, all clear, and QA pending stay explicit', async ({ page }) => {
  await openStandup(page, 'no-updates');
  await expect(page.locator('.standup-cell__title', { hasText: 'No updates' })).toHaveCount(10);

  await openStandup(page, 'all-clear');
  await expect(page.locator('.standup-cell__title', { hasText: 'No blockers' })).toHaveCount(5);

  await openStandup(page, 'qa-pending');
  await expect(page.locator('.quality--pending').first()).toHaveText('QA pending');
});
