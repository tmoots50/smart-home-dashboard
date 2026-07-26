// QA spec — Family Calendar card. Renders every fixture state at each device
// profile, asserts geometry (no horizontal overflow, tap targets), drives the
// touch interactions, and captures review artifacts.
import { test, expect } from '@playwright/test';
import { FIXED_NOW } from './clock.js';
import { states } from '../../src/widgets/calendar.fixtures.js';
import { detectOverflow, auditTapTargets, auditDesignContract, auditTextClipping, captureArtifact, collectErrors, freezeMotion } from './measure.js';
import { contract } from './design-contract.js';
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

    const clipped = await auditTextClipping(page);
    expect(clipped, `clipped text: ${JSON.stringify(clipped, null, 2)}`).toEqual([]);
    if (page.viewportSize()?.width === 1080) {
      expect(await auditDesignContract(page, contract)).toEqual([]);
    }

    await captureArtifact(page, `calendar-${state}`, testInfo);
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });
}

// Regression lock for the 2026-07 column-starvation bug: per-column limits
// mean a packed Family week can never evict another column. Only Family is
// visible now, so a hidden Tim event simply doesn't render.
test('calendar/uneven: only the Family column renders, capped at 7; Tim is hidden', async ({ page }) => {
  await open(page, 'uneven');
  await expect(page.locator('.calendar__column--family .calendar__event')).toHaveCount(7);
  await expect(page.locator('.calendar__column--tim')).toHaveCount(0);
  await expect(page.locator('.calendar__column--caroline')).toHaveCount(0);
});

// Hidden-people regression: a feed dominated by Tim/Caroline (work + personal)
// renders as a single Family event — their columns and rows are gone.
test('calendar/work-dense: Tim and Caroline are hidden; only the Family column shows', async ({ page }) => {
  await open(page, 'work-dense');
  await expect(page.locator('.calendar__column--tim')).toHaveCount(0);
  await expect(page.locator('.calendar__column--caroline')).toHaveCount(0);
  await expect(page.locator('.calendar__column--family')).toHaveCount(1);
  await expect(page.locator('.calendar__event--work')).toHaveCount(0); // no visible work feeds remain
  await expect(page.locator('.calendar')).not.toContainText('Busy');
});

test('calendar/work-dense: tapping the Family row opens detail with its source calendar', async ({ page }) => {
  await open(page, 'work-dense');
  await page.locator('.calendar__column--family .calendar__event').first().tap();
  await expect(page.locator('.event-detail')).toBeVisible();
  await expect(page.locator('.event-detail .cal-chip')).toHaveText('Family');
});

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

// Stacked (default) titles may wrap — but never past the 2-line clamp.
test('calendar/overflow: default-view titles stay within the two-line clamp', async ({ page }) => {
  await open(page, 'overflow');
  const heights = await page.locator('.calendar__title').evaluateAll(nodes => nodes.map(node => ({
    height: node.getBoundingClientRect().height,
    lineHeight: parseFloat(getComputedStyle(node).lineHeight),
  })));
  expect(heights.every(({ height, lineHeight }) => height <= lineHeight * 2 + 1)).toBe(true);
});

test('calendar/typical-classic: classic-flavor titles stay on one compact line', async ({ page }) => {
  await open(page, 'typical-classic');
  const heights = await page.locator('.calendar__title').evaluateAll(nodes => nodes.map(node => ({
    height: node.getBoundingClientRect().height,
    lineHeight: parseFloat(getComputedStyle(node).lineHeight),
  })));
  expect(heights.length).toBeGreaterThan(0);
  expect(heights.every(({ height, lineHeight }) => height <= lineHeight + 1)).toBe(true);
});

test('calendar/typical-days: day-grouped flavor shows day headers and a Family-only legend', async ({ page }) => {
  await open(page, 'typical-days');
  await expect(page.locator('.calendar--days')).toBeVisible();
  expect(await page.locator('.calendar__day-label').count()).toBeGreaterThan(0);
  await expect(page.locator('.calendar__legend-item')).toHaveCount(1); // Family only; Tim/Caroline hidden
  await expect(page.locator('.calendar__dot--tim')).toHaveCount(0);
  await expect(page.locator('.calendar__dot--caroline')).toHaveCount(0);
  await expect(page.locator('.calendar__day-label').first()).toContainText(/Today/);
});

// ── week grid (the wall default) ──

test('calendar/week: 7-day time grid with hour gutter and a now-line', async ({ page }) => {
  await open(page, 'week');
  await expect(page.locator('.calendar--week')).toBeVisible();
  await expect(page.locator('.calweek__col')).toHaveCount(7);
  await expect(page.locator('.calweek__gutter')).toBeVisible();
  // FIXED_NOW (07:30) is inside the 5 AM–midnight range, so the now-line shows.
  await expect(page.locator('.calweek__now')).toHaveCount(1);
  expect(await page.locator('.calweek__event').count()).toBeGreaterThan(0);
});

test('calendar/week: all-day events span the pinned band', async ({ page }) => {
  await open(page, 'week');
  await expect(page.locator('.calweek__allday')).toBeVisible();
  await expect(page.locator('.calweek__bar').filter({ hasText: 'Camping Trip' })).toBeVisible();
});

test('calendar/week: tapping a block opens the event detail', async ({ page }) => {
  await open(page, 'week');
  await page.locator('.calweek__event').first().tap();
  await expect(page.locator('.event-detail')).toBeVisible();
  await expect(page.locator('.event-detail .overlay__title')).not.toHaveText('');
});

test('calendar/week: the hour grid scrolls inside the card', async ({ page }) => {
  await open(page, 'week');
  await expectNestedScrollContained(page, '.calweek__scroll');
});

test('calendar/week: opens scrolled so 8 AM sits at the top of the viewport', async ({ page }) => {
  await open(page, 'week');
  const gap = await page.evaluate(() => {
    const scroll = document.querySelector('.calweek__scroll');
    const eight = [...document.querySelectorAll('.calweek__hour')].find(h => h.textContent.trim().startsWith('8'));
    return Math.abs(eight.getBoundingClientRect().top - scroll.getBoundingClientRect().top);
  });
  expect(gap).toBeLessThan(24); // 8 AM within ~one row of the viewport top → 8 AM–6 PM visible
});
