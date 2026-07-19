// QA spec — expanded 7-day calendar overlay. Geometry + touch interactions +
// the empirical layout-fit measurement that grounds "how many events SHOULD
// an empty/overflowing view show?" in real device numbers.
import { test, expect } from '@playwright/test';
import { FIXED_NOW } from './clock.js';
import { states } from '../../src/widgets/calendar-overlay.fixtures.js';
import { detectOverflow, auditTapTargets, countFullyVisible, captureArtifact, collectErrors, freezeMotion, touchScroll } from './measure.js';
import { expectNestedScrollContained } from './widget-harness.js';

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

test('overlay/empty-with-later: future events are capped at ten per person', async ({ page }) => {
  await open(page, 'empty-with-later');
  await expect(page.locator('.cal-overlay .overlay__title')).toHaveText("What's ahead");
  await expect(page.locator('.cal-overlay__subtitle')).toHaveText('Next 10 events per person');
  const sections = page.locator('.cal-person');
  await expect(sections).toHaveCount(3);
  for (let i = 0; i < 3; i += 1) {
    await expect(sections.nth(i).locator('.cal-event')).toHaveCount(10);
  }
});

test('overlay/typical: person sections in household order with day column', async ({ page }) => {
  await open(page, 'typical');
  const labels = await page.locator('.cal-person__name').allTextContents();
  expect(labels.map(s => s.trim())).toEqual(['Family', 'Tim', 'Caroline']);
  await expect(page.locator('.cal-event__day').first()).toBeVisible();
});

test('overlay/caroline-unlinked: her section renders "Not linked yet" instead of vanishing', async ({ page }) => {
  await open(page, 'caroline-unlinked');
  const caroline = page.locator('.cal-person--caroline');
  await expect(caroline).toHaveCount(1);
  await expect(caroline.locator('.cal-overlay__unlinked')).toHaveText('Not linked yet');
});

// Multi-source model: Tim's section merges personal + Narvar work (tagged);
// Caroline's section carries her Outlook feed under her own hue.
test('overlay/work-dense: Work tags in Tim\'s section; Caroline\'s section populated', async ({ page }) => {
  await open(page, 'work-dense');
  expect(await page.locator('.cal-person--tim .cal-tag--work').count()).toBeGreaterThan(0);
  expect(await page.locator('.cal-person--caroline .cal-event').count()).toBeGreaterThan(0);
  // Work calendars never spawn their own section — person columns only.
  await expect(page.locator('.cal-person__name').filter({ hasText: '(Work)' })).toHaveCount(0);
});

test('overlay/overflow: body scrolling stays inside the modal', async ({ page }) => {
  await open(page, 'overflow');
  await expectNestedScrollContained(page, '.cal-overlay__body');
});

// A real synthetic TOUCH gesture — the wall tablet's only input. The wheel
// test above exercises a different event path entirely.
test('overlay/overflow: touch swipe scrolls the body, not the page', async ({ page }) => {
  await open(page, 'overflow');
  const body = page.locator('.cal-overlay__body');
  await touchScroll(page, '.cal-overlay__body', -400);
  await expect.poll(() => body.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test('overlay/overflow: person headers stay pinned while their section scrolls', async ({ page }) => {
  await open(page, 'overflow');
  const body = page.locator('.cal-overlay__body');
  await body.evaluate(el => { el.scrollTop = 400; });
  const bodyTop = (await body.boundingBox()).y;
  const heads = page.locator('.cal-person__head');
  const boxes = await heads.evaluateAll(els => els.map(el => el.getBoundingClientRect().top));
  // At 400px deep, at least one header is pinned at (or within a hair of)
  // the scroller's top edge.
  const bodyTopRounded = Math.round(bodyTop);
  expect(boxes.some(top => Math.abs(Math.round(top) - bodyTopRounded) <= 2)).toBe(true);
});
