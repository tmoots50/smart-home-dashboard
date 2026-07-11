#!/usr/bin/env bash
set -euo pipefail
: "${RELAY_SECRET:?RELAY_SECRET is required}"
PORT="${RELAY_PORT:-8787}"
curl --fail --silent "http://127.0.0.1:$PORT/healthz"
echo
echo "WARNING: the next request sends one real 'ping' message to @mootsfambot."
read -r -p "Continue? [y/N] " answer
[[ "$answer" == y || "$answer" == Y ]] || exit 0
curl --fail --silent -H "X-Relay-Secret: $RELAY_SECRET" -H 'Content-Type: application/json' -d '{"text":"ping"}' "http://127.0.0.1:$PORT/command"
echo

