# Dashboard UX QA — 2026-07-10

Scope: hourly/daily weather, calendar hierarchy and grouping, Family Coming Up,
Atlanta Picks, Todo/Groceries density and reversibility, Bible ribbon, and the
07:00–23:00 light-theme schedule.

## Harness work added

- Added deterministic empty/typical/overflow fixtures for weather, picks,
  Coming Up, Todo, and Groceries.
- Added geometry, horizontal-overflow, touch-target, filtering, link, check/
  uncheck, dismiss, swipe, and nested-scroll coverage.
- Added a real morning-briefing composition smoke test. Isolated widget tests
  cannot catch incorrect module order or a paired row growing past its budget.
- Extracted shared deterministic setup/geometry helpers so new fixture states
  inherit the frozen clock, motion freeze, overflow checks, and touch audit.
- Added real wheel-gesture containment checks at the middle and bottom boundary
  of Calendar, Coming Up, Picks, Todo, and Groceries scrollers.
- Current result: 44 Playwright checks pass at the 1080×1920 design canvas;
  218 unit tests and the production build pass.

## Recommended next improvements (priority order)

1. **Activate the real tablet profile.** Use `?probe=1` on the wall tablet and
   fill `tests/qa/devices.js`. This is the largest remaining coverage gap:
   canvas-only results cannot prove behavior under Fully Kiosk's CSS viewport,
   DPR, and production `?scale=` value.
2. **Promote applicable legacy widgets deliberately.** Harness coverage is
   7/23 source widgets. Some missing files are subcomponents, but Home/Home Card
   and photo loading have meaningful states and touch behavior and should be
   the next fixtures added. Keep the report informational until the real tablet
   profile is active; turning legacy debt into a hard gate now would encourage
   bypasses rather than useful coverage.
3. **Keep the composition smoke test small.** Assert ordering, height budgets,
   overflow, and key item counts only. Widget-specific interactions belong in
   isolated specs, preserving the current ~5-second QA runtime.
