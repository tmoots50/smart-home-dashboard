# Tech improvements

Last surveyed: 2026-W39

## Open opportunities

- **High — `spec.md:5`, `spec.md:80-157`, `spec.md:212` — needs-Tim-promotion:** Re-baseline the durable source-of-truth around the live tablet, deployed Pi/Home Assistant backend, and Hermes integration; large sections still describe superseded hardware, hosting, smart-home, and OpenClaw states, and changing this broad product contract requires Tim to choose what remains history versus current policy (large, multi-section docs refactor).
- **High — `docs/home-assistant.md:185-189`, `docs/home-assistant.md:235-239` — needs-Tim-promotion:** Replace the stale PIN/lockout acceptance and deployment steps with the approved one-tap lock security model already called out in the status note; this is security-sensitive behavior documentation and must be promoted deliberately (medium, single-file contract rewrite).
- **Medium — `todo.md:55`, `todo.md:124-125`, `todo.md:152-154` — safe-cleanup (filed PRO-93):** Reconcile unchecked weather, Home Assistant, and relay/voice tasks that the current-state docs and resolved log say are live; this restores checklist accuracy with no behavior change (small, one-file docs cleanup).
- **Medium — `app/src/widgets/aimessage.js:1`, `app/src/widgets/photo.js:1`, `app/src/widgets/chores.js:1`, `app/src/widgets/traffic.js:1`, `app/src/widgets/onthisday.js:1` — needs-Tim-promotion:** Decide whether to retire legacy widgets that have no production import and are retained only with mocks/tests; deletion would span several modules and may remove deliberately parked surfaces, so Tim must promote the scope (medium, multi-file dead-code removal).
- **Low — `docs/pi-home-server.md:81-83` — safe-cleanup (covered by existing PRO-114):** Correct the build-order row that still says HA credentials, the removed unlock PIN, entity config, and `VITE_HOME_LIVE` are pending despite the live status recorded elsewhere; this is stale explanatory text only (small, one-file docs cleanup).
- **Low — `app/src/views/morning-briefing.js:12-15`, `app/src/views/morning-briefing.js:230-235` — safe-cleanup (filed PRO-164):** Remove the commented-out calendar-overlay import/call and replace the restore narrative with the existing history reference; the overlay remains available through its real harness import, so this is a no-behavior-change local cleanup (small, one-file cleanup).
- **Low — `app/src/widgets/spotify-drawer.js:3` — safe-cleanup (filed PRO-163):** Remove the unused `showToast` import; static inspection found no reference elsewhere in the file, so this is a one-line no-behavior-change cleanup (small, one-file cleanup).

## Auto-filed → Linear

- **PRO-92** — `[Dashboard] Repository overview reflects the live wall system` (`README.md:5-6`, `README.md:23`).
- **PRO-93** — `[Dashboard] Delivery checklist reflects completed live integrations` (`todo.md:55`, `todo.md:124-125`, `todo.md:152-154`).
- **PRO-163** — `[Dashboard] Spotify drawer has no unused toast dependency` (`app/src/widgets/spotify-drawer.js:3`).
- **PRO-164** — `[Dashboard] Calendar switch-over code has no commented-out call paths` (`app/src/views/morning-briefing.js:12-15`, `app/src/views/morning-briefing.js:230-235`).

## Done / dropped

- **2026-W39 — `README.md:5-6`, `README.md:23` (PRO-92):** Done on main; the overview now describes the live wall dashboard, Cloudflare Pages, Pi-hosted Home Assistant, and Google-backed data paths.
