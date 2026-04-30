#!/usr/bin/env bash
# One-shot setup script for the Pi. Run after first SSH login.
# Idempotent — safe to re-run.

set -euo pipefail

# TODO: fill in once we're on-device. Sketch of what needs to happen:
#
#   1. apt update / upgrade
#   2. install: chromium-browser, nodejs (22 LTS via nodesource), git, log2ram, tailscale
#   3. clone repo to /opt/dashboard
#   4. cd app && npm ci && npm run build
#   5. install systemd units from pi/systemd/ to /etc/systemd/system/
#   6. systemctl enable --now dashboard-server dashboard-kiosk
#   7. install rotate-display.sh as a user systemd unit (Wayland session)
#   8. disable display blanking (wlr-randr or KMS, TBD)
#   9. tailscale up

echo "stub — fill in when on-device"
exit 0
