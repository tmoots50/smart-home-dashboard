# PRO-127 design decision — Scrum Standup

Date: 2026-08-09  
Decision owner: Mo  
Status: chosen for Derek to build

## Constraint

The module replaces Groceries inside the right-hand `.briefing__stack`; it does not earn a new full-width row. The wall still needs one-glance team status, readable state semantics, and honest attribution inside the existing card system (`docs/design-system.md` §2.2, §5, §6.1, §7.1, §8, §11.2).

## Iterations

### A — Agent matrix (chosen)

Playable file: `_context/mockups/2026-08-09-scrum-standup/direction-a-agent-matrix.html` on branch `design/pro-127-agent-matrix`.

Five stable agent rows cross three stable status columns. Completed quality is attached to the Yesterday item; ambiguous ownership says `≈ grouped` rather than impersonating certainty. Tapping a cell reveals its Linear detail in context.

Optimizes: half-second comparison, blocker visibility, no waiting for motion.  
Trade-off: denser than a normal list, so implementation must cap each cell at one primary item plus `+N` and preserve the explicit clamp.

### B — Agent spotlight

Playable file: `_context/mockups/2026-08-09-scrum-standup/direction-b-agent-spotlight.html` on branch `design/pro-127-agent-spotlight`.

Five agent tabs select a larger three-row detail pane; an optional timer rotates agents.

Optimizes: larger type and a card height close to the current Groceries module.  
Trade-off: four agents are always hidden, blocker discovery depends on dots, and rotation makes the wall state time-dependent.

## Decision

Build A, the agent matrix.

The dashboard is a glance-first wall appliance, not a carousel. Tim's prior reactions consistently reward stable information placement and removing secondary detail from the primary scan: the stacked calendar stayed the default after the “smushed” wall review, Coming Up lost location detail, and the Morning Brief's full-width letter hierarchy beat denser side-by-side copy (`_audits/2026-07-11-design-feedback.md:12-22,83-94`; `docs/morning-brief.md:135-142`). A exposes all five agents and every blocker at once; B looks calmer in isolation but fails the actual standup question unless Tim waits or taps.

Guardrails for Derek: preserve existing card/type/color roles; show one primary issue per cell with `+N` overflow; use a 44px-or-larger whole-cell target; keep quality adjacent to Yesterday only; render `No blockers` explicitly; render ambiguous attribution as `Grouped by <basis>`; and keep Home immediately below the card without changing the surrounding duo.
