// QA spec — expanded 7-day calendar overlay. Geometry + touch interactions +
// the empirical layout-fit measurement that grounds "how many events SHOULD
// an empty/overflowing view show?" in real device numbers.
import { test, expect } from '@playwright/test';
import { FIXED_NOW } from './clock.js';
import { states } from '../../src/widgets/calendar-overlay.fixtures.js';
import { detectOverflow, auditTapTargets, countFullyVisible, captureArtifact, collectErrors, freezeMotion } from './measure.js';

const url = (state) => `/harness.html?widget=calendar-overlay&state=${state}`;

async function open(page, state) {
  await page.clock.install({ time: FIXED_NOW });
  await page.goto(url(state));
  await freezeMotion(page); // geometry is only meaningful at rest
  await expect(page.locator('.cal-overlay')).toBeVisible();
}

for (const state of Object.keys(states)) {
  test(`overlay/${state}: geometry + console clean`, async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    await open(page, state);

    const overflow = await detectOverflow(page);
    expect(overflow.horizontal, `horizontal overflow ${overflow.scrollWidth}px > viewport ${overflow.clientWidth}px`).toBe(false);

    const offenders = await auditTapTargets(page, {
      selector: 'button, a[href], [role="button"]',
    });
    expect(offenders, `tap targets under 44px: ${JSON.stringify(offenders, null, 2)}`).toEqual([]);

    await captureArtifact(page, `overlay-${state}`, testInfo);
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });
}

test('overlay/overflow: measure how many event rows fit without scrolling', async ({ page }, testInfo) => {
  await open(page, 'overflow');
  const fit = await countFullyVisible(page, '.cal-overlay__body', '.cal-event');
  // Informational, not pass/fail — this number feeds the qa-harness skill's
  // "ideal N" decisions (e.g. how many upcoming events the empty state should
  // show). Recorded per profile in the report.
  testInfo.annotations.push({ type: 'rows-fit-without-scroll', description: `${fit.visible} of ${fit.total} (limit ${fit.limit}px)` });
  console.log(`[measure] ${testInfo.project.name} overlay rows fully visible: ${fit.visible}/${fit.total} (fold at ${fit.limit}px)`);
  expect(fit.total).toBeGreaterThan(fit.visible); // sanity: overflow state actually overflows
});

test('overlay/typical: tap event row → detail opens; ✕ closes it', async ({ page }) => {
  await open(page, 'typical');
  await page.locator('.cal-event').first().tap();
  await expect(page.locator('.event-detail')).toBeVisible();
  await page.locator('.overlay--event-detail [data-action="close"]').tap();
  await expect(page.locator('.event-detail')).toHaveCount(0);
  await expect(page.locator('.cal-overlay')).toBeVisible(); // overlay survives detail close
});

test('overlay: scrim tap closes; Escape closes', async ({ page }) => {
  await open(page, 'typical');
  // Scrim = the overlay host outside the panel; top-left corner is scrim.
  await page.locator('.overlay').first().tap({ position: { x: 5, y: 5 } });
  await expect(page.locator('.cal-overlay')).toHaveCount(0);

  await page.goto(url('typical'));
  await expect(page.locator('.cal-overlay')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.cal-overlay')).toHaveCount(0);
});

test('overlay/empty: truly-empty stays calm — one line, no Coming up', async ({ page }) => {
  await open(page, 'empty');
  await expect(page.locator('.cal-overlay__empty')).toBeVisible();
  await expect(page.locator('.cal-coming')).toHaveCount(0);
});

test('overlay/empty-with-later: Coming up fills the week, capped, rows tappable', async ({ page }) => {
  await open(page, 'empty-with-later');
  await expect(page.locator('.cal-overlay__empty')).toBeVisible();
  await expect(page.locator('.cal-coming')).toBeVisible();
  // Fixture supplies 15 later events; EMPTY_NEXT_MAX caps at 12 (derived from
  // the measured 29-rows-before-fold ceiling — see calendar-overlay.js).
  await expect(page.locator('.cal-coming .cal-event')).toHaveCount(12);
  // Coming-up rows are full citizens: tap → event detail.
  await page.locator('.cal-coming .cal-event').first().tap();
  await expect(page.locator('.event-detail')).toBeVisible();
});

test('overlay/typical: person sections in household order with day column', async ({ page }) => {
  await open(page, 'typical');
  const labels = await page.locator('.cal-person__label').allTextContents();
  expect(labels.map(s => s.trim())).toEqual(['Tim', 'Family', 'Caroline']);
  await expect(page.locator('.cal-event__day').first()).toBeVisible();
});
