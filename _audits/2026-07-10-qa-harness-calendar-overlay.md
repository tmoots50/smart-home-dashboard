# QA Harness run — calendar + calendar-overlay — 2026-07-10

First run of the new QA harness (`docs/qa-harness.md`), used both as the
pilot of the measurement engine and as the first full improve-loop. Canvas
profile only (1080×1920); tablet profile pending `?probe=1` numbers.

## Deterministic findings (gate class — fixed immediately)

- **Calendar event rows 38–39px tall** as tap targets (`role="button"`), both
  the card (`.calendar__event`) and the 7-day overlay (`.cal-event`) — under
  the 44px floor. Missed by 212 unit tests and the 2026-07-08 UX refresh
  (which fixed row *actions* but not the rows). Fixed: 2.75rem min-height +
  centered content.
- **`.btn--text` ("See more") had a zero-padding hit area** — visually fine,
  ergonomically a sliver. Fixed: 44px min-height inline-flex box, visual size
  unchanged. Also raised `.list-more .btn--text` from 40px → 44px.
- **Harness self-finding:** `.overlay`'s 200ms `home-rise` entrance animation
  transforms the panel, so `getBoundingClientRect` mid-flight reads a 44px
  row as ~43px — an intermittent false failure. Root-caused (compositor-clock
  animations are immune to `page.clock`) and fixed structurally: all
  measurement happens after `freezeMotion()`. 0 flakes in 6× stress runs of
  the edit-then-gate sequence since.

## Design improvements (approved by Tim 2026-07-10, merged)

1. **7-day overlay groups by person, not by day.** Tim/Family/Caroline
   sections in household order with the card's per-person hues and an inline
   day column ("Today / Tomorrow / Sat"). Chips dropped in rows — the section
   header names the person. `groupBy:'day'` retained in code.
2. **Empty week shows "Coming up".** Instead of one muted line in a
   full-screen panel, the next events beyond the 7-day horizon fill the gap,
   capped at 12 — derived from the measured ceiling of **29 rows fully
   visible before the canvas fold**, not a guess. Briefing fetch widened to
   30 days to feed the later pool. Truly-empty calendar keeps the single
   calm line.

## Numbers

- Overlay fold ceiling (canvas): 29 of 34 overflow rows visible at 1920px.
- Suite: 20 tests (incl. coverage report) ≈ 3s; gate wired into `ship.sh`.
- Unit suite after changes: 218/218.

## Follow-ups filed (followups.md)

Harness remaining widgets (home first); activate tablet profile via probe;
card empty-column "next up" fill with its own fit derivation.
