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
//
// Fix offenders by EXTENDING THE HIT AREA — row/button padding, a
// transparent wrapper, or making the whole row the target — never by
// inflating the visible element, shrinking fonts, or stripping padding to
// make the geometry math pass. The visual bands are locked in
// design-contract.js; if a band seems wrong, ask Tim — don't move it.
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

// Design-contract audit — the guardrail against the 2026-07 class of
// regression (inflated checkboxes, stripped padding, shrunken type). Bands
// live in design-contract.js. Canvas profile only: rem-based values scale
// with the tablet's ?scale= and would need per-profile bands (followups.md).
// Returns [] when clean.
export async function auditDesignContract(page, contract) {
  return page.evaluate((c) => {
    const offenders = [];
    const each = (sel, fn) => {
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue; // hidden
        const o = fn(el, r, getComputedStyle(el));
        if (o) offenders.push({ sel: el.className?.toString().slice(0, 50), ...o });
      }
    };
    each(c.checkbox.selector, (el, r) =>
      (r.width < c.checkbox.size[0] || r.width > c.checkbox.size[1]
        || r.height < c.checkbox.size[0] || r.height > c.checkbox.size[1])
        ? { rule: 'checkbox visual size', w: Math.round(r.width), h: Math.round(r.height), band: c.checkbox.size }
        : null);
    each(c.rowPadding.selector, (el, r, s) => {
      const pad = parseFloat(s.paddingTop) + parseFloat(s.paddingBottom);
      return pad < c.rowPadding.minVerticalPadding
        ? { rule: 'row padding stripped', pad: Math.round(pad), min: c.rowPadding.minVerticalPadding }
        : null;
    });
    each(c.cardPadding.selector, (el, r, s) => {
      const pads = [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map(parseFloat);
      return Math.min(...pads) < c.cardPadding.minPadding
        ? { rule: 'card padding stripped', pads: pads.map(Math.round), min: c.cardPadding.minPadding }
        : null;
    });
    for (const f of c.fontRoles) {
      each(f.selector, (el, r, s) => {
        const px = parseFloat(s.fontSize);
        return (px < f.size[0] || px > f.size[1])
          ? { rule: `font: ${f.role}`, px: Math.round(px * 10) / 10, band: f.size }
          : null;
      });
    }
    return offenders;
  }, contract);
}

// Text amputated without a deliberate truncation style — the check the
// 2026-07 regression would have tripped (notes clipped mid-line). Only
// elements with direct text nodes. Designed clipping is exempt:
// text-overflow: ellipsis (h) and -webkit-line-clamp (v). Limitation, on
// purpose: text painting OUTSIDE an overflow-visible auto-height box isn't
// detectable here (scrollHeight == clientHeight there) — that class is
// covered by detectOverflow + the ship-time visual review. +1px absorbs
// engine rounding.
export async function auditTextClipping(page, { root = 'body' } = {}) {
  return page.evaluate((rootSel) => {
    const offenders = [];
    const rootEl = document.querySelector(rootSel);
    if (!rootEl) return offenders;
    for (const el of rootEl.querySelectorAll('*')) {
      if (!Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim())) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const s = getComputedStyle(el);
      if (['hidden', 'clip'].includes(s.overflowX) && el.scrollWidth > el.clientWidth + 1
          && s.textOverflow !== 'ellipsis') {
        offenders.push({ rule: 'h-clip without ellipsis', cls: el.className?.toString().slice(0, 50), text: el.textContent.trim().slice(0, 40) });
      }
      if (['hidden', 'clip'].includes(s.overflowY) && el.scrollHeight > el.clientHeight + 1
          && (s.webkitLineClamp === 'none' || s.webkitLineClamp === undefined)) {
        offenders.push({ rule: 'v-clip without line-clamp', cls: el.className?.toString().slice(0, 50), text: el.textContent.trim().slice(0, 40) });
      }
    }
    return offenders;
  }, root);
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
// their open() helper). Skipped in plain gate mode (QA_GATE=1) for speed;
// qa:ship sets QA_ARTIFACTS=1 so ship-time runs assert AND refresh the
// artifacts the visual sign-off reviews.
export async function captureArtifact(page, name, testInfo) {
  if (process.env.QA_GATE && !process.env.QA_ARTIFACTS) return;
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
