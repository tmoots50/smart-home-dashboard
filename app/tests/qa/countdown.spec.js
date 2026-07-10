import { test, expect } from '@playwright/test';
import { states } from '../../src/widgets/countdown.fixtures.js';
import { captureArtifact, collectErrors } from './measure.js';
import { expectHarnessGeometry, expectNestedScrollContained, openHarness } from './widget-harness.js';

async function open(page, state) {
  await openHarness(page, 'countdown', state);
}

for (const state of Object.keys(states)) {
  test(`countdown/${state}: family-only scroll geometry`, async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    await open(page, state);
    const expected = Math.min(10, states[state].filter(e => e.calendar === 'Family').length);
    await expect(page.locator('.countdown__item')).toHaveCount(expected);
    await expectHarnessGeometry(page);
    await captureArtifact(page, `countdown-${state}`, testInfo);
    expect(errors).toEqual([]);
  });
}

test('countdown/typical: check and left swipe dismiss without page scroll', async ({ page }) => {
  await open(page, 'typical');
  await page.locator('.countdown__dismiss').first().tap();
  await expect(page.locator('.countdown__item')).toHaveCount(2);
  const row = page.locator('.countdown__item').first();
  await row.dispatchEvent('pointerdown', { clientX: 220 });
  await row.dispatchEvent('pointerup', { clientX: 100 });
  await expect(page.locator('.countdown__item')).toHaveCount(1);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test('countdown/overflow: internal scrolling stays inside the card', async ({ page }) => {
  await open(page, 'overflow');
  await expectNestedScrollContained(page, '.countdown__list');
});
