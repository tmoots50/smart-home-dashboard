# Design feedback round — 2026-07-11

Source: Tim's feedback after the 2026-07-10 feature additions, plus two wall-tablet
photos (month view smooshed chips; briefing with truncated Fam Cal titles).
This doc is the contract for the round: every item below ships or gets an explicit
decision from Tim. Check items off as they land.

## 1. Phone button — REMOVE
- [ ] Remove the phone action-bar button entirely (button, PHONE_SVG, LAUNCH_STUBS.phone).
- Accept: action bar shows mic / music / home / month-calendar only.

## 2. Family Calendar card — line items too narrow, smushed
- [ ] Titles cut off too early; must see more of the event title.
- [ ] Hard to tell which DAY an event is on — explore color coding, day/time
      bolding/sizing swaps.
- [ ] Build 2–3 flavors viewable on localhost for Tim's approval, including at
      least one idea OUTSIDE the three-column table.
- Accept: Tim approves a flavor from localhost/screenshots; approved flavor becomes
  the default.

## 3. Family Calendar card — +20% vertical space
- [ ] Fam Cal widget gets ~20% more height (list area 14.25rem → ~17.1rem),
      pushing subsequent sections down.
- Accept: visibly taller card; more rows visible before scroll.

## 4. "See more" modal (What's ahead overlay)
- [ ] Show the actual DATE of each event, not just the weekday.
- [ ] Widen the modal (feels narrow) to make room for the date column.
- Accept: every row shows weekday + month + day; panel noticeably wider than 42rem.

## 5. Month calendar overlay
- [ ] a. Events smooshed together (see photo) — real padding between event blocks.
- [ ] b. Legend showing which color belongs to which calendar.
- [ ] c. Tap a legend entry to FILTER the view to that calendar (tap again = all).
- [ ] d. Month switch repaints twice / flickers — bug. Root cause: nav renders the
      mock/cached "initial" then live data replaces it a beat later, full-panel
      innerHTML swap each time. Fix: no mock fallback for uncached months when a
      token is configured; patch only the grid; skip repaint when data is unchanged.
- [ ] e. Infinite scroll — scroll down into the next month(s); ‹ › arrows still work.
- Accept: chips have visible air between them; legend present; filter works; one
  smooth paint per data change; continuous vertical month scrolling.

## 6. Coming Up module
- [ ] a. Remove Atlanta Picks module entirely (bring back later — keep the widget
      code + curated feed, just unmount from the briefing).
- [ ] b. Coming Up expands to take the full row (both slots).
- [ ] c. Line items shorter: fit ≥4 in the same real estate, same padding/spacing
      ratios; wrap location details when needed.
- [ ] d. Color-code categories: birthdays / recurring (e.g. Chloe heartworm pill) /
      Mabel / travel.
- [ ] e. Split panes: LEFT = important items in the next 4 weeks NOT counting this
      week. RIGHT = next 90 days (no dupes of left) that likely need planning —
      travel, flights, offsites, anything vague or big-effort. Ordered by importance.
- [ ] f. "Have Hermes make ordering decisions and follow these rules." v1 ships a
      deterministic rules engine (category detection + importance scoring) behind a
      single ranking seam. Live-Hermes ranking (relay round-trip, KV-cached) is an
      architecture decision for Tim — see Open questions.
- Accept: Atlanta Picks gone; full-width two-pane Coming Up; ≥4 rows visible per
  pane; category colors legible; windows + dedupe rules enforced.

## 7. Above the fold: ≥3 Todo + ≥3 Grocery items
- [ ] Reduce padding around Todo/Groceries card headers and spacing between all
      widgets on the page.
- [ ] Do NOT strip row padding / shrink fonts — design-contract bands stay intact
      (rowPadding ≥20, cardPadding ≥12, font bands).
- Accept: at 1080×1920, ≥3 todo rows and ≥3 grocery rows fully visible without
  scrolling, rows not smooshed (contract passes).

## Verification
- QA suite green (`app/tests/qa`), specs updated for changed layouts.
- Fresh 1080×1920 screenshots reviewed for: briefing layout, calendar (each
  flavor), countdown, month-calendar, calendar-overlay.
- Visual sign-off recorded at ship time per CLAUDE.md.

## Open questions for Tim
1. Fam Cal flavor pick (localhost/screenshot approval) — blocking only for which
   variant becomes default.
2. Hermes live ordering: OK to ship rules-engine ordering now and wire actual
   Hermes ranking as a follow-up (relay → KV cache, refreshed a few times a day)?
   Synchronous relay calls per render are too slow/rate-limited (6/min, 20s cap).

## Decisions log
- (fill in as items land)
