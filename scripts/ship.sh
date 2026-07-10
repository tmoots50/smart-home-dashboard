#!/usr/bin/env bash
# One-command commit + push → triggers CF Pages redeploy.
#
# Usage:
#   scripts/ship.sh                     # auto-message (timestamped wip)
#   scripts/ship.sh "feat: pagination"  # explicit message
#
# Stages everything; .gitignore handles secrets (.envrc.local, .env*, etc.).
# Pushes to the current branch's upstream. Exits cleanly if nothing to commit.

set -euo pipefail

MSG="${1:-wip: dashboard iteration $(date +%Y-%m-%d\ %H:%M)}"

# ── QA gate ─────────────────────────────────────────────────────────────
# Deterministic UX checks (geometry, touch targets, interactions, console
# errors) at exact device viewports — see docs/qa-harness.md. Runs only when
# something under app/ changed (tracked or untracked). SKIP_QA=1 is the
# emergency escape hatch; if you find yourself using it twice in a row, the
# gate is broken — fix the gate, don't keep skipping it.
REPO_ROOT="$(git rev-parse --show-toplevel)"
if [ "${SKIP_QA:-0}" != "1" ]; then
  if ! git diff --quiet HEAD -- app/ 2>/dev/null \
     || [ -n "$(git status --porcelain -- app/ 2>/dev/null)" ]; then
    echo "▶ QA gate (app/ changed) — geometry/touch/interaction checks…"
    if ! (cd "$REPO_ROOT/app" && npm run qa:gate); then
      echo ""
      echo "✗ QA gate failed — nothing was committed or pushed."
      echo "  Reproduce:  cd app && npm run qa"
      echo "  Override:   SKIP_QA=1 scripts/ship.sh \"…\"   (emergencies only)"
      exit 1
    fi
    echo "✓ QA gate passed."
  fi
fi

git add -A

if git diff --cached --quiet; then
  echo "Nothing to commit."
  exit 0
fi

git commit -m "$MSG"
git push

echo ""
echo "✓ Pushed. CF Pages redeploy in ~1-2 min."
echo "  https://smart-home-dashboard-de0.pages.dev/"
