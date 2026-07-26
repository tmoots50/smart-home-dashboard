# Smart Home Dashboard — Working with AI

This file is for AI coding assistants (Claude Code, Cursor) working in this repo. It's short on purpose. The full project contract lives in [`spec.md`](./spec.md) — read that first.

## Status (one-liner)
Active since 2026-04-20; on the wall and in daily use. Smart-home layer (Home Assistant) went live 2026-07-25.

## Smart-home reality check
**Updated 2026-07-25 — Home Assistant is live; the Home overlay drives real devices.** HA runs on the Pi as the household's control brain (HA + `matter-server` + `cloudflared` Docker containers, reboot-resilient). The dashboard's **Home overlay** (`widgets/home.js`, action-bar ⌂) + `/api/home*` CF Functions proxy HA over a Cloudflare Tunnel (HA behind CF Access; HA token server-side only). It's **live in Production** — `VITE_HOME_LIVE=1` is set and `/api/home` returns real HA state: the **Aqara U100 lock** ("Front Door") + **4 lamps** (`switch.*`). Scene modes and plug toggles actuate the real lamps; lock/unlock is real.

**Unlock is one-tap — no PIN.** The deadbolt is reachable only over the home network (wall tablet / HA behind CF Access + Tunnel), so unlock is gated by the shared bearer token like any other action; the earlier PIN + KV-lockout path was dropped from `lock.js` and its vestigial helpers removed (2026-07-25). The Hermes agent's token is **admin-tier by design** (same trust level as the dashboard token) — it owns direct dashboard changes and can drive every action, including unlock. A PIN / per-action second factor for specific sensitive tasks is a deliberate later option; if added, it lives at the `lock.js` layer.

Tim's devices: Aqara U100 lock (also on Apple Home via Matter), **Gosund (Wi-Fi/Tuya) + Linkind** plugs, a **Pura diffuser**. Still ahead (see `todo.md` Phase 13 + `followups.md`): verify plug **wattage reporting** (gates the HA Energy dashboard), the **Zigbee coordinator** for Linkind + future sensors, the network layer (AdGuard/Pi-hole), and eventually **replacing Alexa for voice** with a local HA Assist pipeline. Don't over-scale beyond the lock + a handful of allowlisted plugs. Design/BOM/build-order detail is in [`docs/home-assistant.md`](./docs/home-assistant.md) (a design record — its "Security model" PIN section predates the no-PIN change).

*(Historical note: this section previously said "no Home Assistant — don't wire to it," then "no hub — mock-first until standup." Both were true in their time and are why older inspo in `_context/ui-inspo.md` still carries HA caveats.)*

## Where things live
- [`spec.md`](./spec.md) — what we're building, why, and acceptance criteria. Source of truth.
- [`todo.md`](./todo.md) — ordered task list for v1.
- [`app/`](./app/) — Vite web app (the dashboard itself).
- [`pi/`](./pi/) — Raspberry Pi system config (kiosk launcher, systemd units, install scripts).
- [`docs/`](./docs/) — public-facing install + architecture docs, screenshots, demo video.
- [`_context/`](./_context/) — decision log, hardware BOM, working notes.

## Local credentials
`.envrc.local` (gitignored) holds CF API + Google OAuth values used by the
scripts under `scripts/`. **Before running any script that needs them, source
the file in the same Bash invocation:**

```bash
source .envrc.local && node scripts/...
```

Provides: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
`CLOUDFLARE_PAGES_PROJECT`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`GOOGLE_REFRESH_TOKEN`. If the file is missing, ask Tim to recreate it; do
not paste tokens into commits or chat history.

## Shipping changes to pages.dev
Tim does most testing on the deployed CF Pages URL (`smart-home-dashboard-de0.pages.dev`), not the local dev server. **Agents ship to production themselves** — Tim does not handle deployment. After making a change:

```bash
scripts/ship.sh "feat: short conventional-commit message"
```

That one command stages all changes, commits with the given message, and pushes to `main` — CF Pages auto-rebuilds in ~1-2 min. Always pass a meaningful conventional-commit message; the script auto-generates a `wip:` one if omitted, but explicit beats default.

**Agent behavior on `ship.sh` gates:**
- If `app/` UI code changed: the QA gate runs first. If it fails, fix the failures — don't use `SKIP_QA=1` unless explicitly told to. The visual sign-off is also required: Read the PNG artifacts under `app/tests/qa/artifacts/<profile>/` for every widget you touched, then re-run with `VISUAL_SIGNOFF="checked <widget>: <what you saw>" scripts/ship.sh "…"`.
- If only `app/functions/` (backend) or non-`app/` files changed: `ship.sh` skips the QA gate and visual sign-off. Just run it.
- If `app/src/` already has uncommitted changes you didn't touch: commit only your files with `git add <your-files> && git commit -m "…" && git push` to avoid bundling unrelated work-in-progress.

**Tim only intervenes for:** Google OAuth re-auth, CF API token rotation, or anything that requires a browser sign-in to a Google/Cloudflare account.

## Conventions
- **Mock data first.** Every widget gets a mock-data adapter in `app/src/lib/` before touching real APIs. Real-data wiring is a swap, not a rewrite.
- **Kiosk interactions stay in context.** Use modals/drawers over the dashboard;
  never navigate away and discard the family's place. A full-page view is
  acceptable only as an explicit v1 stepping stone with a named in-context
  iteration already on the plan (for example Spotify web player → drawer).
- **Tests co-located with code.** `widgets/clock.test.js` next to `widgets/clock.js`. No top-level `tests/` folder.
- **Conventional commits.** `feat:`, `fix:`, `chore:`, `docs:`. Trunk-based — straight to `main`.
- **Node 22 LTS** on both laptop and Pi.
- **Widgets are dumb, views compose.** Widgets render data they're given; views fetch and arrange.
- **QA harness for every applicable feature.** Any new widget — and any UX-touching change to an existing one — gets the harness trio *as part of the feature work, not after*: `<widget>.fixtures.js` (states: empty/typical/overflow + edge cases), a `WIDGETS` entry in `app/src/harness/harness.js`, and `app/tests/qa/<widget>.spec.js` (geometry + touch interactions at exact device viewports). "Applicable" = anything with states or touch interaction; pure-display one-liners can skip with a note. `scripts/ship.sh` runs the gate automatically; `/qa-harness <widget>` runs the design-improvement loop before a feature is called done. See [`docs/qa-harness.md`](./docs/qa-harness.md).
- **Touch floors are met with hit areas, never bigger visuals.** If `auditTapTargets` flags an element under 44px, extend the *tappable* area — padding on the row/button, a transparent wrapper, or make the whole row the target — never inflate the visible glyph/box, shrink fonts, or strip padding to make the geometry math pass. (That's exactly how the 2026-07-10 density regression shipped.) Key visual sizes are locked in bands by `app/tests/qa/design-contract.js`; if a band seems wrong, ask Tim — don't move it.
- **Ship requires a visual sign-off when `app/` changed.** `ship.sh` refreshes the QA screenshot artifacts and hard-stops without `VISUAL_SIGNOFF`. Agents: actually view the artifact PNGs for the widgets you touched (plus `briefing-layout`), then re-run with `VISUAL_SIGNOFF="checked <widgets>: <what you observed>" scripts/ship.sh "…"`. Name something concrete — "looks fine" doesn't count. See [`docs/qa-harness.md`](./docs/qa-harness.md) § Visual review.

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
