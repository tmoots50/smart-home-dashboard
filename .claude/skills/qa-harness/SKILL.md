---
name: qa-harness
description: Runs the dashboard's UX QA harness on a widget — renders every fixture state at exact device viewports, measures geometry and touch interactions, critiques each state as a design principal, then implements the highest-leverage improvements on a branch and shows Tim before/after screenshots for approval. Use when a feature is ready for UX refinement, when building a new widget, or when Tim says "run the harness on X".
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
---

# QA Harness — measure, critique, improve, re-verify

## What this is

The generative half of the dashboard's QA system (see `docs/qa-harness.md` for
the architecture). The deterministic half — the `qa:gate` in `ship.sh` — blocks
regressions automatically. THIS skill is the human-in-the-loop half: it takes a
designer's eye to every state of a widget and **implements** improvements, so
the shipped feature ends up better than the original plan.

**The autonomy contract (Tim's explicit decision):** implement improvements on
a branch, show before/after, and STOP. Tim approves before anything merges or
ships. Never merge, never run `ship.sh`, never push from this skill.

## Inputs

`/qa-harness <widget>` — e.g. `calendar-overlay`, `calendar`, `home`.
No argument → ask which widget, listing those with `*.fixtures.js`.

## Workflow

### 1. Ensure the widget is harnessed

A harnessed widget has, co-located in `app/src/widgets/`:
- `<widget>.fixtures.js` — exports `states` (empty / single / typical /
  overflow + widget-specific edge states). Browser-safe: no Playwright
  imports, no `import.meta.env`; dates relative to `new Date()` at module
  load (specs freeze page time to `tests/qa/clock.js` FIXED_NOW).
- an entry in `app/src/harness/harness.js` `WIDGETS` (mount must mirror how
  `views/morning-briefing.js` wires the widget — same wrappers, same
  delegation).
- `app/tests/qa/<widget>.spec.js` — geometry per state (use
  `detectOverflow`, `auditTapTargets`, `captureArtifact` from
  `tests/qa/measure.js`; call `freezeMotion` right after goto) plus its touch
  interactions as plain Playwright code.

If any piece is missing, build it first, modeled on the calendar pair
(`calendar.fixtures.js` / `calendar.spec.js` and
`calendar-overlay.fixtures.js` / `calendar-overlay.spec.js`).

### 2. Measure

```bash
cd app && npm run qa
```

All specs must pass before critiquing — a broken baseline poisons the
comparison. Collect the `[measure]` lines (rows-fit numbers per profile) and
the artifacts under `app/tests/qa/artifacts/<profile>/`.

### 3. Critique — as the design principal

Read every artifact screenshot (each state × each profile). Adopt the persona
and rubric of the sibling skill: read
`.claude/skills/ui-audit-dashboard/RUBRIC.md` and audit each STATE against it,
with extra weight on:

- **Touch & interaction** (axis 5) — target sizes, gesture affordances, what a
  wet-thumbed person at the bathroom mirror can actually hit.
- **Information design** (axis 6) — is the grouping the most legible one?
  (e.g. a 7-day agenda grouped by day vs by person); does the empty state
  waste the surface or earn it?
- **State coverage** — empty/overflow/error states are DESIGN surfaces, not
  fallbacks. An empty overlay showing one line of text in a full-screen panel
  is a finding.

Use the fit measurements to ground recommendations in numbers: "the canvas
fold fits N rows, so the empty state should show up to N upcoming events" —
never a hardcoded guess. Per-profile numbers differ; the implemented value
must derive from measurement (compute at runtime or per-profile constant with
the measurement cited in a comment).

### 4. Improve — on a branch

Pick the 1–3 highest-leverage improvements. Then:

```bash
git checkout -b qa/<widget>-YYYY-MM-DD
```

Implement completely (render + CSS + unit tests updated — this repo co-locates
`*.test.js`; keep `npm test` green). Update fixtures/specs if the improvement
changes the state space.

### 5. Re-verify

```bash
cd app && npm run qa && npx vitest run
```

Both green. Capture the AFTER artifacts (they overwrite in place — copy the
BEFORE set aside first: `cp -r tests/qa/artifacts tests/qa/artifacts-before`).

### 6. Present before/after — then stop

Show Tim, per improvement: the before and after screenshots (absolute paths so
they render in chat), 2–4 sentences of rationale citing the rubric principle
and the measurement, and any tradeoff. Then WAIT. On approval: merge to main,
delete the branch, clean up `artifacts-before/`, and append a short record to
`_audits/YYYY-MM-DD-qa-harness-<widget>.md` (what was found, what shipped,
the numbers). On rejection: keep or discard the branch as Tim prefers.

## Rules

- **No pixel-diff assertions, ever.** Screenshots are for eyes, geometry is
  for asserts. This keeps the gate deterministic (see docs/qa-harness.md).
- **Freeze motion before measuring** — `freezeMotion(page)` right after goto.
  Entrance animations scale getBoundingClientRect mid-flight.
- **Faithful mounts.** If the harness mounts a widget differently from the
  briefing view, its measurements are fiction. Check morning-briefing.js.
- **Don't manufacture findings.** If a state is clean at both profiles, say
  so and move on. Improvements must clear the "wife would notice or a thumb
  would miss" bar, not pad a report.
