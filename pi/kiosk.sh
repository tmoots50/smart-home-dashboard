#!/usr/bin/env bash
# Launch Chromium in kiosk mode pointing at the local Vite preview.
# Invoked by systemd unit dashboard-kiosk.service.

set -euo pipefail

URL="${DASHBOARD_URL:-http://localhost:4173}"

exec chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-features=TranslateUI \
  --check-for-update-interval=31536000 \
  --autoplay-policy=no-user-gesture-required \
  "$URL"
