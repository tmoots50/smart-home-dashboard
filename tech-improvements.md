# Tech improvements

Last surveyed: 2026-W42

## Open opportunities

- **High — `spec.md:5`, `spec.md:80-157`, `spec.md:212-230` — needs-Tim-promotion:** Re-baseline the durable source of truth around the live tablet, deployed Pi/Home Assistant backend, and Hermes integration; large sections still describe superseded hardware, hosting, smart-home, and OpenClaw states, and Tim must choose what remains history versus current policy (large, multi-section docs refactor).
- **High — `docs/home-assistant.md:183-195`, `docs/home-assistant.md:233-245` — needs-Tim-promotion:** Replace stale PIN/lockout acceptance and deployment steps with the approved one-tap lock security model already recorded in `CLAUDE.md:8-13` and `followups.md:31`; this is security-sensitive behavior documentation and must be promoted deliberately (medium, single-file contract rewrite).
- **Medium — `app/src/widgets/aimessage.js:1`, `app/src/widgets/photo.js:1`, `app/src/widgets/chores.js:1`, `app/src/widgets/traffic.js:1`, `app/src/widgets/onthisday.js:1`, `app/src/widgets/groceries.js:1` — needs-Tim-promotion:** Decide whether to retire legacy widgets with no production import and retained mocks/tests; Groceries joined that set when the live standup matrix replaced it, and deletion would span modules and may remove deliberately parked surfaces (medium, multi-file dead-code removal).
- **Medium — `todo.md:55`, `todo.md:124-125`, `todo.md:151-155` — safe-cleanup (filed PRO-93):** Reconcile unchecked weather, Home Assistant, and relay/voice tasks that current-state docs and the resolved log say are live; this restores checklist accuracy with no behavior change (small, one-file docs cleanup).
- **Low — `README.md:51` — safe-cleanup (covered by PRO-92):** Replace the remaining “eventual Home Assistant deployment” sentence with wording that treats `docs/install.md` as historical Pi-display reference; the public overview otherwise states HA is already live, and the open repository-overview issue covers the same outcome (small, one-file docs cleanup).
- **Low — `docs/pi-home-server.md:74-84` — safe-cleanup (filed PRO-167):** Correct the build-order row that still says HA credentials, the removed unlock PIN, entity config, and `VITE_HOME_LIVE` are pending despite the live status recorded elsewhere; this is stale explanatory text only (small, one-file docs cleanup).
- **Low — `app/src/views/morning-briefing.js:12-15`, `app/src/views/morning-briefing.js:229-235` — safe-cleanup (filed PRO-169):** Remove the commented-out calendar-overlay import/call and replace the restore narrative with the existing history reference; the overlay remains exercised through its harness import, so this is a no-behavior-change local cleanup (small, one-file cleanup).

## Auto-filed → Linear

- **PRO-92** — `[Dashboard] Repository overview reflects the live wall system` (`README.md:5-6`, `README.md:23`).
- **PRO-93** — `[Dashboard] Delivery checklist reflects completed live integrations` (`todo.md:55`, `todo.md:124-125`, `todo.md:152-154`).
- **PRO-167** — `[Dashboard] Home-server runbook reflects live controls` (`docs/pi-home-server.md:74-84`).
- **PRO-169** — `[Dashboard] Briefing source reflects the active calendar view` (`app/src/views/morning-briefing.js:12-15`, `app/src/views/morning-briefing.js:229-235`).

## Done / dropped

- **Narrowed — PRO-92 / `README.md:5-6`, `README.md:23`:** the live wall status, deployed Home Assistant backend, and Google-backed data paths were merged to `main` in `afd560f`; only the residual stale install sentence at `README.md:51` remains under the still-open issue.
