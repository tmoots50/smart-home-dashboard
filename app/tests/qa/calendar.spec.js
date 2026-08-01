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

test('calendar/week: 5-day time grid with hour gutter and a now-line', async ({ page }) => {
  await open(page, 'week');
  await expect(page.locator('.calendar--week')).toBeVisible();
  await expect(page.locator('.calweek__col')).toHaveCount(5);
  await expect(page.locator('.calweek__gutter')).toBeVisible();
  // FIXED_NOW (07:30) is inside the 5 AM–midnight range, so the now-line shows.
  await expect(page.locator('.calweek__now')).toHaveCount(1);
  expect(await page.locator('.calweek__event').count()).toBeGreaterThan(0);
});

test('calendar/week: ‹ › page the window a full 5 days; Today snaps back', async ({ page }) => {
  await open(page, 'week');
  // At rest: today-anchored window. Today's event shows, the now-line marks
  // today, and the range label is not accented (is-away absent).
  await expect(page.locator('.calweek__event').filter({ hasText: 'Grocery Run' })).toBeVisible();
  await expect(page.locator('.calweek__now')).toHaveCount(1);
  await expect(page.locator('.calweek__nav-label.is-away')).toHaveCount(0);

  // Next → the following 5 days: a next-window event appears, today's is gone,
  // the now-line disappears, and the range label goes accented.
  await page.locator('[data-calnav="next"]').tap();
  await expect(page.locator('.calweek__event').filter({ hasText: 'Swim lesson' })).toBeVisible();
  await expect(page.locator('.calweek__event').filter({ hasText: 'Grocery Run' })).toHaveCount(0);
  await expect(page.locator('.calweek__now')).toHaveCount(0);
  await expect(page.locator('.calweek__nav-label.is-away')).toHaveCount(1);

  // Today → back to the today-anchored window.
  await page.locator('[data-calnav="today"]').tap();
  await expect(page.locator('.calweek__event').filter({ hasText: 'Grocery Run' })).toBeVisible();
  await expect(page.locator('.calweek__now')).toHaveCount(1);

  // Prev → the previous 5 days: a past-window event shows, today's is gone.
  await page.locator('[data-calnav="prev"]').tap();
  await expect(page.locator('.calweek__event').filter({ hasText: 'Past playdate' })).toBeVisible();
  await expect(page.locator('.calweek__event').filter({ hasText: 'Grocery Run' })).toHaveCount(0);
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

// ── dinner lane + coming-up strip (2026-08-01) ──

test('calendar/week: dinner lane shows each day\'s meal with the prefix stripped', async ({ page }) => {
  await open(page, 'week');
  await expect(page.locator('.calweek__meals')).toBeVisible();
  await expect(page.locator('.calweek__meal').filter({ hasText: 'Salmon & corn' })).toBeVisible();
  await expect(page.locator('.calweek__meals')).not.toContainText('Dinner:'); // lane strips the convention prefix
  await expect(page.locator('.calweek__meal--empty')).toHaveCount(1);         // day 4 unplanned → "ask Nigel…"
});

test('calendar/week: dinner events stay off the all-day band; a dinner OUTING stays off the lane', async ({ page }) => {
  await open(page, 'week');
  await expect(page.locator('.calweek__bar').filter({ hasText: 'Dinner' })).toHaveCount(0);
  await expect(page.locator('.calweek__meals')).not.toContainText('Dinner with Mom'); // timed outing ≠ meal plan
});

test('calendar/week: tapping a meal opens the event detail with the full title', async ({ page }) => {
  await open(page, 'week');
  await page.locator('.calweek__meal').first().tap();
  await expect(page.locator('.event-detail')).toBeVisible();
  await expect(page.locator('.event-detail .overlay__title')).toHaveText('Dinner: Salmon & corn');
});

test('calendar/week: strip shows the 3 nearest picks and the overflow counter', async ({ page }) => {
  await open(page, 'week');
  await expect(page.locator('.cu-pill:not(.cu-pill--more)')).toHaveCount(3);
  await expect(page.locator('.cu-pill--more')).toHaveText('+5 more'); // 11 eligible, capped at 8, 3 shown
  await expect(page.locator('.cu-pill').first()).toContainText('Swim lesson'); // day 5 — nearest off-grid event
});

test('calendar/week: pill tap opens detail, not the sheet', async ({ page }) => {
  await open(page, 'week');
  await page.locator('.cu-pill:not(.cu-pill--more)').first().tap();
  await expect(page.locator('.event-detail')).toBeVisible();
  await expect(page.locator('.calweek__cusheet')).toHaveCount(0);
});

test('calendar/week: strip expands to 8 chronological rows in two columns, then collapses', async ({ page }) => {
  await open(page, 'week');
  await page.locator('.custrip__chev').tap();
  await expect(page.locator('.calweek__cusheet')).toBeVisible();
  await expect(page.locator('.cusheet__col')).toHaveCount(2);
  await expect(page.locator('.curow')).toHaveCount(8);
  // Chronological: day counts read ascending in DOM order (col 1 then col 2).
  const days = await page.locator('.curow__days').allTextContents();
  const nums = days.map(t => (t === 'today' ? 0 : t === 'tomorrow' ? 1 : parseInt(t, 10)));
  expect([...nums].sort((a, b) => a - b)).toEqual(nums);
  await page.locator('.custrip__chev').tap();
  await expect(page.locator('.calweek__cusheet')).toHaveCount(0);
});

test('calendar/week: sheet row tap opens the event detail', async ({ page }) => {
  await open(page, 'week');
  await page.locator('.custrip__chev').tap();
  await page.locator('.curow').first().tap();
  await expect(page.locator('.event-detail')).toBeVisible();
  await expect(page.locator('.event-detail .overlay__title')).not.toHaveText('');
});

test('calendar/week: the sheet auto-returns to the week after a minute', async ({ page }) => {
  await open(page, 'week');
  await page.locator('.custrip__chev').tap();
  await expect(page.locator('.calweek__cusheet')).toBeVisible();
  await page.clock.runFor(61_000);
  await expect(page.locator('.calweek__cusheet')).toHaveCount(0);
});

test('calendar/week-no-dinners: every day in the window nudges for a plan', async ({ page }) => {
  await open(page, 'week-no-dinners');
  await expect(page.locator('.calweek__meal--empty')).toHaveCount(5);
  await expect(page.locator('.calweek__meals')).toContainText('ask Nigel');
});

test('calendar/week-allday-heavy: the doubled band caps at 4 rows and clips the pile-up', async ({ page }) => {
  await open(page, 'week-allday-heavy');
  const box = await page.locator('.calweek__allday').boundingBox();
  expect(box.height).toBeGreaterThan(3.8 * 16);        // grew past the old 2-row cap…
  expect(box.height).toBeLessThanOrEqual(7.6 * 16 + 1); // …but clips at the new one
});
