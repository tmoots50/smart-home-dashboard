import { test, expect } from '@playwright/test';
import { states } from '../../src/widgets/groceries.fixtures.js';
import { captureArtifact, collectErrors } from './measure.js';
import { expectHarnessGeometry, expectNestedScrollContained, openHarness } from './widget-harness.js';

for (const state of Object.keys(states)) {
  test(`groceries/${state}: dense touch-safe rows`, async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    await openHarness(page, 'groceries', state);
    await expect(page.locator('.groceries__item')).toHaveCount(states[state].length);
    await expectHarnessGeometry(page);
    await captureArtifact(page, `groceries-${state}`, testInfo);
    expect(errors).toEqual([]);
  });
}

test('groceries/overflow: internal scrolling stays inside the card', async ({ page }) => {
  await openHarness(page, 'groceries', 'overflow');
  await expectNestedScrollContained(page, '.groceries__list');
});
