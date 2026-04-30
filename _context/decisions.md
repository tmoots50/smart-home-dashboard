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
