# todo

Ordered task list for v1. Check off as we go. Reorder freely — `spec.md` is the contract, this is just the path.

---

## Phase 0 — Repo hygiene
- [x] Spec moved into `spec.md`
- [x] CLAUDE.md trimmed to AI-collab doc
- [x] Directory scaffold (`app/`, `pi/`, `docs/`, `_context/`)
- [x] GitHub repo (`tmoots50/smart-home-dashboard`) public, pushed
- [x] Move `_context/decisions.md` log entry: "decision history is in `spec.md`; this log captures *new* decisions only"
- [x] First README pass good enough that the repo isn't embarrassing if someone finds it early

## Phase 1 — Hardware foundation (the boring stuff that has to work) ✅ COMPLETE 2026-05-01
- [x] First-boot keyboard+monitor session: SSH on, hostname, WiFi, locale _(wizard 2026-04-30 + hostname change to `dashboard` 2026-05-01)_
- [x] SSH key-based auth from laptop, password auth disabled _(key auth working 2026-05-01; `PasswordAuthentication no` in `/etc/ssh/sshd_config.d/99-no-password.conf`)_
- [-] Static IP via router DHCP reservation _(deferred 2026-05-01 — Tailscale already provides a stable address (`dashboard` / `100.123.125.112`) that works inside and outside the LAN. Logged in `followups.md`. Revisit if/when DHCP rotation actually bites.)_
- [x] Tailscale installed _(2026-05-01; device name `dashboard` on tailnet, Tailscale SSH enabled with `--ssh` flag)_
- [x] Screen rotation working (Wayland / `wlr-randr`) — portrait, persists across reboot _(transform=270 in `~/.config/labwc/autostart`)_
- [x] Touch input mapped correctly to rotated display _(libinput calibration matrix `0 1 0 -1 0 1` via udev rule on Wacom-branded touch device)_
- [x] Display blanking disabled (always-on) _(`raspi-config nonint do_blanking 1`)_
- [x] `log2ram` installed (Chromium cache writes) _(2026-05-01; activates after next reboot)_
- [x] Hostname resolves on `.local` from laptop _(`dashboard.local` via mDNS; also `dashboard` via Tailscale MagicDNS from any tailnet device)_

> **Hardware setup runbook in [`_context/hardware-setup-notes.md`](./_context/hardware-setup-notes.md)** — covers HDMI0 vs HDMI1, cocopar own-power requirement, USB-C is power-only on Pi 5, Magic Keyboard via BT not Lightning, labwc-not-Wayfire compositor, screen rotation + touch matrix recipe. Read before any rebuild.

## Phase 2 — Kiosk loop
*(2026-05-05: pivoted from Pi+Chromium to Meswao tablet + Fully Kiosk Browser + Cloudflare Pages. Pi-side items archived below.)*
- [x] Vite app boots locally on laptop with a "hello world" screen
- [x] Cloudflare Pages deployment configured _(2026-05-05; see `docs/deploy.md`)_
- [ ] Cloudflare Pages first deploy succeeds, URL captured
- [ ] Fully Kiosk Browser side-loaded on Meswao _(handed off to other agent)_
- [ ] Fully Kiosk pointed at the Pages URL with `?kiosk=1`, locked, autostart-on-boot
- [ ] Cold-boot test: power-cycle the tablet, dashboard comes up unattended in <60s
- [ ] WiFi-blip test: drop WiFi for 30s, dashboard recovers without intervention

### Phase 2 — Pi-side items (archived 2026-05-05, not on the v1 critical path)
- [ ] ~~Vite app deployed to Pi (`/opt/dashboard/` or similar), runs on `localhost:4173`~~
- [ ] ~~systemd unit serves the Vite preview build at boot~~
- [ ] ~~systemd unit launches Chromium `--kiosk` pointing at `localhost`~~

## Phase 3 — First widget: clock + date
- [x] `app/src/widgets/clock.js` — pure render, gets `now: Date` as input
- [x] `app/src/widgets/clock.test.js` — render + tick logic
- [x] `app/src/views/morning-briefing.js` — wires the clock in
- [x] Theme tokens in `app/src/lib/theme.js` (typography, palette, spacing)
- [ ] Visible on the Pi at the wall _(handled by Pi-side Claude)_

## Phase 4 — Weather widget
- [x] `lib/weather-mock.js` — fixture data
- [x] `widgets/weather.js` against the mock
- [x] Wire real API (Open-Meteo, no key) _(2026-05-05; `lib/weather.js`)_
- [x] Cache + refresh logic (15min localStorage TTL, fail-soft to mock on error) _(2026-05-05)_
- [ ] Periodic refresh while the page is open (currently only refreshes on load)

