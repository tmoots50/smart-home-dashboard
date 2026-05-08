# Followups

The dumping ground for everything that isn't on the v1 critical path. Active backlog of feature ideas, known limitations, and parking-lot items.

**What lives where:**
- [`spec.md`](./spec.md) — durable contract: what we're building, why, acceptance criteria, decision history, high-level future themes.
- [`todo.md`](./todo.md) — ordered v1 execution checklist.
- **`followups.md`** (this file) — everything else: feature backlog, ideas, limitations, parking lot. Append-only; reorganize when patterns emerge.
- [`_audits/`](./_audits/) — UI audit records over time.

**Format:** four sections. Move items between sections as priority changes. Prune "recently resolved" beyond ~10 items.

---

## Feature backlog — high priority
*(should ship in v1 or shortly after — these are blockers for the wife-test pass)*

- **Apple Notes (iNote) HTTP bridge for todos + groceries.** The dashboard needs to read/write the shared "TODOs" and "Groceries" Apple Notes that already work in the openclaw-setup family-copilot pipeline. Architecture: a tiny HTTP service on the Old Mac wraps the existing `~/.openclaw/bin/mfb-inote-{show,append,strike}` AppleScript helpers and exposes `GET /todos`, `GET /groceries`, `POST /todos { text }`, `POST /todos/strike { text }`. Dashboard fetches over Tailscale (`http://oldmac.tailnet:PORT/...`). Uses the same allowlist + single-match safety rails the helpers already enforce. Critical: the Old Mac must be unlocked and Notes.app warm — see `openclaw-setup/CLAUDE.md` "Apple Notes quirks". Open question: auth (Tailscale ACL only, or shared bearer token).

- **Reflow for portrait 1080×1920.** The dashboard is currently designed and judged in landscape, but the cocopar runs portrait. Precondition for most other UI fixes — type sizes, gutters, density are all provisional until reflow. *Source: `_audits/2026-04-29-ui-audit.md`.*
- **Pick one morning-fold view.** The page currently scrolls roughly three full vertical screens. A wall display has no scroll affordance, so two-thirds of what's been built is invisible to anyone glancing past it. Decide what fits one portrait screen for the morning; demote the rest to a second view (evening, auto-rotated, or tap-reveal). *Source: `_audits/2026-04-29-ui-audit.md`.*
- **Stop letting the clock dominate.** `11:25 PM` is the largest element on screen, but a bathroom has other clocks. The headline slot should go to the highest-information widget — next event, Mabel status, or the daily note. Shrink the clock 30–40% and promote a content widget into the visual lead. *Source: `_audits/2026-04-29-ui-audit.md`.*
- **Bump touch targets to ≥48px (60+ ideal).** Today/Chores checkboxes read ~24px square. Apple HIG floor is 44; kiosk-research consensus for wall displays is 60+. From a wet-handed bathroom tap, 24px is miss-prone. Bump with the tap-area extending across the whole row, not just the checkbox glyph. *Source: `_audits/2026-04-29-ui-audit.md`.* *Partial 2026-05-04: todo edit/delete buttons bumped to 44px, action-bar buttons already 88px. Checkboxes still ~24px.*

- **Swipe-to-delete + drag-reorder for todos.** Replace inline delete button with iOS-style swipe-left-to-reveal-delete; keep edit visible. Add long-press drag-reorder (SortableJS) for todos only — groceries don't need ordering since they're checked off in shop-aisle order, not pre-prioritized. Tradeoff accepted: hidden gesture (Tim will show Caroline). Queued for 2026-05-05 alongside tablet-migration UX work, when the bigger tablet arrives and we can feel the gestures on the real surface. Watch for conflict with the auto-fullscreen `pointerdown` handler in `app/src/main.js`.

