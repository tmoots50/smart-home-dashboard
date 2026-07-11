#!/usr/bin/env bash
# One-command commit + push → triggers CF Pages redeploy.
#
# Usage:
#   scripts/ship.sh                     # auto-message (timestamped wip)
#   scripts/ship.sh "feat: pagination"  # explicit message
#
# Stages everything; .gitignore handles secrets (.envrc.local, .env*, etc.).
# Pushes to the current branch's upstream. Exits cleanly if nothing to commit.
#
# When app/ changed, two gates run before anything is committed:
#   1. QA gate — deterministic geometry/touch/contract/clipping checks.
#   2. Visual sign-off — the gate proves geometry; it CANNOT prove the
#      dashboard looks right (that gap shipped the 2026-07 density
#      regression). A human or agent must LOOK at the refreshed artifacts
#      and describe what they checked. Agents: Read the PNGs under
#      app/tests/qa/artifacts/<profile>/ for every widget you touched plus
#      briefing-layout, then re-run with
#        VISUAL_SIGNOFF="checked todos+briefing: spacing, checkbox size, no clipping" scripts/ship.sh "…"
#      The sign-off is recorded as a Visual-Signoff commit trailer.

set -euo pipefail

MSG="${1:-wip: dashboard iteration $(date +%Y-%m-%d\ %H:%M)}"

# ── QA gate ─────────────────────────────────────────────────────────────
# Deterministic UX checks (geometry, touch targets, design-contract bands,
# text clipping, interactions, console errors) at exact device viewports —
# see docs/qa-harness.md. Runs only when something under app/ changed
# (tracked or untracked). SKIP_QA=1 is the emergency escape hatch; if you
# find yourself using it twice in a row, the gate is broken — fix the gate,
# don't keep skipping it.
REPO_ROOT="$(git rev-parse --show-toplevel)"
NEED_SIGNOFF=0
if [ "${SKIP_QA:-0}" != "1" ]; then
  if ! git diff --quiet HEAD -- app/ 2>/dev/null \
     || [ -n "$(git status --porcelain -- app/ 2>/dev/null)" ]; then
    echo "▶ QA gate (app/ changed) — geometry/contract/clipping checks + artifact refresh…"
    if ! (cd "$REPO_ROOT/app" && npm run qa:ship); then
      echo ""
      echo "✗ QA gate failed — nothing was committed or pushed."
      echo "  Reproduce:  cd app && npm run qa"
      echo "  Override:   SKIP_QA=1 scripts/ship.sh \"…\"   (emergencies only)"
      exit 1
    fi
    echo "✓ QA gate passed."
    (cd "$REPO_ROOT/app" && npm run qa:visual)
    NEED_SIGNOFF=1
  fi
fi

# ── Visual sign-off ─────────────────────────────────────────────────────
# The gate proves geometry; it cannot prove the dashboard looks right.
if [ "$NEED_SIGNOFF" = "1" ] && [ -z "${VISUAL_SIGNOFF:-}" ]; then
  if [ -t 0 ]; then
    SHEET="$REPO_ROOT/app/tests/qa/artifacts/contact-sheet.html"
    command -v open >/dev/null && open "$SHEET"
    read -r -p "One-line visual sign-off (what you checked): " VISUAL_SIGNOFF
  fi
  if [ -z "${VISUAL_SIGNOFF:-}" ]; then
    echo "✗ Visual sign-off required — nothing was committed or pushed."
    echo "  Review the refreshed artifacts (contact sheet above, or the PNGs"
    echo "  under app/tests/qa/artifacts/<profile>/) for every widget you"
    echo "  touched plus briefing-layout, then re-run:"
    echo "    VISUAL_SIGNOFF=\"checked <widgets>: <what you observed>\" scripts/ship.sh \"…\""
    exit 1
  fi
fi

git add -A

if git diff --cached --quiet; then
  echo "Nothing to commit."
  exit 0
fi

if [ -n "${VISUAL_SIGNOFF:-}" ]; then
  git commit -m "$MSG" -m "Visual-Signoff: $VISUAL_SIGNOFF"
else
  git commit -m "$MSG"
fi
git push

echo ""
echo "✓ Pushed. CF Pages redeploy in ~1-2 min."
echo "  https://smart-home-dashboard-de0.pages.dev/"
