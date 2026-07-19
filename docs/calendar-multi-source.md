# Multi-source Calendars: Tim (Work) + Caroline (Work)

Feature spec + execution plan + handoff. Started 2026-07-19.

Integrate two more calendars into **both** the dashboard and Hermes:
- **Tim's Narvar work calendar** (Google) — shared into `tim.moots@gmail.com`.
- **Caroline's Outlook work calendar** — via a published ICS feed, fetched directly.

Plus: verify the existing Family + Tim calendars are still properly integrated, and
improve the calendar read/write test suite.

---

## Decisions (locked with Tim, 2026-07-19; #1–2 REVISED same day — see below)

1. **Use case:** Display + ~~write to Tim's own work cal~~ → **read-only** (revised).
   Caroline's stays **read-only**.
2. **Tim work cal connection (REVISED 2026-07-19):** Narvar's Workspace admin caps
   external sharing at free/busy AND hides the secret-iCal address, so neither sharing
   nor ICS works. Instead: a **second OAuth refresh token minted by the work account
   itself** against the dashboard's existing OAuth app (consent tested live — Narvar
   does not block the app). Scope deliberately `calendar.readonly` (least privilege on
   an employer account); config entry
   `{"label":"Tim (Work)","id":"primary","token":"work","person":"Tim","kind":"work","readOnly":true}`
   + env var `GOOGLE_REFRESH_TOKEN_WORK`. Backend supports per-calendar named tokens
   (`google-auth.js getAccessToken(env, name)`); named-token calendars **fail soft** on
   reads (an admin-revoked work token must never blank the family wall) and 403 writes
   like ICS. Stability note: durable until Narvar IT revokes or Tim changes jobs;
   re-wiring at a future employer = re-mint (or their secret-iCal URL if not blocked).
3. **Caroline Outlook connection:** She publishes her Outlook calendar as an **ICS URL**;
   a new dashboard function fetches + parses it directly (NOT subscribed-in-Google, which
   lags 8–24h).
4. **Wall card model:** **Merge work into person columns** — keep 3 columns
   (Family / Tim / Caroline). Tim's column = personal + Narvar work interleaved
   chronologically, work events carry a small **"Work" tag**. Caroline's column = her
   Outlook work feed. The overlay, month view, and Hermes always see all four calendars.

### Key architectural property
The **dashboard is the single integration point.** Hermes holds no calendar credentials —
its `mfb-calendar-*` helpers call the dashboard API with a bearer token. So once a calendar
is wired into the dashboard, Hermes inherits it via the API it already calls.

### Honest limitation (documented, accept for v1)
Direct ICS fetch removes Google's subscribe lag, but Outlook's *published* feed still
refreshes on Microsoft's cadence (~hours), not real-time. Real-time would need Microsoft
Graph OAuth, which Tim declined. Fine for a family wall.

---

## Frozen data contract

Every normalized calendar event (both `/api/calendar` and `/api/calendar/upcoming`) carries:

| field | meaning |
|---|---|
| `id` | event id (ICS recurring instances: `uid::startISO` for uniqueness) |
| `calendar` | **source** label, e.g. `"Tim (Work)"` — used for event-detail + write/edit routing |
| `person` | **column/section**, e.g. `"Tim"` — work + personal calendars for one person share a column. Defaults to `calendar`. |
| `kind` | `"work"` \| `"personal"` — drives the "Work" tag. Defaults `personal`. |
| `readOnly` | bool — `true` for ICS feeds |
| `title`, `sub`, `description`, `startsAt`, `endsAt`, `allDay`, `recurring` | as before |

- **Sections are keyed by `person`** (not raw calendar label).
- **Config:**
  - `GOOGLE_CALENDARS_JSON` entries may include optional `person` + `kind`
    (e.g. `{"label":"Tim (Work)","id":"<shared-cal-id>","person":"Tim","kind":"work"}`).
  - `ICS_CALENDARS_JSON` (NEW): `[{"label":"Caroline (Work)","url":"<ics-url>","person":"Caroline","kind":"work"}]`.
    ICS calendars are always `readOnly`.
- **Writing to an ICS calendar → HTTP 403** (`POST /api/calendar/events`,
  `DELETE|PATCH /api/calendar/events/{id}`), not a confusing 404.

---

## Status by phase

### Phase 0 — De-risk ICS parsing in the CF (workerd) runtime ✅ DONE
- Installed `ical-expander` (prod dep) + `wrangler` (dev dep) in `app/`.
- Smoke-tested a throwaway `/api/_ics_smoke` function via `wrangler pages dev` against a
  realistic Outlook ICS. **Verified in the real workerd runtime:** Windows-named TZID
  (`Pacific Standard Time`) resolved via embedded VTIMEZONE → correct UTC; weekly
  `RRULE MO,WE,FR;COUNT=12` → 11 occurrences after one `EXDATE`; multi-day all-day with
  exclusive end. Throwaway files removed.
