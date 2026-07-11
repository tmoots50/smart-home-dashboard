#!/usr/bin/env bash
set -euo pipefail

umask 077

RELAY_DIR="${HOME}/.hermes-relay"
ENV_FILE="${RELAY_DIR}/.env"
TEMP_FILE="${ENV_FILE}.tmp.$$"

cleanup() {
  rm -f "$TEMP_FILE"
}
trap cleanup EXIT HUP INT TERM

mkdir -p "$RELAY_DIR" "${RELAY_DIR}/logs"

printf 'Telegram API ID: '
IFS= read -r TG_API_ID
if [[ ! "$TG_API_ID" =~ ^[0-9]+$ ]]; then
  echo "API ID must contain digits only." >&2
  exit 1
fi

printf 'Telegram API hash (hidden): '
IFS= read -r -s TG_API_HASH
printf '\n'
if [[ ! "$TG_API_HASH" =~ ^[[:xdigit:]]{32}$ ]]; then
  echo "API hash must be 32 hexadecimal characters." >&2
  exit 1
fi

RELAY_SECRET=""
if [[ -f "$ENV_FILE" ]]; then
  RELAY_SECRET="$(awk -F= '$1 == "RELAY_SECRET" { print substr($0, index($0, "=") + 1); exit }' "$ENV_FILE")"
fi
if [[ ! "$RELAY_SECRET" =~ ^[[:xdigit:]]{64}$ ]]; then
  RELAY_SECRET="$(openssl rand -hex 32)"
fi

cat > "$TEMP_FILE" <<EOF
TG_API_ID=${TG_API_ID}
TG_API_HASH=${TG_API_HASH}
RELAY_SECRET=${RELAY_SECRET}
RELAY_PORT=8787
BOT_USERNAME=mootsfambot
SESSION_PATH=${RELAY_DIR}/tim.session
EOF

chmod 600 "$TEMP_FILE"
mv "$TEMP_FILE" "$ENV_FILE"
trap - EXIT HUP INT TERM

echo "Relay configuration saved to ${ENV_FILE} (mode 600)."
echo "The Telegram API hash and relay secret were not printed."
