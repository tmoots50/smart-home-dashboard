// Composition smoke test: isolated widgets catch local geometry; this catches
// ordering, paired-card heights, and accidental page-width regressions in the
// actual morning briefing. External weather is aborted so the mock first frame
// remains deterministic.
import { test, expect } from '@playwright/test';
import { FIXED_NOW } from './clock.js';
import { detectOverflow, captureArtifact, freezeMotion } from './measure.js';

test('morning briefing: calendar precedes the compact updates row', async ({ page }, testInfo) => {
  await page.clock.install({ time: FIXED_NOW });
  await page.route('https://api.open-meteo.com/**', route => route.abort());
  await page.goto('/?theme=light');
  await freezeMotion(page);

  const calendar = page.locator('[data-slot="calendar"]');
  const updates = page.locator('.briefing__duo--updates');
  await expect(calendar).toBeVisible();
  await expect(updates).toBeVisible();
  const [calBox, updatesBox] = await Promise.all([calendar.boundingBox(), updates.boundingBox()]);
  expect(calBox.y + calBox.height).toBeLessThanOrEqual(updatesBox.y);
  expect(updatesBox.height).toBeLessThanOrEqual(300);
  expect((await detectOverflow(page)).horizontal).toBe(false);
  await expect(page.locator('.pick__item')).toHaveCount(3);
  await captureArtifact(page, 'briefing-layout', testInfo);
});
