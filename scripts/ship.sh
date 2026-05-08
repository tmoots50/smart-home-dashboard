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
