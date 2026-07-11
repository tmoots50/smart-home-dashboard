import { test, expect } from '@playwright/test';
import { states } from '../../src/widgets/spotify-ticker.fixtures.js';
import { openHarness, expectHarnessGeometry } from './widget-harness.js';
import { collectErrors } from './measure.js';

for (const state of Object.keys(states)) {
  test(`spotify-ticker/${state}: geometry and console clean`, async ({ page }) => {
    const errors = collectErrors(page);
    await openHarness(page, 'spotify-ticker', state);
    await expectHarnessGeometry(page, { tapTargets: state !== 'inactive' });
    if (state === 'inactive') await expect(page.locator('.spotify-ticker')).toBeHidden();
    else await expect(page.locator('.spotify-ticker')).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('spotify ticker overflow stays on one clipped line', async ({ page }) => {
  await openHarness(page, 'spotify-ticker', 'overflow');
  const title = page.locator('.spotify-ticker__title');
  const geometry = await title.evaluate(el => ({ scroll: el.scrollWidth, client: el.clientWidth, lines: Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)) }));
  expect(geometry.scroll).toBeGreaterThan(geometry.client);
  expect(geometry.lines).toBeLessThanOrEqual(1);
});

