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

## Phase 1 — Hardware foundation (the boring stuff that has to work)
- [ ] First-boot keyboard+monitor session: SSH on, hostname, WiFi, locale
- [ ] SSH key-based auth from laptop, password auth disabled
- [ ] Static IP via router DHCP reservation
- [ ] Tailscale installed (so I can fix things after the Pi is on the wall)
- [ ] Screen rotation working (Wayland / `wlr-randr`) — portrait, persists across reboot
- [ ] Touch input mapped correctly to rotated display
- [ ] Display blanking disabled (always-on)
- [ ] `log2ram` installed (Chromium cache writes)
- [ ] Hostname resolves on `.local` from laptop

## Phase 2 — Kiosk loop
- [x] Vite app boots locally on laptop with a "hello world" screen
- [ ] Vite app deployed to Pi (`/opt/dashboard/` or similar), runs on `localhost:4173`
- [ ] systemd unit serves the Vite preview build at boot
- [ ] systemd unit launches Chromium `--kiosk` pointing at `localhost`
- [ ] Cold-boot test: power-cycle the Pi, dashboard comes up unattended in <60s
- [ ] WiFi-blip test: drop WiFi for 30s, dashboard recovers without intervention

## Phase 3 — First widget: clock + date
- [x] `app/src/widgets/clock.js` — pure render, gets `now: Date` as input
- [x] `app/src/widgets/clock.test.js` — render + tick logic
- [x] `app/src/views/morning-briefing.js` — wires the clock in
- [x] Theme tokens in `app/src/lib/theme.js` (typography, palette, spacing)
- [ ] Visible on the Pi at the wall _(handled by Pi-side Claude)_

## Phase 4 — Weather widget
- [x] `lib/weather-mock.js` — fixture data
- [x] `widgets/weather.js` against the mock
- [ ] Wire real API (Open-Meteo? — no key needed, simple)
- [ ] Cache + refresh logic (every 15min, fail-soft on outage)

## Phase 5 — Calendar widget
- [x] `lib/calendar-mock.js` — today + next 3 events fixture
- [x] `widgets/calendar.js` against the mock
- [ ] Decide: Google Calendar embed vs Calendar API (lean: embed for v1)
- [ ] Wire real source

## Phase 6 — Photo widget
- [x] `lib/photos-mock.js` — local fixture images _(SVG gradients, no binary fixtures)_
- [x] `widgets/photo.js` against the mock (slow crossfade rotation)
- [ ] `rclone` Google Drive → local folder cron on the Pi
- [ ] Wire widget to local folder

## Phase 7 — Daily message widget
- [x] `widgets/message.js` — reads from a small JSON file in app/ _(currently mock; JSON wiring deferred)_
- [ ] Remote-push mechanism: edit JSON over SSH? Tiny endpoint? Defer decision.

## Phase 8 — Family todos widget
- [ ] Shape decision: which app does shared todos? (Apple Reminders vs Todoist vs custom)
- [x] `widgets/todos.js` against a mock
- [ ] Wire real source

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

---

## Future / parking lot
*Migrated to [`followups.md`](./followups.md). Feature backlog, ideas, limitations, and parking-lot items live there now. This section kept as a pointer.*
