// QA spec — in-app article overlay (Atlanta Picks reader). Geometry + touch
// interactions. Fixtures use same-origin stubs under public/qa/, so no
// network leaves the dev server.
import { test, expect } from '@playwright/test';
import { states } from '../../src/widgets/article-overlay.fixtures.js';
import { detectOverflow, auditTapTargets, captureArtifact, collectErrors, freezeMotion } from './measure.js';
import { FIXED_NOW } from './clock.js';

async function open(page, state) {
  await page.clock.install({ time: FIXED_NOW });
  await page.goto(`/harness.html?widget=article-overlay&state=${state}`);
  await freezeMotion(page);
  await expect(page.locator('.article-overlay')).toBeVisible();
}

for (const state of Object.keys(states)) {
  test(`article-overlay/${state}: geometry, touch, and console clean`, async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    await open(page, state);

    const overflow = await detectOverflow(page);
    expect(overflow.horizontal).toBe(false);

    const offenders = await auditTapTargets(page, { selector: 'button, a[href]' });
    expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);

    await captureArtifact(page, `article-overlay-${state}`, testInfo);
    expect(errors).toEqual([]);
  });
}

test('article-overlay/typical: Back returns to the dashboard', async ({ page }) => {
  await open(page, 'typical');
  await page.locator('.article-overlay__back').tap();
  await expect(page.locator('.article-overlay')).toHaveCount(0);
  await expect(page.locator('.briefing')).toBeVisible();
});

test('article-overlay/typical: scrim tap and Escape both close', async ({ page }) => {
  await open(page, 'typical');
  await page.locator('.overlay').first().tap({ position: { x: 5, y: 5 } });
  await expect(page.locator('.article-overlay')).toHaveCount(0);

  await page.goto('/harness.html?widget=article-overlay&state=typical');
  await expect(page.locator('.article-overlay')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.article-overlay')).toHaveCount(0);
});

test('article-overlay/blocked: hint stays reachable behind a transparent frame', async ({ page }) => {
  await open(page, 'blocked');
  // The hint layer exists under the frame; with the blank (transparent) stub
  // it is what the user effectively sees. The header escape hatches must be
  // present regardless of what the site does.
  await expect(page.locator('.article-overlay__hint')).toBeAttached();
  await expect(page.locator('.article-overlay__back')).toBeVisible();
  await expect(page.locator('.article-overlay__external')).toBeVisible();
});

test('article-overlay/long-source: header truncates on one line', async ({ page }) => {
  await open(page, 'long-source');
  const bar = await page.locator('.article-overlay__bar').boundingBox();
  // A wrapped header would double the bar height (min 3.5rem = 56px).
  expect(bar.height).toBeLessThanOrEqual(70);
});
