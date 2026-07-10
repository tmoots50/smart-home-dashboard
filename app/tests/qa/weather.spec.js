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
