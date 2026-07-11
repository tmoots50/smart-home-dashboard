import { test, expect } from '@playwright/test';
import { states } from '../../src/widgets/countdown.fixtures.js';
import { captureArtifact, collectErrors } from './measure.js';
import { expectHarnessGeometry, expectNestedScrollContained, openHarness } from './widget-harness.js';

async function open(page, state) {
  await openHarness(page, 'countdown', state);
}

for (const state of Object.keys(states)) {
  test(`countdown/${state}: family-only scroll geometry`, async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    await open(page, state);
    const expected = Math.min(10, states[state].filter(e => e.calendar === 'Family').length);
    await expect(page.locator('.countdown__item')).toHaveCount(expected);
    await expectHarnessGeometry(page);
    await captureArtifact(page, `countdown-${state}`, testInfo);
    expect(errors).toEqual([]);
  });
}

test('countdown/typical: tap check completes (with linger undo), swipe dismisses with toast undo', async ({ page }) => {
  await open(page, 'typical');
  const items = page.locator('.countdown__item');
  const initial = await items.count();

  // Tap check → struck but still present; tap again during linger → undone.
  await page.locator('.countdown__check').first().tap();
  await expect(page.locator('.countdown__item--done')).toHaveCount(1);
  await expect(items).toHaveCount(initial);
  await page.locator('.countdown__check').first().tap();
  await expect(page.locator('.countdown__item--done')).toHaveCount(0);

  // Complete again and let the linger elapse → row clears.
  await page.locator('.countdown__check').first().tap();
  await page.clock.runFor(3000);
  await expect(items).toHaveCount(initial - 1);

  // Swipe left → dismissed immediately, undo toast restores it.
  const row = items.first();
  await row.dispatchEvent('pointerdown', { clientX: 220 });
  await row.dispatchEvent('pointerup', { clientX: 100 });
  await expect(items).toHaveCount(initial - 2);
  await expect(page.locator('.toast__action')).toBeVisible();
  await page.locator('.toast__action').tap();
  await expect(items).toHaveCount(initial - 1);

  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test('countdown/overflow: internal scrolling stays inside the card', async ({ page }) => {
  await open(page, 'overflow');
  await expectNestedScrollContained(page, '.countdown__list');
});