- **Conclusion:** library path viable — no hand-rolled RRULE engine needed.

### Phase 1 — Dashboard backend + frontend ✅ DONE (shipped 2026-07-19, commit `2784686`)

**Backend — DONE, 61 unit tests green** (`npx vitest run functions/_lib/`):
- `app/functions/_lib/ics-api.js` (NEW) — `parseIcsCalendars`, `icsCalendarFor`,
  `expandIcs`, `fetchIcsEvents`. KV read-through cache (`ICS_CACHE`, 15-min soft TTL,
  24h hard backstop), **serve-stale** on fetch error, **fail-soft per calendar** (one dead
  feed → `[]` + logged, never blanks the endpoint), recurrence expansion bounded at 5000
  iterations (logged if hit).
- `app/functions/_lib/calendar-api.js` — `normalize()` + `normalizeUpcoming()` extended
  with `person`/`kind`/`readOnly` (backward-compatible defaults).
- `app/functions/api/calendar.js` — fetches Google + ICS together, groups into
  **per-person** sections (`mergeSections`).
- `app/functions/api/calendar/upcoming.js` — merges ICS across all windows (incl. `?all=1`
  for Hermes); passes `person`/`kind` for Google calendars.
- `app/functions/api/calendar/events.js` + `events/[id].js` — **403 read-only guard** via
  `icsCalendarFor` before the write.
- Tests: `functions/_lib/ics-api.test.js` (NEW — recurrence/EXDATE/TZID/all-day/mojibake/
  KV cache/serve-stale/fail-soft/read-only match); `functions/_lib/calendar-api.test.js`
  (updated exact-shape test + person/kind coverage).

**Frontend — PARTIAL. Done so far:**
- `app/src/lib/calendar.js` — retired the `caroline→Family` alias; `canonicalizeUpcoming`
  now preserves the real calendar label and backfills `person`.
- `app/src/lib/calendar.test.js` — updated for the retired alias + `person` field.
- `app/src/lib/comingup.js` — `cardVisibleKeys` now matches the card on `person`.

**Frontend — DONE (2026-07-19).** All items below landed; 387 unit tests + 124 QA
gate tests green; artifact PNGs reviewed (card, overlay, month, briefing-layout) and
shipped with a concrete `VISUAL_SIGNOFF`:
- `calendar-mock.js` — all three mocks carry `calendar`/`person`/`kind`/`readOnly` on
  every event (`withMeta` helper); `Tim (Work)` + `Caroline (Work)` events across
  upcoming/month/card; card mock has a Caroline section + work event inside Tim's.
- `calendar.js` — Work tag in all four flavors (meta line on stacked — never inside the
  2-line clamp; details block on rail/classic; inline on days); `rowAttrs` AND
  `renderDayGrouped` preserve the true source `calendar` + backfill `person` (the
  day-grouped flatMap had the same overwrite bug the plan flagged only in `rowAttrs`);
  day-flavor dots keyed by person.
- `calendar-overlay.js` — `groupByPerson`/`rosterGroups` key on `personOf(ev)`
  (`person || calendar` — fixtures bypass `canonicalizeUpcoming`, so the fallback is
  load-bearing); Work tag inline after titles (no clamp there); chips by person.
