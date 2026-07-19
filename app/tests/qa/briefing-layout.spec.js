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

test('morning briefing: calendar precedes the full-width Coming-Up row', async ({ page }, testInfo) => {
  await openBriefing(page);

  const calendar = page.locator('[data-slot="calendar"]');
  const updates = page.locator('.briefing__updates');
  await expect(calendar).toBeVisible();
  await expect(updates).toBeVisible();
  const [calBox, updatesBox] = await Promise.all([calendar.boundingBox(), updates.boundingBox()]);
  expect(calBox.y + calBox.height).toBeLessThanOrEqual(updatesBox.y);
  // .briefing__updates keeps the 21rem (336px) real estate the old duo row
  // had — Coming Up widened into the Atlanta Picks slot, it didn't grow down.
  expect(updatesBox.height).toBeLessThanOrEqual(344);
  await expect(updates.locator('.countdown__pane')).toHaveCount(2);
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

test('morning briefing: ≥3 todo and ≥3 grocery rows land above the fold', async ({ page }) => {
  test.skip(page.viewportSize()?.width !== 1080, 'fold contract is canvas-only');
  await openBriefing(page);

  const fold = page.viewportSize().height;
  for (const selector of ['.todos__item', '.groceries__item']) {
    const rows = page.locator(selector);
    expect(await rows.count(), `${selector} needs ≥3 mock rows to measure`).toBeGreaterThanOrEqual(3);
    const third = await rows.nth(2).boundingBox();
    expect(third.y + third.height, `${selector} row 3 bottom vs fold`).toBeLessThanOrEqual(fold);
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
