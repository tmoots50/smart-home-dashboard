// QA spec — two-pane Coming-Up card. Geometry, the ≥4-rows-per-pane density
// contract from the 2026-07-11 feedback, rules-engine placement, category
// colors, and the complete/dismiss touch interactions.
import { test, expect } from '@playwright/test';
import { states } from '../../src/widgets/countdown.fixtures.js';
import { captureArtifact, collectErrors } from './measure.js';
import { expectHarnessGeometry, expectNestedScrollContained, openHarness } from './widget-harness.js';

async function open(page, state) {
  await openHarness(page, 'countdown', state);
}

for (const state of Object.keys(states)) {
  test(`countdown/${state}: two-pane geometry`, async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    await open(page, state);
    await expect(page.locator('.countdown__pane')).toHaveCount(2);
    await expectHarnessGeometry(page);
    await captureArtifact(page, `countdown-${state}`, testInfo);
    expect(errors).toEqual([]);
  });
}

test('countdown/typical: at least 4 rows fully visible per pane without scrolling', async ({ page }) => {
  await open(page, 'typical');
  for (const pane of [0, 1]) {
    const visible = await page.locator('.countdown__pane').nth(pane).evaluate((el) => {
      const list = el.querySelector('.countdown__list');
      const limit = list.getBoundingClientRect().bottom + 1;
      return [...list.querySelectorAll('.countdown__item')]
        .filter(item => item.getBoundingClientRect().bottom <= limit).length;
    });
    expect(visible, `pane ${pane} shows ${visible} full rows`).toBeGreaterThanOrEqual(4);
  }
});

test('countdown/typical: this-week items appear in neither pane', async ({ page }) => {
  await open(page, 'typical');
  await expect(page.locator('.countdown')).not.toContainText('This week thing');
});

test('countdown/typical: nothing sooner than 3 days out in the left pane', async ({ page }) => {
  await open(page, 'typical');
  const leftDays = await page.locator('.countdown__pane').first().locator('.countdown__days').allTextContents();
  expect(leftDays.length).toBeGreaterThan(0);
  for (const label of leftDays) {
    expect(label).not.toMatch(/^(today|tomorrow|2 days)$/);
  }
});

test('countdown/typical: row tap opens the event-detail panel; check tap does not', async ({ page }) => {
  await open(page, 'typical');
  const row = page.locator('.countdown__pane').first().locator('.countdown__item').first();

  await row.tap(); // row body → drill-down, same as the calendar card
  await expect(page.locator('.event-detail')).toBeVisible();
  await page.locator('.overlay--event-detail [data-action="close"]').tap();
  await expect(page.locator('.event-detail')).toHaveCount(0);

  await row.locator('.countdown__check').tap(); // check → complete, not detail
  await expect(page.locator('.event-detail')).toHaveCount(0);
  await expect(page.locator('.countdown__item--done')).toHaveCount(1);
  await row.locator('.countdown__check').tap(); // undo the linger for a clean state
});

test('countdown/typical: plan-ahead pane is importance-ordered and dupe-free', async ({ page }) => {
  await open(page, 'typical');
  const names = await page.locator('.countdown__pane').nth(1).locator('.countdown__name').allTextContents();
  // Travel outranks offsite outranks big-effort outranks vague.
  expect(names[0]).toMatch(/Flight to NYC|Stay at Hamilton/);
  expect(names.indexOf('Narvar offsite')).toBeLessThan(names.indexOf('Baby shower for Kate'));
  expect(new Set(names).size).toBe(names.length);
});

test('countdown/typical: all four category colors present on row edges', async ({ page }) => {
  await open(page, 'typical');
  for (const cat of ['birthday', 'recurring', 'mabel', 'travel']) {
    await expect(page.locator(`.countdown__item--${cat}`).first()).toBeVisible();
  }
});

test('countdown/typical: tap check completes (with linger undo), swipe dismisses with toast undo', async ({ page }) => {
  await open(page, 'typical');
  const items = page.locator('.countdown__pane').first().locator('.countdown__item');
  const initial = await items.count();

  // Tap check → struck but still present; tap again during linger → undone.
  await items.first().locator('.countdown__check').tap();
  await expect(page.locator('.countdown__item--done')).toHaveCount(1);
  await expect(items).toHaveCount(initial);
  await items.first().locator('.countdown__check').tap();
  await expect(page.locator('.countdown__item--done')).toHaveCount(0);

  // Complete again and let the linger elapse → row clears.
  await items.first().locator('.countdown__check').tap();
  await page.clock.runFor(3000);
  await expect(items).toHaveCount(initial - 1);

  // Swipe left → dismissed immediately, undo toast restores it.
  const row = items.first();
  await row.dispatchEvent('pointerdown', { clientX: 220 });
  await row.dispatchEvent('pointerup', { clientX: 100 });
  await expect(items).toHaveCount(initial - 2);
  await expect(page.locator('.toast__action')).toBeVisible();
  await page.locator('.toast__action').tap();
  await expect(items).toHaveCount(initial - 1);

  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test('countdown/overflow: internal scrolling stays inside each pane', async ({ page }) => {
  await open(page, 'overflow');
  await expectNestedScrollContained(page, '.countdown__pane:first-child .countdown__list');
  await expectNestedScrollContained(page, '.countdown__pane:last-child .countdown__list');
});
