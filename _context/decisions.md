# Decision log

The full decision history of how we got here is in [`spec.md`](../spec.md). This log is for **new** decisions made after the spec was locked in. Append-only — preserve the *why*, not just the what.

## Format
```
## YYYY-MM-DD — Short title
**Decision:** what we decided.
**Why:** the reasoning. What alternatives were considered. What constraint forced the call.
**Reversibility:** cheap / moderate / expensive.
```

---

## 2026-04-29 — Mock data before real APIs for every widget
**Decision:** every widget gets a mock-data adapter in `app/src/lib/` before any real API is wired.
**Why:** keeps the visual design loop fast; lets aesthetics iterate without blocking on auth flows; turns "wire the real source" into a small, isolated swap rather than a coupled refactor.
**Reversibility:** cheap.

## 2026-04-29 — Repo split: spec.md vs CLAUDE.md
**Decision:** `spec.md` holds the durable contract (what we're building, why, acceptance criteria, decision history). `CLAUDE.md` is a short doc telling AI assistants how to work in this codebase.
**Why:** the original combined doc was ~217 lines and too dense to skim. Splitting durable contract from collaboration instructions lets each evolve at its own pace.
**Reversibility:** cheap.

## 2026-04-29 — Tests co-located, no top-level tests/
**Decision:** `widgets/clock.test.js` lives next to `widgets/clock.js`. No top-level `tests/` folder.
**Why:** widgets are small and self-contained; co-location keeps tests visible during edits and matches Vite's expectations.
**Reversibility:** cheap.

## 2026-05-05 — Device pivot: Meswao Android tablet replaces Pi + cocopar
**Decision:** v1 production hardware is a Meswao Android tablet running Fully Kiosk Browser, not the Pi 5 + cocopar 15.6" combo. The Pi stays in the project but as a future back-end host (Home Assistant + small HTTP shims), not as the dashboard's display compute. The cocopar is shelved or repurposed.
**Why:** the Pi+cocopar build worked, but the tablet form factor is dramatically simpler — battery-free always-on power via USB-C, single device, no separate compute box behind the screen, no Chromium-on-Linux quirks (Wayland rotation, touch calibration, autostart unit tuning). The earlier "no tablets" rule in spec.md was about **always-on consumer tablets with sealed Li-ion batteries** swelling over time. The Meswao is being run with the battery management Fully Kiosk Browser exposes, and the family is willing to accept the tradeoff for the build-time savings. If the Meswao's battery degrades within the device's expected lifespan, the Pi+cocopar plan is still on the shelf, fully tested and ready to come back.
**Reversibility:** moderate. Code changes are minimal (Cloudflare Pages URL replaces `localhost:4173`, manifest + scale param + auto-fullscreen are tablet-friendly but harmless on the Pi). Hardware is fully reversible — Pi work survives unchanged.

## 2026-05-05 — Hosting: Cloudflare Pages, auto-deploy from main
**Decision:** the dashboard's static build deploys to Cloudflare Pages on every push to `main`. Custom domain TBD. Setup: see [`docs/deploy.md`](../docs/deploy.md).
**Why:** with the Pi no longer the host, the dashboard needs a public-internet origin the tablet can fetch. CF Pages is free, fast, has zero-config Vite support, and adds optional edge functions if a backend proxy is ever needed (e.g. for OAuth flows). GitHub Pages was the alternative — equally free but no edge-functions story, and CF's portfolio-narrative is stronger ("I deploy to a CDN, not GitHub raw").
**Reversibility:** cheap. Static build outputs to `app/dist`; any static host works.

## 2026-05-05 — Real data wiring starts with weather (Open-Meteo)
**Decision:** the first real-API wire is Open-Meteo for weather. Calendar stays on mock for now (Tim wants to evolve UI before committing to embed-vs-API). Apple Notes-backed todos are deferred to a separate session — they require an HTTP shim on the Old Mac wrapping the existing `mfb-inote-show` / `-append` / `-strike` AppleScript helpers, accessible to the tablet over Tailscale.
**Why:** Open-Meteo is zero-auth, free, and demonstrates the "render mock instantly, swap to live when fetch resolves, cache 15min, fail-soft" pattern that every other live source will follow. Doing it first anchors the pattern in real code, not a doc.
**Reversibility:** cheap. `lib/weather.js` and `lib/weather-mock.js` both return the same shape; flipping the import line reverts.

## 2026-05-06 — iNote HTTP bridge in this repo, not openclaw-setup _(superseded same-day)_
**Decision:** the Old Mac HTTP bridge that exposes Apple Notes (`TODOs`, `Groceries`) to the dashboard lives in `bridges/inote/` of this repo, not in `openclaw-setup/`. Reads via its own AppleScript (needs HTML body for strikethrough detection); writes shell out to the existing `mfb-inote-{append,strike}` helpers so the allowlist + single-match safety stays centralized. Bearer-token auth, CORS allowlist, launchd plist, `--mock` for laptop dev. Token is exposed in the client bundle — Tailscale ACL is the real perimeter.
**Why:** the bridge has one consumer (this dashboard) and is tightly coupled to its API contract. Keeping it in the consumer's repo means the dashboard PR that changes the contract changes the bridge in the same diff. If a second consumer ever shows up, refactor to a shared location then. Ship-here-now beats imagined-future-cleanliness.
**Reversibility:** cheap. The bridge is ~200 lines of Node with no extra deps. Move-to-openclaw-setup is `git mv`.
**Superseded by 2026-05-06 below.**

## 2026-05-06 — Drop iNote/Old-Mac dependency, switch to Google Tasks + Google Photos via CF Pages Functions
**Decision:** the dashboard moves off the Apple ecosystem for shared lists and photos. Caroline migrates from Apple Notes to Google Tasks (separate Todos and Groceries lists). Family photos move from iCloud Shared Album to a Google Photos shared album. Both surfaces are reached via Cloudflare Pages Functions that hold a single Google OAuth refresh token and proxy the Google Tasks / Photos APIs. The dashboard talks only to its own `/api/*` Functions with a shared bearer token; Google credentials never leave the server side.
**Why:** Tim ruled out depending on the Old Mac for ANY new feature. Apple Notes / Apple Photos are inaccessible from Android, Linux, or CF Workers — Apple doesn't publish public APIs. Maintaining a Mac just to bridge to Apple was the only path to keep the existing apps; the cost (Old Mac power + maintenance + single point of failure) outweighed Caroline's switching cost to Google Tasks. Google's APIs are first-class, OAuth scopes are clean, and CF Pages Functions are co-located with the dashboard hosting (one platform, one deploy).
**Reversibility:** moderate. Code is cheap to revert (one library swap each). Caroline's app/workflow change is the bigger lift to undo. The iNote bridge code was preserved — moved to `openclaw-setup/bridges/inote/` — so the Apple Notes path can be picked up by any consumer that wants it later (including this dashboard if we change our minds).

## 2026-05-06 — iNote bridge moved to openclaw-setup
**Decision:** the bridge code (formerly `smart-home-dashboard/bridges/inote/`) now lives in `openclaw-setup/bridges/inote/`. The bridge's API surface is intentionally generic — any consumer of the openclaw `mfb-inote-*` helpers can use it (other agents, Telegram channels, Shortcuts).
**Why:** with the dashboard no longer using it, this repo doesn't need to carry the code. openclaw-setup owns the helpers; the bridge is the natural HTTP-shaped accessor of those helpers.
**Reversibility:** cheap. `cp -r` either direction.

## 2026-05-06 — Daily message via static messages.json + CF Pages auto-deploy
**Decision:** the AI-message widget pulls from `app/public/messages.json` keyed by today's date. Publishing = edit + commit + push; CF Pages auto-deploys. No backend.
**Why:** there's no AI inference loop yet (the spec's "AI-curated, personalized views" is post-v1). For v1, "I want to push a note to the wall today" is best served by the simplest possible publish step. JSON-in-public is one CDN-cached fetch, zero infra. When real Claude curation arrives, swap `lib/aimessage.js` for an API client; the widget contract stays the same.
**Reversibility:** cheap. The JSON file is 5 lines per message and the lib is 50 lines.
