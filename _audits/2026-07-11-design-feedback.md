# Design feedback round — 2026-07-11

Source: Tim's feedback after the 2026-07-10 feature additions, plus two wall-tablet
photos (month view smooshed chips; briefing with truncated Fam Cal titles).
This doc is the contract for the round: every item below ships or gets an explicit
decision from Tim. Check items off as they land.

## 1. Phone button — REMOVE
- [x] Removed the phone action-bar button entirely (button, PHONE_SVG, LAUNCH_STUBS).
- Accept: action bar shows mic / music / home / month-calendar only. ✔ verified in screenshot.

## 2. Family Calendar card — line items too narrow, smushed
- [x] Four flavors built behind `?calflavor=` (persists in localStorage):
      `stacked` (default) — title-first 2-line rows, day bolded/accented below;
      `rail` — day/time column leads + proximity rail (accent fades with distance);
      `days` — day-grouped full-width list, person dots + legend (the outside-the-box one);
      `classic` — the old layout for comparison.
- [x] Titles: 2-line wrap in stacked/rail, full-width single line in days.
- [x] Day identification: bold day, accent when today (stacked); proximity rail (rail);
      day section headers (days).
- [ ] **Tim picks the default** — screenshots + `?calflavor=` links delivered; `stacked`
      is the shipped default until he says otherwise.

## 3. Family Calendar card — +20% vertical space
- [x] List scroll region 14.25rem → 17.1rem (both column list and day-grouped list).

## 4. "See more" modal (What's ahead overlay)
- [x] Every row's day cell now stacks weekday over the real date ("Fri / Jul 17").
- [x] Panel widened 42rem → 58rem.

## 5. Month calendar overlay
- [x] a. Padding: cell gap 2→5px, chip padding 2→5px, grid gap 3→6px. Also fixed the
      REAL smoosh artifact from the photo: the 2-line clamp sat on the 44px-min button,
      so short-but-wrapping titles skipped the clamp and a third line got razor-clipped
      mid-glyph. Clamp moved to an inner span.
- [x] b. Legend (Family/Tim/Caroline pills with dots) under the title.
- [x] c. Legend pills toggle a per-calendar filter (tap again = all).
- [x] d. Flicker fix: month sections render once and are patched in place only when
      live data differs; getMonth() no longer serves MOCK months for uncached months
      when a token is configured (that fake-then-real repaint was the "reloads twice").
- [x] e. Infinite scroll: months stack in one scroller (next month appends as you
      approach the end, scroll-snap per month); ‹ › arrows scroll month-by-month and
      prepend past months. Still clamped to ±12 months.

## 6. Coming Up module
- [x] a. Atlanta Picks unmounted from the briefing (widget + curated feed + harness
      kept for its return).
- [x] b. Coming Up owns the full-width row (same 21rem real estate).
- [x] c. Compact rows: title + countdown/date on one line, location wraps below;
      ≥4 rows fully visible per pane (QA-asserted), same padding ratios.
- [x] d. Category colors on the row edge + header legend: birthdays (plum #b07cc6),
      recurring (gold accent), Mabel (rose #d98a9c), travel (sky #5fa8d3).
- [x] e. LEFT "Next 4 weeks": chronological, starts AFTER this week (Sun–Sat weeks).
      RIGHT "Plan ahead · 90 days": planning-worthy only (travel/flight/offsite/
      big-effort/vague/multi-day stays), importance-ordered, no dupes of left,
      repeating series collapsed to first occurrence.
- [x] f. Rules engine = `lib/comingup.js` (pure, unit-tested) — the Hermes seam.
      API now emits `recurring` from Google's recurringEventId.
- [ ] **Hermes live ranking** — needs Tim's call (see Open questions).

## 7. Above the fold: ≥3 Todo + ≥3 Grocery items
- [x] Inter-widget gap 16→10px; card header margins 16→8px. Row padding, card insets,
      fonts untouched (design-contract bands all pass).
- [x] Measured at 1080×1920: 3rd todo/grocery row bottoms at ~1500px vs 1920 fold —
      the whole Todo/Groceries/Home block is above the fold now. Locked in
      briefing-layout.spec.js as a permanent fold assertion.

## Verification
- [x] 327 unit tests pass (13 new comingup + rewritten countdown/calendar suites).
- [x] 115 Playwright QA tests pass (canvas profile), incl. new specs: two-pane density,
      importance ordering, category colors, legend filter, infinite-scroll append,
      per-section month data, fold assertion.
- [x] Artifacts visually reviewed: briefing-layout, calendar (all four flavors),
      countdown, month-calendar, calendar-overlay.

## Open questions for Tim
1. **Fam Cal flavor pick** — `stacked` shipped as default. Try on the wall or localhost:
   `?calflavor=stacked` / `rail` / `days` / `classic` (choice persists per device).
2. **Hermes live ordering**: rules engine ships now. Wiring actual Hermes ranking means
   a relay round-trip cached in KV (refreshed a few times/day) — synchronous calls per
   render are too slow/rate-limited (6/min, 20s cap). Green-light the KV+cron follow-up?

## Round 2 (same day, from Tim's live-wall photo + answers)
- [x] **Flavor decision: `stacked` confirmed as default** (was already shipped).
- [x] **Fam Cal column misalignment fixed** — long unbroken location text inflated the
      Family column's 1fr track (stacked rows lost the min-width chain). Now
      `repeat(3, minmax(0,1fr))` + `min-width:0` on columns: addresses truncate,
      columns stay equal.
- [x] **Location details removed from Coming Up rows** — one-line rows; that depth
      lives in the calendar card / event detail.
- [x] **Hermes ordering = rules engine + ad-hoc override channel** (Tim's pick):
      `GET/POST /api/comingup` stores `{match, score?, pane?, hide?}` overrides in the
      CURATED KV namespace (key `comingup-overrides`, no new binding). Widget merges
      them into `rankComingUp()` on each refresh (≤5 min; hide / reorder / force-pane).
      Hermes-side skill: POST with the dashboard bearer token, e.g.
      `curl -X POST https://smart-home-dashboard-de0.pages.dev/api/comingup \
        -H "authorization: Bearer $DASHBOARD_TOKEN" -H "content-type: application/json" \
        -d '{"overrides":[{"match":"water hanging","hide":true},{"match":"St George Island","score":900}]}'`
      → needs a small `dash-comingup` helper + prompt note on the Old Mac (hermes-setup
      repo) so Tim can say "move X up" in Telegram. Tracked in followups.md.

## Decisions log
- Left pane kept CHRONOLOGICAL (agenda scanning), right pane importance-ordered —
  reading of "order by importance" as governing the plan-ahead list. Flag if wrong.
- "Grandma visiting"-style multi-day all-day events classify as travel/planning.
- Repeating series (daily watering) collapse to first occurrence in Coming Up.
- Recurring detection: API `recurring` flag first, title patterns as fallback.
