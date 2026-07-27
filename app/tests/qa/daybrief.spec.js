// QA spec — Morning Brief (daybrief) card. Geometry across every fixture
// state and flavor, the hidden-when-empty contract, the 44px clear control,
// bold-markdown rendering, and clear → undo-toast behavior.
import { test, expect } from '@playwright/test';
import { states } from '../../src/widgets/daybrief.fixtures.js';
import { FIXED_NOW } from './clock.js';
import { captureArtifact, collectErrors, freezeMotion } from './measure.js';
import { expectHarnessGeometry } from './widget-harness.js';

const FLAVORS = ['letter', 'columns', 'split', 'agenda'];

// Local open(): openHarness plus the daybrief harness entry's ?flavor knob.
async function open(page, state, flavor = 'letter') {
  await page.clock.install({ time: FIXED_NOW });
  await page.goto(`/harness.html?widget=daybrief&state=${state}&flavor=${flavor}`);
  await freezeMotion(page);
  await expect(page.locator('html[data-harness-ready]')).toBeAttached();
}

test('daybrief/empty: no blob → the card stays hidden entirely', async ({ page }) => {
  await open(page, 'empty');
  await expect(page.locator('.daybrief')).toBeHidden();
  expect(await page.locator('.daybrief').innerHTML()).toBe('');
});

for (const state of Object.keys(states).filter(s => s !== 'empty')) {
  test(`daybrief/${state}: letter geometry`, async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    await open(page, state);
    await expect(page.locator('.daybrief')).toBeVisible();
    await expectHarnessGeometry(page);
    await captureArtifact(page, `daybrief-${state}`, testInfo);
    expect(errors).toEqual([]);
  });
}

for (const flavor of FLAVORS) {
  test(`daybrief/real-monday: ${flavor} flavor geometry`, async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    await open(page, 'real-monday', flavor);
    await expect(page.locator('.daybrief')).toBeVisible();
    await expectHarnessGeometry(page);
    await captureArtifact(page, `daybrief-real-monday-${flavor}`, testInfo);
    expect(errors).toEqual([]);
  });
}

test('daybrief/real-monday: letter shows Headlines prose with bold ledes + rail', async ({ page }) => {
  await open(page, 'real-monday', 'letter');
  await expect(page.locator('.daybrief__section-label').first()).toContainText('Headlines');
  // Beat-reporter contract: every paragraph opens with a <strong> lede.
  const paras = page.locator('.daybrief__body p');
  const n = await paras.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    await expect(paras.nth(i).locator('strong')).toHaveCount(1);
  }
  await expect(page.locator('.daybrief__rail .daybrief__section')).toHaveCount(5);
});

test('daybrief/real-tuesday: quiet-day cadence — no Coming Up section', async ({ page }) => {
  await open(page, 'real-tuesday', 'letter');
  await expect(page.locator('.daybrief__section--comingup')).toHaveCount(0);
});

test('daybrief/checkin-afternoon: header is Check-in · time, clear control still meets the tap floor', async ({ page }) => {
  await open(page, 'checkin-afternoon', 'letter');
  await expect(page.locator('.daybrief .card__title')).toContainText('Check-in ·');
  await expect(page.locator('.daybrief .card__title')).not.toContainText('Morning Brief');
  // Same clear affordance as the morning brief, relabeled for the kind.
  await expect(page.locator('.daybrief__clear')).toHaveAttribute('aria-label', 'Clear check-in');
});

test('daybrief/real-monday: ✓ clears the card, undo toast restores it', async ({ page }) => {
  await open(page, 'real-monday', 'letter');
  await page.locator('.daybrief__clear').tap();
  await expect(page.locator('.daybrief')).toBeHidden();

  // Calendar reflow contract: the hidden card releases its grid row.
  await expect(page.locator('.toast__action')).toBeVisible();
  await page.locator('.toast__action').tap();
  await expect(page.locator('.daybrief')).toBeVisible();

  // Clear again and let the toast expire — the card stays cleared.
  await page.locator('.daybrief__clear').tap();
  await page.clock.runFor(6000);
  await expect(page.locator('.daybrief')).toBeHidden();
});