- `month-calendar.js` — filter/legend/chip/day-sheet all keyed by person;
  `.is-work` chip = dashed left edge in the person hue (a text pill won't fit a chip).
- **Chip rule locked:** chip *color* + *text* = person everywhere; work-ness = the
  uniform `.cal-tag--work` pill; **event-detail** shows the full true calendar label
  ("Tim (Work)") colored by person (was silently colorless via `cal-chip--tim-work`).
- `global.css` — `.cal-tag` quiet uppercase pill (display-only, row keeps the 44px hit
  area); `.month-cal__chip.is-work` dashed edge.
- Fixtures: `work-dense` states on card + overlay; month `overflow` day carries work
  events; `caroline-unlinked` filters by person. Harness registry needed **zero
  changes** — states flow through automatically.
- QA specs: work-tag + Caroline-column + true-source-routing coverage on all three
  widgets (new states auto-enter the geometry/tap/clipping loops).
- Also: `app/.wrangler/` untracked + gitignored (was committed by the first ship).

### Phase 2 — Hermes helpers ✅ CODE DONE (deploy pending, in Phase 3)
Edited in the hermes-setup repo (`deploy/`), **NOT deployed** (no scp/ssh/launchctl):
- `deploy/bin/mfb-calendar-show` — accepts the two new labels; appends a `(work)` marker
  when `kind==='work'`. (Reads already worked — client-side filter matches whatever the API
  returns.)
- `deploy/bin/mfb-calendar-{add,update,delete}` — **new exit code 68 (read-only)**:
  client-side short-circuit when `--calendar` is `Caroline (Work)` (case-insensitive) AND a
  `403 → exit 68` branch from the dashboard. No retry, no fallback.
- `deploy/AGENTS.md` — capture-routing rows (Tim work → writable, Caroline work → refuse),
  a four-calendar routing table, a read-only paragraph, and exit-code 68 documented.
- `deploy/tests/calendar-crud-test.sh` — Part D (read both new cals → exit 0; writable
  round-trip on `Tim (Work)` with a **skip guard** if unwired) + Part E (critical safety:
  add/update/delete on `Caroline (Work)` each exit 68 + assert nothing leaked). Part E is
  wiring-independent (short-circuit), so it passes now. Teardown extended for `Tim (Work)`.
- `deploy/config.yaml` — no change (wildcard `mfb-calendar-*` allowlist already matches).
- Verified: all helpers + test script pass `bash -n`; short-circuit exit-68 tested live.

**✅ Risk resolved (2026-07-19, live-probed):** the deployed unknown-calendar response is
`404 {"error":"unknown calendar \"<label>\""}` — the D3 skip-guard grep
(`40[34]|unknown calendar|…`) matches, so an unwired `Tim (Work)` skips cleanly instead of
hard-failing.

**Deploy in Phase 3:** review diff → scp helpers → `chmod +x ~/.hermes/bin/mfb-calendar-*` →
`launchctl kill SIGTERM user/501/ai.hermes.gateway` → `deploy/tests/smoke-from-laptop.sh`.

### Phase 3 — Wire real calendars 🔄 TIM'S HALF DONE (2026-07-19); NEEDS CAROLINE
**✅ Tim (Work) — LIVE.** Sharing was admin-blocked (see revised Decision 2), so it went
in via a work-account `calendar.readonly` token instead: token minted (consent passed),
stored as `GOOGLE_REFRESH_TOKEN_WORK` (secret, prod + preview), config entry added,
multi-token backend shipped (`f7e44cd`), live-smoked: reads return titled events with
`person/kind/readOnly`; POST + DELETE both 403 "display-only".

**⚠ Incident during wiring (2026-07-19, resolved):** the first env-var PATCH re-sent the
full env map as returned by GET — but CF never returns `secret_text` VALUES, so
re-sending those keys valueless **wiped `GOOGLE_REFRESH_TOKEN` and
`CF_ACCESS_CLIENT_SECRET`** on prod + preview (~10 min of wall-on-fallback). Both
restored (from `.envrc.local` / `app/.dev.vars`) via **per-key PATCH** — the correct
additive pattern: send ONLY the keys you're changing; never round-trip a GET'd env map
containing secrets.

**Remaining blocking external input:**
1. **Caroline:** publish her Outlook calendar (Outlook Web → Settings → Calendar → Shared
   calendars → Publish a calendar → **ICS** link, "Can view all details") and share the
   **ICS URL**. Full steps: `docs/outlook-setup.md`.

**Then (agent-owned, via CF API / cf-pages-infra — no browser needed):**
- Set `ICS_CALENDARS_JSON = [{"label":"Caroline (Work)","url":"<url>","person":"Caroline","kind":"work"}]`
  (**per-key PATCH only** — see incident above), then trigger a redeploy.
- ✅ `ICS_CACHE` KV namespace created + bound (2026-07-19, id `0597…6898`, production +
  preview, additive — CURATED/HOME_DEVICES/HOME_LOCKOUT preserved). Activates on the
  next deployment; harmless meanwhile since no ICS calls happen until
  `ICS_CALENDARS_JSON` is set.
- **Coordinated cleanup:** if the current config still has the stopgap `{"label":"Caroline",
  "id":"<family-feed>"}` entry, remove it AND retire the backend
  `canonicalCalendarLabel` `caroline→Family` alias in `calendar-api.js` (+ update its test).
  *(Left in place through Phase 1 on purpose — it protects the current stopgap config until
  the real config lands. Don't retire it before the config change or Family events will
  duplicate under a Caroline column.)*
- Deploy Hermes helpers (see Phase 2 deploy steps). **⚠ Before deploying, update
  `deploy/AGENTS.md` + the routing table: `Tim (Work)` is now READ-ONLY** (the Phase 2
  edits assumed writable — capture routing must refuse writes to BOTH work calendars).
  Runtime behavior is already correct without edits (dashboard 403 → helpers' exit-68
  branch; test D3's skip-guard greps `40[34]` so it skips) — only the *docs/routing
  guidance* is stale.
- **Live smoke:** both new calendars read on the dashboard + through Hermes;
  `Tim (Work)` + `Caroline (Work)` writes → 403 (dashboard) / exit 68 (Hermes).
  *(Tim (Work) dashboard-side smoke already done 2026-07-19.)*

### Phase 4 — Verify existing + full test pass 🔄 MOSTLY DONE (2026-07-19)
- ✅ Live-probed **before AND after** the deploy: Family + Tim personal both return real
  events (`?days=7`: 1 Family + 1 Tim, identical pre/post); post-deploy events carry the
  new `person`/`kind`/`readOnly` fields; `/api/calendar` sections person-keyed. Zero
  regression.
- ✅ Dashboard suites: `npx vitest run` (387) + `qa:ship` gate (124) green.
- ✅ Docs: `docs/google-setup.md` updated (§5c shared-work-calendar flow, `person`/`kind`
  fields, `ICS_CALENDARS_JSON` row); `docs/outlook-setup.md` written (publish steps,
  wiring, verify commands, freshness + failure behavior). Pulled forward from Phase 4 —
  they're the artifact that unblocks Phase 3.
- ⏳ Remaining (needs Phase 3 wiring first): Hermes `calendar-crud-test.sh` Parts A–D
  against the live gateway (Part E passes already — wiring-independent).

---

## Verification criteria (definition of done)
- [x] Dashboard wall card shows work meetings (Work-tagged) in Tim's column and
      Caroline's work events in Caroline's column; Family/Tim personal unchanged.
      *(Proven at mock/QA level 2026-07-19; live confirmation once Phase 3 wires the
      real feeds.)*
- [x] Expanded overlay + month view show all four calendars, grouped by person,
      work-tagged. *(Same caveat.)*
- [ ] `POST/PATCH/DELETE` to `Caroline (Work)` → 403; to `Tim (Work)` → success.
      *(403 path unit-tested + guard live-probed via unknown-calendar; needs real wiring.)*
- [ ] Hermes: `show` includes both new calendars; write to `Tim (Work)` works; write to
      `Caroline (Work)` → exit 68, nothing created. *(Exit-68 short-circuit already
      passes; rest needs Phase 3.)*
- [x] Existing Family + Tim personal calendars verified healthy (live probe, pre + post
      deploy, 2026-07-19).
- [x] All dashboard unit tests (387) + QA gate (124) green; Hermes
      `calendar-crud-test.sh` full pass pending Phase 3 deploy.
- [x] ICS feed fails soft (one dead feed never blanks the card or breaks the endpoint) —
      unit-tested; live once a real feed exists.

## Success metrics
- Zero regressions to existing calendars.
- Caroline's work calendar visibly on the wall within Outlook's publish cadence.
- Hermes can answer "what's on Tim's/Caroline's work calendar" and edit Tim's work cal,
  while being structurally unable to mutate Caroline's read-only feed.

---

## Open risks / things to remember
- **Tim (Work) write depends on edit-level external sharing.** Narvar Workspace may only
  allow view-level external sharing → writes fail. Verify in Phase 3 live smoke; fall back
  to read-only + flag to Tim if blocked.
- **Dense work column crowding.** The card caps 6 rows/person; a busy work day can crowd
  Tim's column. Interleave is chronological (intended). Revisit after QA screenshots; option
  to add a per-kind sub-cap later.
- **Outlook publish refresh is hours, not real-time** (inherent to ICS-publish; documented).
- ~~`ICS_CACHE` KV not yet created~~ — created + bound 2026-07-19 (see Phase 3).
- **Backend `canonicalCalendarLabel` caroline→Family alias still present** — intentional;
  retire only in the Phase 3 coordinated config change.
- `wrangler` was added as a dev dependency (useful for local functions smoke); keep unless
  Tim objects.

## Handy commands
- Backend tests: `cd app && npx vitest run functions/_lib/`
- All tests: `cd app && npx vitest run`
- Local functions smoke: `cd app && npx wrangler pages dev <static-dir>` (functions auto-detected)
- QA gate: `cd app && npm run qa:ship`
- Ship: `scripts/ship.sh "feat: …"` (+ `VISUAL_SIGNOFF="…"` when `app/src/` changed)

## Session log
- **2026-07-19 (session 2):** Phase 1 completed + shipped (`2784686`); docs written;
  Phase 4 dashboard-side verification done; Phase 2 skip-guard risk resolved by live
  probe. Everything agent-side is now done — **the only remaining blockers are the two
  external inputs at the top of Phase 3** (Tim: share Narvar cal + send ID; Caroline:
  publish ICS + send URL). Once those arrive: agent wires env vars + `ICS_CACHE` KV via
  cf-pages-infra, does the coordinated stopgap-Caroline/alias cleanup, deploys the Hermes
  helpers, and runs the Phase 3/4 live smokes.
- **2026-07-19 (session 1):** Phases 0/2 done; Phase 1 backend done; frontend partial.
  Hermes background subagent: `a0be52fe5029160ce`.
