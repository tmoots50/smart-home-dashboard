# Smart Home Dashboard — Working with AI

This file is for AI coding assistants (Claude Code, Cursor) working in this repo. It's short on purpose. The full project contract lives in [`spec.md`](./spec.md) — read that first.

## Status (one-liner)
Active. Started 2026-04-20. Target: in-use on the wall before paternity leave ends (~2026-06-07).

## Smart-home reality check
Tim's current setup: a few Alexas and a couple of smart plugs. **No Home Assistant, no Hue, no Sonos, no cameras.** When research or inspo references HA-shaped widgets (Mushroom cards, Lovelace, light-scene tiles), treat them as *visual* and *concept* references only — don't propose wiring v1 to a Home Assistant instance that doesn't exist. Build for the household we have, not the one a typical r/homeassistant poster has.

## Where things live
- [`spec.md`](./spec.md) — what we're building, why, and acceptance criteria. Source of truth.
- [`todo.md`](./todo.md) — ordered task list for v1.
- [`app/`](./app/) — Vite web app (the dashboard itself).
- [`pi/`](./pi/) — Raspberry Pi system config (kiosk launcher, systemd units, install scripts).
- [`docs/`](./docs/) — public-facing install + architecture docs, screenshots, demo video.
- [`_context/`](./_context/) — decision log, hardware BOM, working notes.

## Conventions
- **Mock data first.** Every widget gets a mock-data adapter in `app/src/lib/` before touching real APIs. Real-data wiring is a swap, not a rewrite.
- **Tests co-located with code.** `widgets/clock.test.js` next to `widgets/clock.js`. No top-level `tests/` folder.
- **Conventional commits.** `feat:`, `fix:`, `chore:`, `docs:`. Trunk-based — straight to `main`.
- **Node 22 LTS** on both laptop and Pi.
- **Widgets are dumb, views compose.** Widgets render data they're given; views fetch and arrange.

## How to help me

When I ask for help, default to:

1. **Explain the why before the how.** One or two sentences of "here's the principle behind this" before any code.
2. **Show me the smallest working version first.** Then add complexity once I understand the foundation.
3. **Flag tradeoffs explicitly.** "We could do A or B; A is simpler now but B scales better — recommend A for v1." I'll tell you if I want the harder path.
4. **Push back on bad ideas.** Tell me when I'm asking for something over-engineered, premature, or a footgun. Don't just do what I asked if it's wrong.
5. **Catch teaching moments.** If I'm about to commit a common mistake (committing secrets, blocking the event loop, ignoring errors), stop and explain.
6. **Don't be precious about my code.** If a refactor is the right call, say so. If a library is the right call, say so. I'd rather rewrite than carry tech debt at this stage.
7. **Treat me like a tradesperson's apprentice.** I'm here to learn the craft, not just get the project done. Best practices and reasoning matter as much as the working result.
8. **No sycophancy.** Skip "great question," "excellent idea," and similar filler. Get to the substance.
