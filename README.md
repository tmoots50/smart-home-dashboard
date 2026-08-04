# Smart Home Dashboard

A wall-mounted, touchscreen morning briefing for our home. Time, weather, today's calendar, family todos, a rotating photo, an occasional message — at a glance, on the way out the door.

> **Status:** live on the wall and in daily use since 2026-04-20.
> **Stack:** a Meswao Android tablet runs Fully Kiosk Browser and loads the dashboard from Cloudflare Pages. The Raspberry Pi already hosts Home Assistant as the live smart-home back end.

## Why

I wanted a dashboard that looks like a piece of décor, not a hobbyist gadget. Off-the-shelf smart displays are either ugly, locked-in, or both. I'm on paternity leave with a daughter and a working knowledge of the Pi ecosystem, so I'm building it.

Three goals:
1. Useful enough that my wife actually looks at it every morning
2. Sleek enough to clear her décor bar
3. Public enough to be a credible portfolio piece

## How it's built

- **Display:** Meswao Android tablet, mounted portrait between two existing mirror cabinets in the master bathroom (1080×1920 target)
- **Display layer:** Fully Kiosk Browser, locked to the dashboard URL
- **Hosting:** Cloudflare Pages, auto-deployed from `main`
- **App:** Vite + vanilla JS
- **Back end:** Raspberry Pi hosts Home Assistant for live device control; Google Calendar and Google Tasks back the dashboard's calendar, todos, and groceries.

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
npm run dev          # http://localhost:5173 — dev server with HMR
npm test             # vitest, watch mode
```

## Deploy

See [`docs/deploy.md`](./docs/deploy.md) for the Cloudflare Pages setup and Fully Kiosk URL params.

The original Pi-side install runbook ([`docs/install.md`](./docs/install.md)) is preserved for reference and for the eventual Home Assistant deployment.

## License

MIT
