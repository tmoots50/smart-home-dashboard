# Multi-source Calendars: Tim (Work) + Caroline (Work)

Feature spec + execution plan + handoff. Started 2026-07-19.

Integrate two more calendars into **both** the dashboard and Hermes:
- **Tim's Narvar work calendar** (Google) — shared into `tim.moots@gmail.com`.
- **Caroline's Outlook work calendar** — via a published ICS feed, fetched directly.

Plus: verify the existing Family + Tim calendars are still properly integrated, and
improve the calendar read/write test suite.

---

## Decisions (locked with Tim, 2026-07-19)

1. **Use case:** Display + **write to Tim's own work cal**. Caroline's stays **read-only**.
2. **Tim work cal connection:** Share the Narvar calendar into `tim.moots@gmail.com`; it
   flows through the dashboard's **existing** Google token — one new entry in
   `GOOGLE_CALENDARS_JSON`. No new auth stack, **no OAuth re-mint** (the existing
   `calendar.events` scope already covers writes to shared calendars).
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

### Phase 1 — Dashboard backend + frontend 🔄 IN PROGRESS

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

**Frontend — REMAINING (resume here):**
- [ ] `app/src/lib/calendar-mock.js` — add `Tim (Work)` (person `Tim`, kind `work`) and
      `Caroline (Work)` (person `Caroline`, kind `work`) mock events across
      `getMockUpcoming`, `getMockMonth`, `getMockCalendar`; give every mock event
      `calendar`/`person`/`kind` so tokenless dev + fixtures render the merge model.
      (For `getMockCalendar`, add a `Caroline` section and a work event inside the `Tim`
      section — sections are person-keyed.)
- [ ] `app/src/widgets/calendar.js` — render a small **"Work" tag** on rows where
      `kind==='work'` (stacked/rail/classic + days flavors); in `rowAttrs`, preserve
      `event.calendar` (currently overwritten with the section label) so event-detail/edit
      routes to the true source; day-flavor dots keyed by `person`.
- [ ] `app/src/widgets/calendar-overlay.js` — `groupByPerson` groups by `ev.person`
      (fallback `ev.calendar`); `rosterGroups` `linked` set uses `person`; add the Work tag
      to `renderDatedRow`/`renderDay`; chips colored by `slug(ev.person)`.
- [ ] `app/src/widgets/month-calendar.js` — chip color, `filterEvents`, `legendRoster`,
      and day-detail chip all key off `slug(ev.person)`; add a subtle `is-work` chip
      marker.
- [ ] `app/src/styles/global.css` — add `.cal-tag--work` (small uppercase pill, subtle;
      **do NOT shrink fonts or strip padding** to fit — touch floors via hit area only,
      per CLAUDE.md) and a minimal `.month-cal__chip.is-work` marker. Person colors already
      exist (family=sage `#6dac8e`, tim=coral `--color-accent`, caroline=blue `#6e8faf`) —
      reused, no new color classes needed.
- [ ] Fixtures: `calendar.fixtures.js`, `calendar-overlay.fixtures.js`,
      `month-calendar.fixtures.js` — add states with a **work-dense Tim column** and a
      **populated Caroline column** (the two are the new geometry stressors).
- [ ] Harness registry (`app/src/harness/harness.js`) + QA specs
      (`app/tests/qa/calendar.spec.js`, `calendar-overlay.spec.js`, `month-calendar.spec.js`)
      — cover the Work tag rendering + the Caroline column.
- [ ] `npx vitest run` (all) green, then `npm run qa:ship` gate, **review the artifact
      PNGs** for `calendar`, `calendar-overlay`, `month-calendar`, `briefing-layout`
      (watch the dense-Tim-column density — the 6-row cap can crowd; chronological
      interleave is intended, revisit if it reads badly), then ship with a concrete
      `VISUAL_SIGNOFF="…"`.
- Ship: `scripts/ship.sh "feat: multi-source calendars (Tim Work + Caroline Outlook)"`.
  Backend/functions-only changes skip the QA gate; the `app/src/` frontend changes require
  the visual sign-off.

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

**⚠ Risk flagged by the subagent to check in Phase 3:** the `Tim (Work)` write round-trip
skip guard greps the create response for `40[34]|unknown calendar|not found|no such calendar`.
If the dashboard's *unknown-calendar* error is worded differently, D3 hard-fails instead of
skipping. The contract only fixes the 403 (read-only) body, not the 404 (unknown) body —
sanity-check the real "unknown calendar" response once Phase 3 wiring lands.

