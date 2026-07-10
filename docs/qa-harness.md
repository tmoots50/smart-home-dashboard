# QA Harness — UX testing at exact device resolution

How dashboard changes get QA'd for the thing that actually matters here:
what the family sees and touches on the wall. Unit tests (`vitest`, ~200,
co-located `*.test.js`) cover render logic; this harness covers **layout,
touch, and states** on real rendered pixels.

## One engine, two entry points

```
scripts/ship.sh ──► npm run qa:gate ──► Playwright, deterministic   [BLOCKS PUSH]
  (auto-skips when nothing         │  every fixture state × device profile
   under app/ changed;             │  asserts: no horizontal overflow,
   SKIP_QA=1 = escape hatch)       │  tap targets ≥44px, interactions work,
                                   │  zero console errors
                                   └► pass/fail in ~3s

/qa-harness <widget>  ──► Claude skill, generative                  [HUMAN-IN-LOOP]
  measure → designer's-eye critique per state (ui-audit RUBRIC) →
  implement improvements on a branch → before/after screenshots →
  Tim approves → merge
```

The split is deliberate: a push gate must be fast and deterministic (no LLM,
no judgment calls), while design improvement needs judgment and approval.
Both share the same fixtures, device profiles, and measurement helpers.

## Why there is NO pixel-diff / golden-screenshot assertion

Screenshot baselines are the classic flaky-harness treadmill: font
antialiasing shifts across headless-Chromium versions, `maxDiffPixels` needs
constant retuning, and a flaky gate trains `SKIP_QA=1` reflexes until the
gate is decorative. Everything the gate needs to catch is measurable as
**geometry** (`getBoundingClientRect`, scrollWidth vs clientWidth) and
**behavior** (tap → panel opens) — both deterministic. Screenshots are still
captured on every full run (`npm run qa`) as **review artifacts** in
`app/tests/qa/artifacts/<profile>/` for human/skill eyes. They are never
compared programmatically.

## Determinism rules (why runs never flake)

1. **Frozen clock.** Specs run `page.clock.install({ time: FIXED_NOW })`
   (see `tests/qa/clock.js` — Wed 07:30) before navigation, so `new Date()`
   inside the page — including fixture dates, which are built relative to
   module-load "now" — always resolves to the same instant. Day labels,
   "already past" filtering, everything repeats exactly.
2. **Fixture data only.** The harness page never fetches. States come from
   `*.fixtures.js`, reusing `lib/*-mock.js` where useful.
3. **Motion frozen before measurement.** `freezeMotion(page)` injects
   `tests/qa/freeze.css` right after goto. Found the hard way: `.overlay`'s
   200ms `home-rise` entrance animation transforms the panel, and
   `getBoundingClientRect` mid-animation reads a 44px row as ~43px —
   an intermittent gate failure. CSS animations run on the compositor
   clock; `page.clock` cannot freeze them. Geometry is only meaningful at
   rest, so all measurement happens with motion off.
4. **No retries** (`retries: 0` in `playwright.config.js`). A retry would
   only hide a real flake. If the suite ever flakes, that's a bug in the
   harness — fix the cause, don't tolerate it.

## Device profiles (`tests/qa/devices.js`)

Every spec runs once per profile:

- **canvas** — 1080×1920, DPR 1, touch. The CSS design contract
  (`global.css` pins `.briefing` to `max-width:1080px`).
- **tablet** — the Meswao B3's *real* CSS viewport + DPR + production
  `?scale=`. **Currently a commented placeholder**: load the deployed
  dashboard on the wall tablet with `&probe=1` appended to the kiosk URL
  (the app renders a viewport-numbers overlay — see `main.js`), copy the
  numbers into `devices.js`, uncomment. Bugs hide in the gap between the
  design canvas and what the tablet actually renders — that's why both run.

## Anatomy of a harnessed widget

Pilot pair: `calendar` (card) and `calendar-overlay` (7-day expanded view).

```
app/src/widgets/<widget>.fixtures.js   states: empty/single/typical/overflow/…
app/src/harness/harness.js             WIDGETS entry — mounts ONE widget+state
app/tests/qa/<widget>.spec.js          geometry per state + touch interactions
```

- **Fixtures are browser-safe** (imported by both the harness page and node
  specs): no Playwright imports, no `import.meta.env`.
- **Mounts must mirror `views/morning-briefing.js`** — same card wrappers,
  same event delegation — or the measurements describe a layout the wall
  never shows.
- **Interactions are plain Playwright code** in the spec (`.tap()`,
  `page.keyboard.press('Escape')`, scrim taps via `position:`), not a
  declarative DSL — the first swipe/timing case would have outgrown one.
- View any state by hand: `npm run dev` →
  `http://localhost:5173/harness.html?widget=calendar-overlay&state=overflow`
  (`&theme=`, `&scale=` work like production).

`harness.html` is dev-only: the build is single-entry (`index.html`), so it
never deploys.

## Measurement helpers (`tests/qa/measure.js`)

- `detectOverflow(page)` — horizontal overflow is the universal kiosk bug;
  vertical is design-dependent (the briefing scrolls, overlays shouldn't).
- `auditTapTargets(page, {min: 44})` — every interactive element under the
  floor, with sizes and text, so the failure message names the offender.
- `countFullyVisible(page, container, row)` — the empirical layout-fit
  engine: how many rows fit without scrolling. Grounds "how many events
  should the empty state show?" in measured reality, per profile.
- `freezeMotion(page)` / `captureArtifact(page, name, testInfo)`.

## Commands

```bash
cd app
npm run qa        # full suite + screenshot artifacts
npm run qa:gate   # what ship.sh runs — same asserts, no artifacts (~3s)
npx playwright show-trace test-results/<test>/trace.zip   # debug a failure
```

Gate behavior in `scripts/ship.sh`: runs only when something under `app/`
changed (tracked or untracked); `SKIP_QA=1 scripts/ship.sh "…"` overrides.
If you're overriding twice in a row, the gate is broken — fix the gate.

## Track record

- **First run ever** (2026-07-10, canvas profile): caught 4 real touch-target
  violations — calendar event rows at 38–39px (both card and overlay) and the
  "See more" `btn--text` with a 0-padding hit area — all missed by 200+ unit
  tests and the July-8 UX refresh. Fixed via 44px floors in `global.css`.
- Same day: caught its own flake source (entrance-animation scaling of
  measured geometry) → `freezeMotion` rule above. 0 flakes in 6× stress runs
  of the edit-then-gate sequence since.
