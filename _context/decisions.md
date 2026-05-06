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