## Feature backlog — medium priority
*(post-v1, but architecturally directional — informs how v1 should be structured so they're easy to add)*

- **Time-of-day-driven views.** A "leaving the house" morning fold (weather + next event + transit alert + diaper-bag check) collapses 30s of phone-checking into one glance. The killer feature an off-the-shelf product can't ship — and the natural payoff for the Claude / OpenClaw integration already in `spec.md`. *Source: `_audits/2026-04-29-ui-audit.md`.*

## Ideas / parking lot
*(uncategorized; weighed cost vs. benefit when something else triggers re-evaluation)*

- **Commute card → Maps overlay.** When commute returns to the dashboard, tapping it should open a Maps view with alternate routes. Use case: explore Maps app integration; Caroline can see if the recommended route still wins. (Currently no commute card in the live view since weather replaced it in the time card.)
- **Calendar / Todo "See more" overlays.** Buttons exist (stubs alert "coming soon"). Real version: full-month calendar overlay; full editable todo list with view/edit/delete. Likely a single overlay component reused.
- **Coming Up source = family calendar.** Today the countdown is its own mock. Real wiring: derive from the family Google Calendar with future-dated events tagged "family" or in a dedicated family calendar.
- **iCloud "Caroline and Tim" calendar feed.** Caroline owns a shared iCloud calendar that has a bunch of household events (dinners, plans together) that don't end up on the Google Family calendar. Want it to show up as a third section on the dashboard. Recommended path when this surfaces: ask Caroline to enable Public Calendar on it (iCloud Calendar → right-click → Share Calendar → Public), grab the `webcal://` URL, store as `ICLOUD_CALENDAR_ICS_URL` env var on CF Pages, add a small ICS/VEVENT parser (~40 lines) in `app/functions/api/calendar.js` and merge as a third section. Tradeoff: iCloud caches public feeds 5–15 min so adds take a few minutes to propagate — fine for an ambient kiosk. Blocked on Caroline flipping the public-share toggle (only the calendar owner can do it). Alternatives if Caroline won't share publicly: CalDAV with an Apple app-specific password (~150 lines, real-time, secrets to rotate), or move recurring shared events to the existing Google Family calendar.
- **Monarch Money button → Monarch view.** `?theme=light` shows a `$` button in the action bar (replaces phone). Stubbed alert. Real wiring: open Monarch in the same kiosk window or a focused overlay; show $ goals.

- **USB lavalier mic + Whisper.cpp on the Pi.** ~$30 hardware, one weekend of wiring. Closes the "I'd add this to a chore list but only my phone can type" loop — turns the wall from a display into a capture surface. Pairs with the Claude / OpenClaw integration the spec already anticipates. *Source: `_audits/2026-04-29-ui-audit.md`.*
- **Voice commands via wall mic** (broader than the lavalier idea — full conversational interface). *Migrated from `todo.md`.*
- **Motion-sensor wake/sleep** to extend monitor lifespan and reduce midnight glow. *Migrated from `todo.md`.* **Important: PIR (passive infrared), NOT camera-based.** Fully Kiosk Plus offers camera-based motion via the tablet's front cam; rejected 2026-05-06 because the dashboard mounts in a bathroom — a camera there is a non-starter regardless of on-device-only claims (future Fully bugs, Caroline's comfort, family/guest perception). Real implementation: external PIR sensor (ESP32 + HC-SR501, Aqara wireless, or similar) wired to hit an HTTP endpoint that toggles brightness. v1 fallback: schedule-based dimming via Fully's daily schedule (bright 06:30 → dim 22:00).
- **Display upgrade to Elo 1502L FHD 15.6"** (commercial-grade, 5–7yr humid-bathroom lifespan) if the family loves the v1 build. *Migrated from `todo.md`.*
- **Smart-home control surface** — lights, thermostat, locks — once Home Assistant joins the stack. *Migrated from `todo.md`.*
- **Multi-device personalization** — face/phone-proximity → which view (morning Caroline vs. evening Tim). *Migrated from `todo.md`.*
- **Anthropic Claude / OpenClaw integration** for AI-rearranged views per person/moment. *Migrated from `todo.md`. (Note: also referenced in `spec.md` "What done looks like" — this entry is the implementation parking lot, the spec is the vision.)*
- **Postpartum-arc widget.** The dashboard knows Mabel's age in weeks; surface week-N normalcy hints (Claude-curated, midwife/pediatric sources). Pairs with a real referent for the "Halfway through" greeting. *Source: `_audits/2026-04-29-ui-audit.md` (idea #2).*
- **Photo focal point = Mabel's face.** Today the photo card uses CSS `object-fit: cover` which crops to the geometric center — fine for landscapes, awful for portraits where Mabel's face ends up clipped or off-frame. Want the crop to keep her face centered in the visible card. Implementation options to weigh when this surfaces: (a) Drive folder convention — pre-crop sources to ~16:9 around the face; (b) browser-side `face-api.js`/MediaPipe inference + `object-position` per image; (c) server-side detection (Vision API or onnx model in the Function) and bake `focal: {x, y}` into `/api/photos` response. (a) is simplest, (c) is the only one that scales without tablet CPU cost.

