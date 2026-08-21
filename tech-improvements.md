# Tech improvements

Last surveyed: 2026-W34

## Open opportunities

- **High — `app/functions/_lib/auth.js:7-20`, `app/functions/api/home/lock.js:1-6`, `app/functions/api/home/lock.js:28-50`, `app/src/lib/home.js:22-24`, `app/src/lib/home.js:48-56`, `app/src/lib/home.js:81-84` — needs-Tim-promotion:** Reconcile the deadbolt's network boundary with the actual public Pages Function: the bundle-readable dashboard token is the sole unlock authorization, while Cloudflare Access protects HA behind the Function rather than `/api/home/lock` itself, so anyone who obtains the shipped token can call the public unlock endpoint remotely (medium, security-sensitive API/auth redesign).
- **High — `app/functions/api/home/lock.js:12`, `app/functions/api/home/lock.js:38-52`, `app/functions/api/home/lock.js:56-59` — needs-Tim-promotion:** Make the promised door audit trail include rejected and failed attempts; the handler logs only successful HA calls, while invalid actions and service errors return without an audit event despite the “every attempt” contract (small, one-file security-observability behavior fix plus tests).
- **High — `spec.md:5`, `spec.md:80-157`, `spec.md:212` — needs-Tim-promotion:** Re-baseline the durable source of truth around the live tablet, deployed Pi/Home Assistant backend, and Hermes integration; large sections still describe superseded hardware, hosting, smart-home, and OpenClaw states, and changing this broad product contract requires Tim to choose what remains history versus current policy (large, multi-section docs refactor).
- **High — `docs/home-assistant.md:5-8`, `docs/home-assistant.md:121-145`, `docs/home-assistant.md:183-191`, `docs/home-assistant.md:233-240` — needs-Tim-promotion:** Replace the stale PIN/lockout security contract, acceptance criteria, and deployment steps with the approved one-tap model already called out in the status note; this is security-sensitive behavior documentation and must be promoted deliberately (medium, single-file contract rewrite).
- **High — `app/functions/_lib/standup-api.js:43-50`, `app/functions/_lib/standup-api.test.js:126-137` — needs-Tim-promotion:** Align standup quality parsing with Sam's live `SAM_APPROVED` / `SAM_REJECTED` / `SAM_ESCALATE` contract; the parser and fixture recognize only invented PASS/FAIL forms, so completed work can show “QA pending” despite an observed Sam verdict (small, two-file behavior-and-test correction).
- **Medium — `todo.md:55`, `todo.md:124-125`, `todo.md:152-155` — safe-cleanup (filed PRO-93):** Reconcile unchecked weather, Home Assistant, and relay/voice tasks that the current-state docs and resolved log say are live; this restores checklist accuracy with no behavior change (small, one-file docs cleanup).
- **Medium — `app/src/widgets/aimessage.js:1`, `app/src/widgets/photo.js:1`, `app/src/widgets/chores.js:1`, `app/src/widgets/traffic.js:1`, `app/src/widgets/onthisday.js:1` — needs-Tim-promotion:** Decide whether to retire legacy widgets that have no production import and are retained only with mocks/tests; deletion would span several modules and may remove deliberately parked surfaces, so Tim must promote the scope (medium, multi-file dead-code removal).
- **Medium — `app/tests/qa/devices.js:9-17`, `app/tests/qa/devices.js:29-38` — needs-Tim-promotion:** Activate the real Meswao tablet QA profile from `?probe=1` measurements so the suite exercises Fully Kiosk's actual viewport, DPR, and production scale rather than only the design canvas; this changes QA output and requires a real-device measurement plus explicit scale-adjusted contract decisions (small, one-file config change after Tim supplies the probe values).
- **Low — `README.md:51` — safe-cleanup (covered by PRO-92):** Remove the remaining claim that Home Assistant deployment is “eventual”; the public overview above is now current, but this preserved-runbook note still contradicts the live Pi backend (small, one-file docs cleanup).
- **Low — `docs/pi-home-server.md:81-83` — safe-cleanup (filed PRO-138):** Correct the build-order row that still says HA credentials, the removed unlock PIN, entity config, and `VITE_HOME_LIVE` are pending despite the live status recorded elsewhere; this is stale explanatory text only (small, one-file docs cleanup).
- **Low — `app/src/views/morning-briefing.js:12-15`, `app/src/views/morning-briefing.js:231-235` — safe-cleanup (filed PRO-140):** Remove the commented-out calendar-overlay import/call and replace the restore narrative with the existing history reference; the overlay remains available through its real harness/tests, so this is a no-behavior-change local cleanup (small, one-file cleanup).

## Auto-filed → Linear

- **PRO-92** — `[Dashboard] Repository overview reflects the live wall system` (`README.md:5-6`, `README.md:23`, residual at `README.md:51`).
- **PRO-93** — `[Dashboard] Delivery checklist reflects completed live integrations` (`todo.md:55`, `todo.md:124-125`, `todo.md:152-155`).
- **PRO-138** — `[Dashboard] Pi server runbook reflects the live Home controls` (`docs/pi-home-server.md:81-83`).
- **PRO-140** — `[Dashboard] Calendar view source has no retired restore comments` (`app/src/views/morning-briefing.js:12-15`, `app/src/views/morning-briefing.js:231-235`).

## Done / dropped

- **2026-W32 — done:** The original PRO-92 overview drift at `README.md:5-6` and `README.md:23` is resolved on main; the one-line residual at `README.md:51` remains open above under the same issue.
- **2026-W34 — deduped:** No new safe-cleanup issue was filed; every current safe finding is already covered by an open tech-debt issue above.
