// Composition smoke test: isolated widgets catch local geometry; this catches
// ordering, paired-card heights, and accidental page-width regressions in the
// actual morning briefing. External weather is aborted so the mock first frame
// remains deterministic.
import { test, expect } from '@playwright/test';
import { FIXED_NOW } from './clock.js';
import { detectOverflow, auditDesignContract, auditTextClipping, captureArtifact, freezeMotion, auditTapTargets } from './measure.js';
import { contract } from './design-contract.js';

async function openBriefing(page) {
  await page.clock.install({ time: FIXED_NOW });
  await page.route('https://api.open-meteo.com/**', route => route.abort());
  await page.goto('/?theme=light');
  await freezeMotion(page);
}

test('morning briefing: the calendar card carries the coming-up strip; the duo follows', async ({ page }, testInfo) => {
  await openBriefing(page);

  const calendar = page.locator('[data-slot="calendar"]');
  await expect(calendar).toBeVisible();
  // The standalone Coming-Up card left the page on 2026-08-01 — its rows live
  // behind the calendar card's footer strip now.
  await expect(page.locator('.briefing__updates')).toHaveCount(0);
  await expect(calendar.locator('.calweek__custrip')).toBeVisible();
  const duo = page.locator('.briefing__duo.briefing__lists');
  const [calBox, duoBox] = await Promise.all([calendar.boundingBox(), duo.boundingBox()]);
  expect(calBox.y + calBox.height).toBeLessThanOrEqual(duoBox.y);
  // Atlanta Picks is unmounted (2026-07-11) until further notice.
  await expect(page.locator('.pick__item')).toHaveCount(0);
  expect((await detectOverflow(page)).horizontal).toBe(false);

  // Full-composition design-contract + clipping sweep — the widgets all
  // together is where density regressions actually show.
  const clipped = await auditTextClipping(page);
  expect(clipped, `clipped text: ${JSON.stringify(clipped, null, 2)}`).toEqual([]);
  if (page.viewportSize()?.width === 1080) {
    const offenders = await auditDesignContract(page, contract);
    expect(offenders, `design-contract violations: ${JSON.stringify(offenders, null, 2)}`).toEqual([]);
  }

  await captureArtifact(page, 'briefing-layout', testInfo);
});

test('morning briefing: expanding the strip floats the sheet OVER the duo — nothing reflows', async ({ page }, testInfo) => {
  await openBriefing(page);

  const todos = page.locator('[data-slot="todos"]');
  const before = await todos.boundingBox();
  await page.locator('.custrip__chev').tap();
  await expect(page.locator('.calweek__cusheet')).toBeVisible();
  // The duo must not move — the sheet overlays it (the whole point of the
  // expand-over design; pushing the lists down was explicitly rejected).
  const after = await todos.boundingBox();
  expect(after.y).toBe(before.y);
  const sheet = await page.locator('.calweek__cusheet').boundingBox();
  expect(sheet.y + sheet.height).toBeGreaterThan(after.y); // it genuinely overlaps
  await captureArtifact(page, 'briefing-cu-expanded', testInfo);

  await page.locator('.custrip__chev').tap();
  await expect(page.locator('.calweek__cusheet')).toHaveCount(0);
});

test('morning briefing: ≥3 todo and ≥3 grocery rows land above the fold', async ({ page }) => {
  test.skip(page.viewportSize()?.width !== 1080, 'fold contract is canvas-only');
  await openBriefing(page);

  // The Morning Brief legitimately pushes everything down while it's up
  // (mornings until cleared/noon — approved trade-off, Tim 2026-07-26). The
  // fold contract applies to the dashboard's steady state: clear the brief
  // first, which doubles as a reflow check.
  const daybrief = page.locator('.daybrief');
  if (await daybrief.isVisible()) {
    await daybrief.locator('.daybrief__clear').tap();
    await expect(daybrief).toBeHidden();
  }

  // Raised 3 → 5 on 2026-08-01: merging the Coming-Up card into the calendar
  // freed ~19rem, so the full 5-row mock lists must now clear the fold.
  const fold = page.viewportSize().height;
  for (const selector of ['.todos__item', '.groceries__item']) {
    const rows = page.locator(selector);
    expect(await rows.count(), `${selector} needs ≥5 mock rows to measure`).toBeGreaterThanOrEqual(5);
    const fifth = await rows.nth(4).boundingBox();
    expect(fifth.y + fifth.height, `${selector} row 5 bottom vs fold`).toBeLessThanOrEqual(fold);
  }
});

test('action bar: theme toggle is leftmost, meets the tap floor, and flips light↔dark', async ({ page }, testInfo) => {
  await page.clock.install({ time: FIXED_NOW });
  await page.route('https://api.open-meteo.com/**', route => route.abort());
  // Kiosk mode so a pinned ?theme= is ignored and the toggle drives data-theme
  // (in dev/non-kiosk, ?theme= wins as a preview — see lib/theme-mode.js).
  await page.goto('/?kiosk=1');
  await freezeMotion(page);

  const actionBtns = page.locator('.action-bar .action-btn');
  await expect(actionBtns.first()).toHaveAttribute('data-launch', 'theme');

  // Five buttons now — none may drop below the 44px hit floor and the row must
  // not widen the page (space-between + fixed 4.4rem targets).
  const small = await auditTapTargets(page, { selector: '.action-bar .action-btn' });
  expect(small, `sub-44px action buttons: ${JSON.stringify(small, null, 2)}`).toEqual([]);
  expect((await detectOverflow(page)).horizontal).toBe(false);

  const html = page.locator('html');
  const before = await html.getAttribute('data-theme');
  expect(['fun', 'cosy']).toContain(before);

  await actionBtns.first().click();
  const after = await html.getAttribute('data-theme');
  expect(after).not.toBe(before);
  expect(['fun', 'cosy']).toContain(after);

  // A second tap returns to the starting mode.
  await actionBtns.first().click();
  expect(await html.getAttribute('data-theme')).toBe(before);

  await captureArtifact(page, 'action-bar-theme-toggle', testInfo);
});
