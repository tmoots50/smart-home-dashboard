#!/usr/bin/env bash
set -euo pipefail

: "${RELAY_HOST:?Set RELAY_HOST to the SSH host for the old Mac}"
REMOTE="${RELAY_REMOTE_DIR:-.hermes-relay/app}"
REMOTE_PYTHON="${RELAY_PYTHON:-/usr/local/bin/python3.11}"

ssh "$RELAY_HOST" "mkdir -p ~/.hermes-relay/app ~/.hermes-relay/logs"
scp relay.py relay_core.py requirements.txt ai.hermes.relay.plist "$RELAY_HOST:$REMOTE/"
ssh "$RELAY_HOST" "$REMOTE_PYTHON -m venv ~/.hermes-relay/venv && ~/.hermes-relay/venv/bin/pip install -r ~/.hermes-relay/app/requirements.txt"
ssh "$RELAY_HOST" 'sed "s|__HOME__|$HOME|g" ~/.hermes-relay/app/ai.hermes.relay.plist > ~/Library/LaunchAgents/ai.hermes.relay.plist && launchctl bootout gui/$(id -u)/ai.hermes.relay 2>/dev/null || true; launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/ai.hermes.relay.plist'
echo "deployed; run relay.py --login directly on the Mac if the session is not authorized"
