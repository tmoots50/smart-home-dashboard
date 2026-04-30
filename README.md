# Smart Home Dashboard

A wall-mounted, touchscreen morning briefing for our home, built on a Raspberry Pi 5. Time, weather, today's calendar, family todos, a rotating photo, an occasional message — at a glance, on the way out the door.

> **Status:** in development. Started April 2026, target on-the-wall by mid-June 2026.

## Why

I wanted a dashboard that looks like a piece of décor, not a hobbyist gadget. Off-the-shelf smart displays are either ugly, locked-in, or both. I'm on paternity leave with a daughter and a working knowledge of the Pi ecosystem, so I'm building it.

Three goals:
1. Useful enough that my wife actually looks at it every morning
2. Sleek enough to clear her décor bar
3. Public enough to be a credible portfolio piece

## How it's built

- **Display:** cocopar 15.6" 1080P FHD touchscreen, mounted portrait between two existing mirror cabinets in the master bathroom
- **Compute:** Raspberry Pi 5 (8GB, NVMe boot), CanaKit bundle
- **OS:** Raspberry Pi OS 64-bit (Bookworm), headless after first boot
- **Display layer:** Chromium in `--kiosk` mode, autostarted via systemd
- **App:** Vite + vanilla JS, served from the Pi at `localhost:4173`

Architecture: widgets are dumb leaf components, views compose them. Every widget gets a mock-data adapter before any real API is wired — keeps the visual loop fast and turns real-data wiring into a small swap.

## Where things live

| Path | What |
|------|------|
| [`spec.md`](./spec.md) | Project contract: what we're building, why, acceptance criteria |
| [`todo.md`](./todo.md) | Phased v1 task list |
| [`app/`](./app/) | Vite web app — the dashboard itself |
| [`pi/`](./pi/) | Raspberry Pi system config: kiosk launcher, systemd units, install script |
| [`docs/`](./docs/) | Install runbook, architecture notes |
| [`_context/`](./_context/) | Decision log, hardware BOM |

## Run locally

```bash
cd app
npm install
npm run dev          # http://localhost:5173
```

## Deploy on the Pi

See [`docs/install.md`](./docs/install.md) for the full runbook.

## License

MIT (TBD)
