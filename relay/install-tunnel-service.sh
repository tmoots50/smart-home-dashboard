#!/usr/bin/env bash
set -euo pipefail

if [[ "$EUID" -ne 0 || -z "${SUDO_USER:-}" || "$SUDO_USER" == "root" ]]; then
  echo "Run this helper with sudo from the relay user's account." >&2
  exit 1
fi

USER_HOME="$(dscl . -read "/Users/${SUDO_USER}" NFSHomeDirectory | awk '{ print $2 }')"
SOURCE_DIR="${USER_HOME}/.cloudflared"
SOURCE_CONFIG="${SOURCE_DIR}/config.yml"
SYSTEM_DIR="/etc/cloudflared"
SYSTEM_CONFIG="${SYSTEM_DIR}/config.yml"
TEMP_CONFIG="${SYSTEM_DIR}/config.yml.tmp.$$"
CLOUDFLARED="/usr/local/bin/cloudflared"

cleanup() {
  rm -f "$TEMP_CONFIG"
}
trap cleanup EXIT HUP INT TERM

if [[ ! -x "$CLOUDFLARED" ]]; then
  echo "cloudflared is not installed at ${CLOUDFLARED}." >&2
  exit 1
fi
if [[ ! -f "$SOURCE_CONFIG" ]]; then
  echo "Tunnel config not found at ${SOURCE_CONFIG}." >&2
  exit 1
fi

CREDENTIALS_FILE="$(awk -F': *' '$1 == "credentials-file" { print $2; exit }' "$SOURCE_CONFIG")"
if [[ -z "$CREDENTIALS_FILE" || ! -f "$CREDENTIALS_FILE" ]]; then
  echo "Tunnel credentials referenced by config.yml were not found." >&2
  exit 1
fi
CREDENTIALS_NAME="$(basename "$CREDENTIALS_FILE")"

install -d -m 755 "$SYSTEM_DIR"
install -m 600 "$CREDENTIALS_FILE" "${SYSTEM_DIR}/${CREDENTIALS_NAME}"
sed "s#^credentials-file:.*#credentials-file: ${SYSTEM_DIR}/${CREDENTIALS_NAME}#" "$SOURCE_CONFIG" > "$TEMP_CONFIG"
install -m 644 "$TEMP_CONFIG" "$SYSTEM_CONFIG"
rm -f "$TEMP_CONFIG"
trap - EXIT HUP INT TERM

"$CLOUDFLARED" --config "$SYSTEM_CONFIG" tunnel ingress validate
if launchctl print system/com.cloudflare.cloudflared >/dev/null 2>&1; then
  launchctl kickstart -k system/com.cloudflare.cloudflared
else
  "$CLOUDFLARED" service install
  launchctl start com.cloudflare.cloudflared
fi

echo "cloudflared boot service installed with config at ${SYSTEM_CONFIG}."
