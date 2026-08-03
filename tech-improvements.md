# Tech improvements

Last surveyed: 2026-W32

## Open opportunities

- **High — `spec.md:5`, `spec.md:80-157`, `spec.md:212` — needs-Tim-promotion:** Re-baseline the durable source-of-truth around the live tablet, deployed Pi/Home Assistant backend, and Hermes integration; large sections still describe superseded hardware, hosting, smart-home, and OpenClaw states, and changing this broad product contract requires Tim to choose what remains history versus current policy (large, multi-section docs refactor).
- **High — `docs/home-assistant.md:185-189`, `docs/home-assistant.md:235-239` — needs-Tim-promotion:** Replace the stale PIN/lockout acceptance and deployment steps with the approved one-tap lock security model already called out in the status note; this is security-sensitive behavior documentation and must be promoted deliberately (medium, single-file contract rewrite).
- **High — `app/tests/qa/devices.js:9-17`, `app/tests/qa/devices.js:29-38` — needs-Tim-promotion:** Activate a measured Meswao/Fully Kiosk profile so the geometry gate exercises the production CSS viewport instead of only the 1080×1920 design canvas; this needs Tim to capture `?probe=1` values and approve scale-adjusted visual bands before the small QA-config change.
- **Medium — `README.md:5-6`, `README.md:23` — safe-cleanup (filed PRO-92):** Update the public overview from “in development” and “future Pi/Apple Notes shim” to the live wall dashboard, deployed Home Assistant server, and Google-backed data paths; this removes misleading onboarding text without runtime change (small, one-file docs cleanup).
- **Medium — `todo.md:55`, `todo.md:124-125`, `todo.md:152-154` — safe-cleanup (filed PRO-93):** Reconcile unchecked weather, Home Assistant, and relay/voice tasks that the current-state docs and resolved log say are live; this restores checklist accuracy with no behavior change (small, one-file docs cleanup).
- **Medium — `app/src/widgets/aimessage.js:1`, `app/src/widgets/photo.js:1`, `app/src/widgets/chores.js:1`, `app/src/widgets/traffic.js:1`, `app/src/widgets/onthisday.js:1` — needs-Tim-promotion:** Decide whether to retire legacy widgets that have no production import and are retained only with mocks/tests; deletion would span several modules and may remove deliberately parked surfaces, so Tim must promote the scope (medium, multi-file dead-code removal).
- **Low — `docs/pi-home-server.md:81-83` — safe-cleanup (filed PRO-114):** Correct the build-order row that still says HA credentials, the removed unlock PIN, entity config, and `VITE_HOME_LIVE` are pending despite the live status recorded elsewhere; this is stale explanatory text only (small, one-file docs cleanup).
- **Low — `app/src/views/morning-briefing.js:12-15`, `app/src/views/morning-briefing.js:234-237` — safe-cleanup:** Remove the commented-out calendar-overlay import/call and replace the restore narrative with the existing history reference; the overlay remains available through its real harness import, so this is a no-behavior-change local cleanup (small, one-file cleanup; not filed because the three-issue 2026-W32 run cap was reached).

## Auto-filed → Linear

- **PRO-92** — `[Dashboard] Repository overview reflects the live wall system` (`README.md:5-6`, `README.md:23`).
- **PRO-93** — `[Dashboard] Delivery checklist reflects completed live integrations` (`todo.md:55`, `todo.md:124-125`, `todo.md:152-154`).
- **PRO-114** — `[Dashboard] Home server build order reflects the live deployment` (`docs/pi-home-server.md:81-83`).

## Done / dropped

- None this survey.
