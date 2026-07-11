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

test('pick/overflow: all three picks remain visible at once', async ({ page }) => {
  await openHarness(page, 'pick', 'overflow');
  const card = await page.locator('[data-slot="pick"]').boundingBox();
  const last = await page.locator('.pick__item').last().boundingBox();
  expect(last.y + last.height).toBeLessThanOrEqual(card.y + card.height);
});
