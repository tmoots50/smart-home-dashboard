import { test, expect } from '@playwright/test';
import { states } from '../../src/widgets/weather.fixtures.js';
import { captureArtifact, collectErrors } from './measure.js';
import { expectHarnessGeometry, openHarness } from './widget-harness.js';

for (const state of Object.keys(states)) {
  test(`weather/${state}: hourly + daily geometry`, async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    await openHarness(page, 'weather', state);
    await expect(page.locator('.weather__forecast')).toBeVisible();
    if (state !== 'no-hourly') await expect(page.locator('.weather__hour')).toHaveCount(states[state].hourly.length);
    await expectHarnessGeometry(page, { tapTargets: false });
    await captureArtifact(page, `weather-${state}`, testInfo);
    expect(errors).toEqual([]);
  });
}

test('weather/typical: stat cluster fills the space right of the temp', async ({ page }) => {
  await openHarness(page, 'weather', 'typical');
  await expect(page.locator('.weather__stat')).toHaveCount(4);
  expect(await page.locator('.weather__main').textContent()).not.toContain('undefined');
});

test('weather/no-stats: cluster vanishes cleanly on old cached payloads', async ({ page }) => {
  await openHarness(page, 'weather', 'no-stats');
  await expect(page.locator('.weather__stats')).toHaveCount(0);
  expect(await page.locator('.weather__main').textContent()).not.toContain('undefined');
});
