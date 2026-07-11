// Geometry measurement helpers shared by every QA spec. Everything here is
// deterministic by construction — real numbers from getBoundingClientRect,
// never pixel diffing (see docs/qa-harness.md for why the gate has no
// screenshot comparison).

// Document-level overflow. Horizontal overflow is the universal kiosk bug
// (nowrap content silently widening a grid track past the viewport — see the
// min-width:0 note in global.css). Vertical overflow is design-dependent:
// the briefing scrolls on purpose, overlays shouldn't — the spec decides
// which axis to assert.
export async function detectOverflow(page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    return {
      horizontal: de.scrollWidth > de.clientWidth,
      vertical: de.scrollHeight > de.clientHeight,
      scrollWidth: de.scrollWidth,
      clientWidth: de.clientWidth,
      scrollHeight: de.scrollHeight,
      clientHeight: de.clientHeight,
    };
  });
}

// Every interactive element smaller than `min` CSS px on either axis.
// 44 CSS px is the Apple HIG floor; the kiosk rubric prefers ≥48 for
// distance+touch, so specs may tighten. Returns [] when clean — assert
// toEqual([]) so failures print the offending elements.
export async function auditTapTargets(page, { min = 44, selector = 'button, a[href], input, select, [role="button"]' } = {}) {
  return page.evaluate(({ min, selector }) => {
    const offenders = [];
    for (const el of document.querySelectorAll(selector)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue; // hidden — not tappable
      if (r.width < min || r.height < min) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          classes: el.className?.toString().slice(0, 60) ?? '',
          w: Math.round(r.width),
          h: Math.round(r.height),
          text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40),
        });
      }
    }
    return offenders;
  }, { min, selector });
}

// The empirical layout-fit engine: given a rendered overflow state, how many
// rows are FULLY visible without scrolling? One render, one measurement — no
// re-render binary search (rows are fixed-height). `limit` is the container's
// visible bottom clamped to the viewport.
export async function countFullyVisible(page, containerSel, rowSel) {
  return page.evaluate(({ containerSel, rowSel }) => {
    const container = document.querySelector(containerSel);
    if (!container) return { visible: 0, total: 0, limit: 0 };
    const limit = Math.min(container.getBoundingClientRect().bottom, window.innerHeight);
    const rows = [...container.querySelectorAll(rowSel)];
    const visible = rows.filter((row) => {
      const b = row.getBoundingClientRect();
      return b.top >= 0 && b.bottom <= limit;
    }).length;
    return { visible, total: rows.length, limit: Math.round(limit) };
  }, { containerSel, rowSel });
}

// Chromium-only CDP synthetic touch scroll. The wheel-based nested-scroll
// check misses the touch event path entirely — this is what a finger on the
// wall tablet actually does. Negative yDistance scrolls content down (finger
// swipes up).
export async function touchScroll(page, selector, yDistance = -300) {
  const box = await page.locator(selector).first().boundingBox();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.synthesizeScrollGesture', {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
    yDistance,
    speed: 800,
    gestureSourceType: 'touch',
  });
  await cdp.detach();
}

// Kill all animation/transition motion. Call RIGHT AFTER page.goto, before
// any geometry read: entrance animations (e.g. .overlay's home-rise) apply
// transforms that scale getBoundingClientRect results mid-flight, and CSS
// animations run on the compositor clock — page.clock cannot freeze them.
export async function freezeMotion(page) {
  await page.addStyleTag({ path: new URL('./freeze.css', import.meta.url).pathname });
}

// Screenshot as a review ARTIFACT for Tim / the qa-harness skill — never a
// pass/fail baseline. Assumes freezeMotion() already ran (specs call it in
// their open() helper). Skipped in gate mode (QA_GATE=1) for speed.
export async function captureArtifact(page, name, testInfo) {
  if (process.env.QA_GATE) return;
  await page.screenshot({
    path: `tests/qa/artifacts/${testInfo.project.name}/${name}.png`,
    fullPage: true,
  });
}

// Console/page errors collected from before navigation. Call FIRST, assert
// toEqual([]) LAST. Vite dev-client noise is info-level, so anything at
// error level is a real problem.
export function collectErrors(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}
