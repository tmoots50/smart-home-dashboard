import { test, expect } from '@playwright/test';
import { states } from '../../src/widgets/spotify-drawer.fixtures.js';
import { openHarness, expectHarnessGeometry } from './widget-harness.js';
import { collectErrors } from './measure.js';

for (const state of Object.keys(states)) {
  test(`spotify-drawer/${state}: geometry, touch, and console clean`, async ({ page }) => {
    const errors = collectErrors(page);
    await openHarness(page, 'spotify-drawer', state);
    await expect(page.locator('.spotify-drawer')).toBeVisible();
    await expectHarnessGeometry(page);
    expect(errors).toEqual([]);
  });
}

test('spotify drawer playlist grid preserves square artwork', async ({ page }) => {
  await openHarness(page, 'spotify-drawer', 'playlists');
  const box = await page.locator('.spotify-playlist .spotify-art').first().boundingBox();
  expect(Math.abs(box.width - box.height)).toBeLessThan(2);
});

