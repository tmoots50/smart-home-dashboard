// QA spec — month-view calendar overlay. Geometry + touch interactions:
// nav, chip → event detail, "+N more" → day detail → event detail.
import { test, expect } from '@playwright/test';
import { FIXED_NOW } from './clock.js';
import { states } from '../../src/widgets/month-calendar.fixtures.js';
import { detectOverflow, auditTapTargets, captureArtifact, collectErrors, freezeMotion, touchScroll } from './measure.js';

async function open(page, state) {
  await page.clock.install({ time: FIXED_NOW });
  await page.goto(`/harness.html?widget=month-calendar&state=${state}`);
  await freezeMotion(page);
  await expect(page.locator('.month-cal')).toBeVisible();
}

for (const state of Object.keys(states)) {
  test(`month-calendar/${state}: geometry, touch, and console clean`, async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    await open(page, state);

    const overflow = await detectOverflow(page);
    expect(overflow.horizontal).toBe(false);

    // Chips, nav, "+N more", and in-month day cells are all tap targets.
    const offenders = await auditTapTargets(page, { selector: 'button, [role="button"]' });
    expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);

    await expect(page.locator('.month-cal__dow span')).toHaveCount(7);
    await captureArtifact(page, `month-calendar-${state}`, testInfo);
    expect(errors).toEqual([]);
  });
}

test('month-calendar/typical: exactly one today pill', async ({ page }) => {
  await open(page, 'typical');
  await expect(page.locator('.month-cal__day.is-today')).toHaveCount(1);
});

test('month-calendar/typical: chip tap opens event detail; closing returns to the month', async ({ page }) => {
  await open(page, 'typical');
  await page.locator('.month-cal__chip').first().tap();
  await expect(page.locator('.event-detail')).toBeVisible();
  await page.locator('.overlay--event-detail [data-action="close"]').tap();
  await expect(page.locator('.event-detail')).toHaveCount(0);
  await expect(page.locator('.month-cal')).toBeVisible();
});

test('month-calendar/overflow: +N more opens the day sheet; row tap opens event detail', async ({ page }) => {
  await open(page, 'overflow');
  const more = page.locator('.month-cal__more').first();
  await expect(more).toHaveText('+3 more');
  await more.tap();
  const sheet = page.locator('.overlay--day-detail');
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('.cal-event')).toHaveCount(6);
  await sheet.locator('.cal-event').first().tap();
  await expect(page.locator('.event-detail')).toBeVisible();
});

test('month-calendar/adjacent-months: nav updates the title; each month section holds its own data', async ({ page }) => {
  await open(page, 'adjacent-months');
  // Current month + one scroll-ahead month are both in the stacked scroller.
  const sections = page.locator('.month-cal__month');
  await expect(sections).toHaveCount(2);
  await expect(sections.nth(0).locator('.month-cal__chip')).toHaveCount(1);
  await expect(sections.nth(1).locator('.month-cal__chip')).toHaveText(/Next month event/);

  const before = await page.locator('[data-month-title]').textContent();
  await page.locator('[data-action="next"]').tap();
  expect(await page.locator('[data-month-title]').textContent()).not.toBe(before);
  await page.locator('[data-action="prev"]').tap();
  expect(await page.locator('[data-month-title]').textContent()).toBe(before);
});

test('month-calendar/typical: legend filters chips to one calendar and back', async ({ page }) => {
  await open(page, 'typical');
  const timChips = page.locator('.month-cal__month').first().locator('.month-cal__chip--tim');
  const otherChips = page.locator('.month-cal__month').first()
    .locator('.month-cal__chip:not(.month-cal__chip--tim)');
  const timCount = await timChips.count();
  const otherCount = await otherChips.count();
  expect(otherCount).toBeGreaterThan(0); // fixture must exercise the filter

  await page.locator('[data-filter="tim"]').tap();
  await expect(timChips).toHaveCount(timCount);
  await expect(otherChips).toHaveCount(0);
  await expect(page.locator('[data-filter="tim"]')).toHaveAttribute('aria-pressed', 'true');

  await page.locator('[data-filter="tim"]').tap(); // tap again = clear
  await expect(otherChips).toHaveCount(otherCount);
});

test('month-calendar/typical: scrolling toward the end appends the next month', async ({ page }) => {
  await open(page, 'typical');
  await expect(page.locator('.month-cal__month')).toHaveCount(2);
  await page.evaluate(() => {
    const s = document.querySelector('[data-scroller]');
    s.scrollTop = s.scrollHeight; // dive toward the end of the loaded range
    s.dispatchEvent(new Event('scroll'));
  });
  await expect(page.locator('.month-cal__month')).toHaveCount(3);
});

// Multi-source model: work chips take the person hue + is-work marker, and
// the person legend filter includes that person's work calendar.
test('month-calendar/overflow: work chips carry person hue + is-work; day sheet shows the Work tag', async ({ page }) => {
  await open(page, 'overflow');
  const workChip = page.locator('.month-cal__chip.is-work').first();
  await expect(workChip).toBeVisible();
  await expect(workChip).toHaveClass(/month-cal__chip--tim/);

  await page.locator('.month-cal__more').first().tap();
  const sheet = page.locator('.overlay--day-detail');
  await expect(sheet).toBeVisible();
  expect(await sheet.locator('.cal-tag--work').count()).toBeGreaterThan(0);
  // Day-sheet chips show the person (colored), not a colorless source slug.
  expect(await sheet.locator('.cal-chip--tim').count()).toBeGreaterThan(0);
});

test('month-calendar/all-day-span: a span running since last month lands on day 1', async ({ page }) => {
  await open(page, 'all-day-span');
  const firstCell = page.locator('.month-cal__day:not(.is-outside)').first();
  await expect(firstCell.locator('.month-cal__chip')).toHaveText(/running since last month/);
});

test('month-calendar/typical: touch swipe on the grid never scrolls the page', async ({ page }) => {
  await open(page, 'typical');
  await touchScroll(page, '.month-cal__grid', -400);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});