## Phase 5 — Calendar widget
- [x] `lib/calendar-mock.js` — today + next 3 events fixture
- [x] `widgets/calendar.js` against the mock
- [x] Decide: Google Calendar embed vs Calendar API — chose **Calendar API** (`/api/calendar` CF Function, OAuth refresh token, `?_lists=1` discovery, `nextEventId`)
- [x] Wire real source — backend built (`functions/api/calendar.js` + `_lib/calendar-api.js`)
- [x] ✅ **LIVE (2026-07-07)** — OAuth app published to Production, refresh token re-minted, `GOOGLE_CALENDARS_JSON` set (Family + Tim primary). `/api/calendar` returns real `sections`; the whole Google data layer (calendar/tasks/photos) came back with the shared-token re-mint. See `_context/active-handoff.md`.
- [ ] iCloud "Caroline & Tim" shared calendar as a 3rd section (deferred — Caroline's Google calendar isn't shared to Tim's account; see `followups.md`)

## Phase 6 — Photo widget
- [x] `lib/photos-mock.js` — local fixture images _(SVG gradients, no binary fixtures)_
- [x] `widgets/photo.js` against the mock (slow crossfade rotation)
- [x] Wire to Google Photos shared album via `/api/photos` CF Pages Function _(2026-05-06)_
- [x] 60s rotation, random sample of up to 30 photos, 1h edge cache _(2026-05-06)_
- [x] Tim: complete one-time Google OAuth setup + CF Pages env vars _(2026-07-07 — `/api/photos` returns 55 real photos)_

## Phase 7 — Daily message widget
- [x] `widgets/aimessage.js` — renders msg with source + time-ago badge
- [x] `lib/aimessage.js` — fetches `/messages.json`, picks today's entry, falls back to most-recent past, then mock _(2026-05-06)_
- [x] `app/public/messages.json` seeded with sample dates
- [x] Remote-push mechanism: edit `messages.json` + git push → CF Pages auto-deploys _(2026-05-06)_

## Phase 8 — Family todos + groceries widgets
- [x] Shape decision (2026-05-05): shared lists in Apple Notes via openclaw bridge — *superseded 2026-05-06*
- [x] Shape decision (2026-05-06): shared lists in **Google Tasks** (Todos + Groceries lists), accessed via CF Pages Functions wrapping the Google Tasks API
- [x] `widgets/{todos,groceries}.js` against mocks
- [x] Build CF Pages Functions: `/api/tasks/[list]` (GET/POST), `/api/tasks/[list]/strike` (POST), discovery endpoint `/api/tasks/_lists` _(2026-05-06)_
- [x] Wire dashboard via `lib/tasks.js` — same {initial, live} + actions contract as iNote had _(2026-05-06)_
- [x] Tim: complete one-time Google OAuth setup _(2026-07-07)_
- [x] Tim: create "Todos" + "Groceries" task lists + capture IDs into CF env vars _(2026-07-07 — `/api/tasks/todos` 20 items, `/api/tasks/groceries` 3 items)_
- [ ] Caroline migration: she installs Google Tasks app, learns the new add/check flow

## Phase 8b — iNote bridge (deferred, code lives in openclaw-setup)
- [x] Built and tested in this repo _(2026-05-06)_
- [x] Moved to `openclaw-setup/bridges/inote/` as a generic capability for any future consumer _(2026-05-06)_

## Phase 9 — Headlines widget
- [ ] Curated source list (dry, no doom)
- [x] `widgets/headlines.js`

## Phase 10 — Aesthetic pass (the wife test)
- [ ] Typography review — single editorial font family, deliberate sizes
- [ ] Palette review — small palette, generous whitespace
- [ ] Show the wall to wife. Iterate until it clears the bar.

## Phase 11 — Operational hardening
- [ ] Always-awake during morning shower window (humidity protection)
- [ ] Sleep schedule (e.g. 11pm–6am) decided and configured
- [ ] Unattended-upgrades for OS packages
- [ ] Watchdog: if Chromium dies, systemd brings it back

## Phase 12 — Portfolio polish
- [ ] Screenshots (rotated, on-wall, with photos)
- [ ] Demo video — boot-to-briefing, ~30s
- [ ] README rewrite: punchy intro, what it is, what I learned, how to rebuild
- [ ] Architecture diagram (`docs/architecture.md`)
- [ ] Pi install runbook (`docs/install.md`) — buildable by a stranger

## Phase 13 — Smart home / Home Assistant *(started 2026-07-06)*
Scope expanded: Aqara U100 lock + smart plugs (in Aqara Home + Apple HomeKit). Design + security model in [`docs/home-assistant.md`](./docs/home-assistant.md); Pi-as-home-server architecture in [`docs/pi-home-server.md`](./docs/pi-home-server.md).
- [x] Design docs + decision log entries (Matter multi-admin, HA Container not HAOS, PIN-gated unlock)
- [x] Mock-first Home overlay — `lib/home-mock.js`, `lib/home.js`, `widgets/home.js` (lock tile + PIN pad + plug tiles), CSS, tests
- [x] Action-bar ⌂ button opens the overlay
- [x] CF Functions `/api/home`, `/api/home/plug`, `/api/home/lock` (PIN verify + KV lockout; 501 until HA configured)
- [x] Shipped to pages.dev in local-mock mode
- [x] **Pi standup** _(2026-07-11: Docker + HA + matter-server + cloudflared live as containers on the Pi; HA onboarded. Reboot-resilience proven organically 2026-07-25 — Pi rebooted, all containers returned healthy)_
- [ ] Commission Aqara devices via Matter; verify Apple Home still controls them (multi-admin); verify plug **wattage reporting** (gates Energy dashboard) _(→ parallel Aqara-hub/Zigbee thread)_
- [x] `cloudflared` container → private HA hostname _(2026-07-11: `ha.mootsproductgroup.com` behind CF Access; `HA_BASE_URL` + `CF_ACCESS_CLIENT_ID/SECRET` set on CF Pages; both KV bindings live. Access→tunnel→HA path live-verified 2026-07-25)_
- [ ] Remaining CF env: `HA_TOKEN` (Tim mints in HA → `scripts/set-ha-token.mjs`), `HA_ENTITIES_JSON` (needs first real entities — Tuya plugs or the lock)
- [ ] Flip `VITE_HOME_LIVE=1`; verify lock/unlock + plug toggle end-to-end on the tablet
- [ ] Network layer: AdGuard/Pi-hole (⚠️ first verify Xfinity gateway allows DHCP DNS override — decision pending)
- [x] Monitoring containers _(2026-07-25: uptime-kuma `:3001` + speedtest-tracker `:8081` up on the Pi; one-time admin claim on each UI still to do)_
- [x] Nightly backups _(2026-07-25: `server-backup.timer` 03:30, `~/server` → `~/backups/server`, 7 daily + 4 weekly, HA DB hot-copied via sqlite online backup; first snapshot integrity-verified)_
- [ ] HA Energy dashboard once plug wattage confirmed

---

## Phase 14 — Spotify in the kiosk *(implementation complete 2026-07-10)*
- [x] OAuth mint helper + setup runbook with complete Web Playback SDK scopes
- [x] Cloudflare player proxy, controls, playlists, search, queue, add-to-playlist, transfer, and short-lived SDK token routes
- [x] Mock-first bottom ticker: local progress, adaptive polling, visibility lifecycle, controls, inactive collapse
- [x] In-dashboard playlist/search drawer + Web Playback SDK + Connect-device fallback
- [x] Unit tests, fixture harness entries, and device QA specs
- [ ] Tim: protected-content/WebView smoke test on the Meswao tablet *(normal
  WebView UA returned Spotify “unsupported” on 2026-07-10; Desktop Mode → Edge
  fake-UA retry in progress; Connect-controller fallback is already built)*
- [ ] Tim: create Spotify app, mint token, set Cloudflare variables, and flip `VITE_SPOTIFY_LIVE=1`
- [ ] Run the eight on-wall acceptance checks in `docs/spotify-setup.md`

## Phase 15 — In-kiosk voice to Hermes *(implementation complete 2026-07-10)*
- [x] Mock-first recording/transcript/countdown/reply overlay + long-press Telegram fallback
- [x] Workers AI Whisper endpoint with 1MB guard, chunked base64, and model fallback chain
- [x] Held `/api/voice/send` relay proxy with timeout/rate/failure mapping
- [x] Localhost-only Telethon/aiohttp relay with fixed peer, constant-time auth, token bucket, one in-flight command, and progress-message quiescence
- [x] LaunchAgent, deploy/smoke scripts, tunnel example, security/runbook docs, fixtures, unit and QA specs
- [ ] Tim: provide domain + registrar; confirm Cloudflare plan and Fully Kiosk PLUS
- [ ] Tim: store Telegram API credentials locally and authorize the user session on the old Mac
- [x] Bind Workers AI to Production + Preview without disturbing KV/env bindings *(2026-07-10)*
- [ ] Create the Cloudflare tunnel/DNS route, set server variables, and flip `VITE_VOICE_LIVE=1` *(token needs Tunnel Edit + Zone Read + DNS Edit)*
- [ ] Verify real tablet webm/opus transcription before polish; complete the six failure drills and 48-hour session check

---

## Phase 16 — Calendar: dinner lane + Coming-Up merge *(shipped 2026-08-01)*
- [x] Dinner lane pinned under the day names — `Dinner: <meal>` all-day events on the Family calendar (`lib/meals.js`; system of record = the calendar; Nigel writes them)
- [x] All-day band doubled to ~4 rows; hour grid's visible span condensed ~25% (still scrolls 5 AM–midnight)
- [x] Standalone Coming-Up card retired → pills strip on the calendar card + expand-over sheet of ≤8 chronological next-90-day rows (`upNext()`; no checkboxes; tap = detail, swipe = dismiss; 60s auto-return)
- [x] Fixtures/harness/QA specs for lane, band cap, strip, sheet, no-reflow expand; fold contract raised to 5 rows
- [x] `scripts/smoke-dinner.mjs` — e2e create → feed → lane → delete via Nigel's endpoint; this week's real dinners created and verified live

---

## Future / parking lot
*Migrated to [`followups.md`](./followups.md). Feature backlog, ideas, limitations, and parking-lot items live there now. This section kept as a pointer.*