## Active limitations
*(known gaps we're living with for now — explicit accept-it-for-now decisions)*

- **Pi's LAN IP is not reservation-locked.** Currently `10.0.0.110` via DHCP lease; could rotate after a router reboot or lease expiry. Decided 2026-05-01 to skip the Xfinity DHCP reservation flow because Tailscale already provides a permanent stable address (`dashboard` / `100.123.125.112`) that works inside and outside the LAN. Revisit if: (a) we add another LAN device that needs to hit the Pi by hardcoded IP, (b) Tailscale ever has an outage that costs us real time, or (c) DHCP rotation actually shifts the IP and breaks something. Xfinity reservation requires enabling Admin Tool access in the Xfinity app first, then `http://10.0.0.1` → Connected Devices → Edit → Reserved IP.

## Recently resolved
*(last ~10 items, prune older)*

- **Pivot to Google Tasks + Google Photos via CF Pages Functions.** *Resolved 2026-05-06.* Tim ruled out any Old Mac dependency for new features; Apple Notes and Apple Photos are inaccessible from non-Apple infra. Switched: shared lists move to Google Tasks (Caroline migrates from Apple Notes), photos move to Google Photos shared album. Three new Functions (`/api/photos`, `/api/tasks/[list]`, `/api/tasks/[list]/strike`) hold the Google OAuth refresh token server-side; dashboard talks to them with a shared bearer token. Setup runbook in `docs/google-setup.md`.
- **iNote bridge moved to openclaw-setup.** *Resolved 2026-05-06.* The Apple Notes bridge built earlier today moved to `openclaw-setup/bridges/inote/` since this dashboard no longer needs it. Code preserved as a generic capability for any future consumer of the `mfb-inote-*` helpers.
- **Daily message wired via JSON + CF Pages.** *Resolved 2026-05-06.* `app/public/messages.json` keyed by date; `lib/aimessage.js` picks today (or most-recent past) on each load. Publishing = edit + push.
- **Periodic weather refresh.** *Resolved 2026-05-06.* `mountWeather` now refreshes every 15min; long-running kiosk no longer sits on stale data.

- **Touch calibration off after screen rotation (transform=270)** — *Resolved 2026-05-01.* Root cause was double-rotation: the udev rule applied `LIBINPUT_CALIBRATION_MATRIX` at the libinput layer, AND labwc's `rc.xml` applied the output transform via `<touch mapToOutput="HDMI-A-1"/>`. Both layers rotating compounded into the "close but off" symptom. Fix: removed `/etc/udev/rules.d/90-cocopar-touch.rules` (renamed to `.disabled-2026-05-01`), let labwc + `mapToOutput` own touch rotation alone. Verified taps register accurately after reboot. Lesson: on modern wlroots compositors, prefer compositor-level touch mapping over libinput calibration — the two don't compose.
