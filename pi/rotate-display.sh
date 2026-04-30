#!/usr/bin/env bash
# Rotate the display to portrait on Wayland (Bookworm default on Pi 5).
# Output name (e.g. HDMI-A-1) is discovered at runtime.

set -euo pipefail

OUTPUT="$(wlr-randr | awk '/^[A-Za-z]/ {print $1; exit}')"

if [[ -z "${OUTPUT}" ]]; then
  echo "no display found" >&2
  exit 1
fi

# 90 = clockwise into portrait. Swap to 270 if upside-down.
wlr-randr --output "${OUTPUT}" --transform 90
