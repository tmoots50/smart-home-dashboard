// Shared setup and measurements for isolated widget fixture specs. Keep
// widget-specific expectations in each spec; centralize only the deterministic
// mechanics so adding a fixture state stays cheap and consistent.
import { expect } from '@playwright/test';
import { FIXED_NOW } from './clock.js';
import { auditTapTargets, detectOverflow, freezeMotion } from './measure.js';

export async function openHarness(page, widget, state) {
  await page.clock.install({ time: FIXED_NOW });
  await page.goto(`/harness.html?widget=${widget}&state=${state}`);
  await freezeMotion(page);
  await expect(page.locator('html[data-harness-ready]')).toBeAttached();
}

export async function expectHarnessGeometry(page, { tapTargets = true } = {}) {
  const overflow = await detectOverflow(page);
  expect(overflow.horizontal, `horizontal overflow ${overflow.scrollWidth}px > ${overflow.clientWidth}px`).toBe(false);
  if (tapTargets) expect(await auditTapTargets(page)).toEqual([]);
}

// Exercise a real wheel gesture at both the middle and bottom of a nested
// scroller while the document itself is scrollable. `overscroll-behavior:
// contain` should keep the kiosk page stationary even at the inner boundary.
export async function expectNestedScrollContained(page, selector) {
  await page.evaluate(() => { document.body.style.minHeight = '4000px'; });
  const scroller = page.locator(selector).first();
  await expect(scroller).toBeVisible();
  const metrics = await scroller.evaluate(el => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
  expect(metrics.scrollHeight, `${selector} fixture must actually overflow`).toBeGreaterThan(metrics.clientHeight);

  await scroller.hover();
  const pageBefore = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 240);
  await expect.poll(() => scroller.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => scrollY)).toBe(pageBefore);

  await scroller.evaluate(el => { el.scrollTop = el.scrollHeight; });
  const boundaryBefore = await page.evaluate(() => scrollY);
  await scroller.hover();
  await page.mouse.wheel(0, 240);
  expect(await page.evaluate(() => scrollY)).toBe(boundaryBefore);
}
