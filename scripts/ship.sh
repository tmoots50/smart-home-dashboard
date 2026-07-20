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

# ── Post-push: wait for the CF deploy, then smoke the live site ─────────
# A green push is not a green deploy (2026-07-20: a deploy died at the
# initialize stage, the prior build had a wiped env baked in, and the wall
# sat on mock fallback overnight). Poll the CF API for THIS commit's
# deployment, then probe the live Google-backed endpoints.
COMMIT_SHA="$(git rev-parse HEAD)"
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] && [ -f "$REPO_ROOT/.envrc.local" ]; then
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.envrc.local"
fi
if [ -n "${CLOUDFLARE_API_TOKEN:-}" ] && [ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ] && [ -n "${CLOUDFLARE_PAGES_PROJECT:-}" ]; then
  echo "▶ Waiting for CF Pages deploy of ${COMMIT_SHA:0:7}…"
  DEPLOY_STATE=""
  for _ in $(seq 1 36); do # ~6 min at 10s
    DEPLOY_STATE="$(curl -s -m 15 \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$CLOUDFLARE_PAGES_PROJECT/deployments?per_page=15" \
      | COMMIT_SHA="$COMMIT_SHA" python3 -c '
import json, os, sys
sha = os.environ["COMMIT_SHA"]
try:
    deploys = json.load(sys.stdin)["result"]
except Exception:
    print("pending"); sys.exit()
for d in deploys:
    meta = d.get("deployment_trigger", {}).get("metadata", {})
    if meta.get("commit_hash") == sha and d.get("environment") == "production":
        stage = d.get("latest_stage", {})
        if stage.get("status") == "failure":
            print(f"failure:{stage.get('name')}")
        elif stage.get("name") == "deploy" and stage.get("status") == "success":
            print("success")
        else:
            print("pending")
        sys.exit()
print("pending")
')"
    [ "$DEPLOY_STATE" != "pending" ] && break
    sleep 10
  done
  case "$DEPLOY_STATE" in
    success) echo "✓ Deploy live." ;;
    failure:*)
      echo "✗ CF Pages deploy FAILED at stage '${DEPLOY_STATE#failure:}' — the previous build is still serving."
      echo "  Retry: push again, or use the CF API deployments retry endpoint."
      exit 1 ;;
    *)
      echo "⚠ Deploy not confirmed after ~6 min — smoking whatever is live." ;;
  esac
else
  echo "⚠ CF API creds unavailable — sleeping 150s for the build, then smoking."
  sleep 150
fi
"$REPO_ROOT/scripts/smoke-live.sh"
