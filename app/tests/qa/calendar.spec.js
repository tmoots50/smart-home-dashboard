// QA spec — Family Calendar card. Renders every fixture state at each device
// profile, asserts geometry (no horizontal overflow, tap targets), drives the
// touch interactions, and captures review artifacts.
import { test, expect } from '@playwright/test';
import { FIXED_NOW } from './clock.js';
import { states } from '../../src/widgets/calendar.fixtures.js';
import { detectOverflow, auditTapTargets, captureArtifact, collectErrors, freezeMotion } from './measure.js';
import { expectNestedScrollContained } from './widget-harness.js';

const url = (state) => `/harness.html?widget=calendar&state=${state}`;

async function open(page, state) {
  await page.clock.install({ time: FIXED_NOW });
  await page.goto(url(state));
  await freezeMotion(page); // geometry is only meaningful at rest
  await expect(page.locator('html[data-harness-ready]')).toBeAttached();
}

for (const state of Object.keys(states)) {
  test(`calendar/${state}: geometry + console clean`, async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    await open(page, state);
    await expect(page.locator('.calendar')).toBeVisible();

    const overflow = await detectOverflow(page);
    expect(overflow.horizontal, `horizontal overflow ${overflow.scrollWidth}px > viewport ${overflow.clientWidth}px`).toBe(false);

    // Event rows are the tappable unit on this card; audit them alongside
    // the standard controls.
    const offenders = await auditTapTargets(page, {
      selector: 'button, a[href], [role="button"]',
    });
    expect(offenders, `tap targets under 44px: ${JSON.stringify(offenders, null, 2)}`).toEqual([]);

    await captureArtifact(page, `calendar-${state}`, testInfo);
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });
}

test('calendar/typical: tapping an event row opens the detail panel', async ({ page }) => {
  await open(page, 'typical');
  await page.locator('.calendar__event').first().tap();
  await expect(page.locator('.event-detail')).toBeVisible();
  await expect(page.locator('.event-detail .overlay__title')).not.toHaveText('');
});

test('calendar/typical: detail panel closes via ✕ and via scrim tap', async ({ page }) => {
  await open(page, 'typical');

  await page.locator('.calendar__event').first().tap();
  await expect(page.locator('.event-detail')).toBeVisible();
  await page.locator('.overlay--event-detail [data-action="close"]').tap();
  await expect(page.locator('.event-detail')).toHaveCount(0);

  await page.locator('.calendar__event').first().tap();
  await expect(page.locator('.event-detail')).toBeVisible();
  // Scrim = the overlay host itself, outside the panel. Top-left corner is
  // always outside the centered panel.
  await page.locator('.overlay--event-detail').tap({ position: { x: 5, y: 5 } });
  await expect(page.locator('.event-detail')).toHaveCount(0);
});

test('calendar/overflow: column scrolling stays inside the card', async ({ page }) => {
  await open(page, 'overflow');
  await expectNestedScrollContained(page, '.calendar__list');
});

test('calendar/overflow: default-view titles stay on one compact line', async ({ page }) => {
  await open(page, 'overflow');
  const heights = await page.locator('.calendar__title').evaluateAll(nodes => nodes.map(node => ({
    height: node.getBoundingClientRect().height,
    lineHeight: parseFloat(getComputedStyle(node).lineHeight),
  })));
  expect(heights.every(({ height, lineHeight }) => height <= lineHeight + 1)).toBe(true);
});