**Deploy in Phase 3:** review diff → scp helpers → `chmod +x ~/.hermes/bin/mfb-calendar-*` →
`launchctl kill SIGTERM user/501/ai.hermes.gateway` → `deploy/tests/smoke-from-laptop.sh`.

### Phase 3 — Wire real calendars ⏳ NEEDS TIM + CAROLINE
**Blocking external inputs (only Tim/Caroline can produce these):**
1. **Tim:** share the Narvar calendar into `tim.moots@gmail.com` with **"Make changes to
   events"** (edit) so writes work; then get the shared **calendar ID** (via
   `curl -H "Authorization: Bearer $DASHBOARD_TOKEN" ".../api/calendar?_lists=1"` once
   shared, or Google Calendar settings → Integrate calendar → Calendar ID).
2. **Caroline:** publish her Outlook calendar (Outlook Web → Settings → Calendar → Shared
   calendars → Publish a calendar → **ICS** link) and share the **ICS URL**.

**Then (agent-owned, via CF API / cf-pages-infra — no browser needed):**
- Read current `GOOGLE_CALENDARS_JSON`; add `{"label":"Tim (Work)","id":"<id>","person":"Tim","kind":"work"}`.
- Set `ICS_CALENDARS_JSON = [{"label":"Caroline (Work)","url":"<url>","person":"Caroline","kind":"work"}]`.
- Create + bind a `ICS_CACHE` KV namespace (code fails open without it, so this is an
  optimization, not a hard dependency).
- **Coordinated cleanup:** if the current config still has the stopgap `{"label":"Caroline",
  "id":"<family-feed>"}` entry, remove it AND retire the backend
  `canonicalCalendarLabel` `caroline→Family` alias in `calendar-api.js` (+ update its test).
  *(Left in place through Phase 1 on purpose — it protects the current stopgap config until
  the real config lands. Don't retire it before the config change or Family events will
  duplicate under a Caroline column.)*
- Deploy Hermes helpers (see Phase 2 deploy steps).
- **Live smoke:** both new calendars read on the dashboard + through Hermes; `Tim (Work)`
  write round-trip (create/read/update/delete); `Caroline (Work)` write → 403 (dashboard) /
  exit 68 (Hermes). **If Narvar blocks external edit-sharing, writes to Tim (Work) will
  silently fail** — confirm write actually works, fall back to read-only + tell Tim if not.

### Phase 4 — Verify existing + full test pass ⏳
- Live-probe existing **Family + Tim personal** calendars still return real events
  (`/api/calendar/upcoming?days=1`) after the refactor.
- Full suites: dashboard `npx vitest run` + `npm run qa:gate`; Hermes
  `calendar-crud-test.sh`.
- Docs: update `docs/google-setup.md`; add `docs/outlook-setup.md` (Caroline publish steps +
  Tim share steps + the freshness caveat).

---

## Verification criteria (definition of done)
- [ ] Dashboard wall card shows Tim's work meetings (Work-tagged) in Tim's column and
      Caroline's work events in Caroline's column; Family/Tim personal unchanged.
- [ ] Expanded overlay + month view show all four calendars, grouped by person, work-tagged.
- [ ] `POST/PATCH/DELETE` to `Caroline (Work)` → 403; to `Tim (Work)` → success.
- [ ] Hermes: `show` includes both new calendars; write to `Tim (Work)` works; write to
      `Caroline (Work)` → exit 68, nothing created.
- [ ] Existing Family + Tim personal calendars verified healthy (live probe).
- [ ] All dashboard unit tests + QA gate green; Hermes `calendar-crud-test.sh` green.
- [ ] ICS feed fails soft (one dead feed never blanks the card or breaks the endpoint).

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
- **`ICS_CACHE` KV not yet created** — code fails open (direct fetch each request) until
  Phase 3 creates it. No ICS calls happen at all until `ICS_CALENDARS_JSON` is set.
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

## Session task IDs (for resume)
1 Phase 1 (in_progress) · 2 Phase 0 (done) · 3 Phase 2 · 4 Phase 3 · 5 Phase 4.
Hermes background subagent: `a0be52fe5029160ce`.
