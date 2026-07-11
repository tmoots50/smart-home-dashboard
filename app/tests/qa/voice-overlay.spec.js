import { test, expect } from '@playwright/test';
import { states } from '../../src/widgets/voice-overlay.fixtures.js';
import { openHarness, expectHarnessGeometry } from './widget-harness.js';
import { collectErrors } from './measure.js';

for (const state of Object.keys(states)) {
  test(`voice-overlay/${state}: geometry, touch, and console clean`, async ({ page }) => {
    const errors = collectErrors(page);
    await openHarness(page, 'voice-overlay', state);
    await expect(page.locator('.voice-overlay')).toBeVisible();
    await expectHarnessGeometry(page);
    expect(errors).toEqual([]);
  });
}

test('voice confirm keeps the transcript as the visual focus', async ({ page }) => {
  await openHarness(page, 'voice-overlay', 'confirm');
  const transcript = await page.locator('.voice-transcript').boundingBox();
  const send = await page.locator('[data-voice-action="send"]').boundingBox();
  expect(transcript.height).toBeGreaterThan(send.height * 2.5);
});

