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
  // lineHeight computes to "normal" here, so derive a safe one-line ceiling
  // from font-size instead (a wrapped second line would double the height).
  const geometry = await title.evaluate(el => {
    const cs = getComputedStyle(el);
    return {
      scroll: el.scrollWidth,
      client: el.clientWidth,
      height: el.getBoundingClientRect().height,
      oneLineMax: parseFloat(cs.fontSize) * 1.8,
      whiteSpace: cs.whiteSpace,
    };
  });
  expect(geometry.scroll).toBeGreaterThan(geometry.client);
  expect(geometry.whiteSpace).toBe('nowrap');
  expect(geometry.height).toBeLessThanOrEqual(geometry.oneLineMax);
});

