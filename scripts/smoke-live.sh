#!/usr/bin/env bash
# Probe the LIVE dashboard's Google-backed endpoints and fail loudly if any
# is broken. Cheap insurance against the failure mode that bit us twice on
# 2026-07-19/20: a CF Pages env-var change wipes a secret, the next deploy
# bakes the broken env in, and the wall silently falls back to mock data —
# which reads as "the dashboard reverted to an old build".
#
# Usage:
#   scripts/smoke-live.sh                 # probes production
#   SMOKE_ORIGIN=https://<preview-url> scripts/smoke-live.sh
#
# Auth: uses HERMES_TOKEN (sourced from .envrc.local if not already in env).
# Run after ANY env-var change or deploy. ship.sh runs this automatically
# after the CF build completes.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ORIGIN="${SMOKE_ORIGIN:-https://smart-home-dashboard-de0.pages.dev}"

if [ -z "${HERMES_TOKEN:-}" ] && [ -f "$REPO_ROOT/.envrc.local" ]; then
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.envrc.local"
fi
if [ -z "${HERMES_TOKEN:-}" ]; then
  echo "✗ HERMES_TOKEN not set and .envrc.local not found — cannot authenticate."
  exit 1
fi

# path → human label. All four share the server-side Google refresh token, so
# a wiped GOOGLE_REFRESH_TOKEN takes every one of them down at once.
ENDPOINTS=(
  "api/calendar|calendar (wall columns)"
  "api/calendar/upcoming|coming up / month view"
  "api/photos|photo frame"
  "api/tasks/todos|todos list"
)

probe_all() {
  FAILED=0
  for entry in "${ENDPOINTS[@]}"; do
    path="${entry%%|*}"
    label="${entry##*|}"
    body="$(curl -s -m 20 -w $'\n%{http_code}' -H "Authorization: Bearer $HERMES_TOKEN" "$ORIGIN/$path")"
    status="${body##*$'\n'}"
    payload="${body%$'\n'*}"
    if [ "$status" = "200" ] && ! grep -q '"error"' <<<"$payload"; then
      echo "✓ $path — $label"
    else
      FAILED=1
      echo "✗ $path — $label (HTTP $status)"
      echo "    $(head -c 200 <<<"$payload")"
    fi
  done
}

probe_all
# Right after a deploy flips live, edges can briefly serve the previous
# build's responses (seen 2026-07-20: two endpoints 500'd on the first probe,
# clean seconds later). One retry separates propagation lag from real breakage.
if [ "$FAILED" = "1" ]; then
  echo "… retrying once in 20s (edge propagation right after a deploy can lag)"
  sleep 20
  probe_all
fi

if [ "$FAILED" = "1" ]; then
  echo ""
  echo "✗ Live smoke FAILED. Likely causes, most common first:"
  echo "  1. A secret env var got wiped (GET omits secret values — never PATCH"
  echo "     a full env map; per-key only via scripts/set-cf-env-var.mjs)."
  echo "  2. Env change without a redeploy — CF Pages binds env at deploy time."
  echo "  3. Google refresh token expired/revoked (docs/google-setup.md §2.6)."
  exit 1
fi
echo "✓ Live smoke passed."
