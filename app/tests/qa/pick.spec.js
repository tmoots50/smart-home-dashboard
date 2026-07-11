import { test, expect } from '@playwright/test';
import { states } from '../../src/widgets/pick.fixtures.js';
import { captureArtifact, collectErrors } from './measure.js';
import { expectHarnessGeometry, openHarness } from './widget-harness.js';

for (const state of Object.keys(states)) {
  test(`pick/${state}: compact linked picks`, async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    await openHarness(page, 'pick', state);
    await expect(page.locator('.pick__item')).toHaveCount(states[state].length);
    await expectHarnessGeometry(page);
    await captureArtifact(page, `pick-${state}`, testInfo);
    expect(errors).toEqual([]);
  });
}

// Typical content fits fully; the worst-case overflow state (2-line titles +
// 2-line notes × 3) may exceed the list by a small margin — assert the last
// item's top edge is visible (skim affordance), not its full height.
test('pick/typical: all three picks fully visible', async ({ page }) => {
  await openHarness(page, 'pick', 'typical');
  const card = await page.locator('[data-slot="pick"]').boundingBox();
  const last = await page.locator('.pick__item').last().boundingBox();
  expect(last.y + last.height).toBeLessThanOrEqual(card.y + card.height);
});

test('pick/overflow: every pick at least starts inside the card', async ({ page }) => {
  await openHarness(page, 'pick', 'overflow');
  const card = await page.locator('[data-slot="pick"]').boundingBox();
  const last = await page.locator('.pick__item').last().boundingBox();
  expect(last.y).toBeLessThan(card.y + card.height);
});

test('pick/typical: tap opens the in-app article overlay instead of navigating away', async ({ page }) => {
  // Fixture URLs are external — keep the spec hermetic.
  await page.route('https://**', route => route.abort());
  await openHarness(page, 'pick', 'typical');
  await page.locator('a.pick__item').first().tap();
  await expect(page.locator('.article-overlay')).toBeVisible();
  await expect(page).toHaveURL(/harness\.html/); // no navigation happened
  await page.locator('.article-overlay__back').tap();
  await expect(page.locator('.article-overlay')).toHaveCount(0);
  await expect(page.locator('[data-slot="pick"]')).toBeVisible();
});
