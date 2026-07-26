#!/usr/bin/env bash
# One-shot server-stack setup on the Pi (Docker + compose + the home stack).
# Safe to re-run. Kiosk setup is separate — see ../install.sh.
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  echo "Docker installed — log out/in (or run 'newgrp docker'), then re-run this script."
  exit 0
fi

mkdir -p homeassistant matter
touch homeassistant/automations.yaml homeassistant/scripts.yaml homeassistant/scenes.yaml
[ -f .env ] || cp .env.example .env

# cloudflared crash-loops without a token — bring it up only once Phase C mints one.
if grep -q '^CLOUDFLARED_TUNNEL_TOKEN=.\+' .env; then
  docker compose up -d
else
  docker compose up -d homeassistant matter-server
  echo "cloudflared skipped: no CLOUDFLARED_TUNNEL_TOKEN in .env yet (Phase C)."
fi

# Nightly backup timer (root: HA volumes are root-owned). Units are inlined
# here so the plain `rsync pi/server/ → ~/server/` deploy carries everything.
if [ -f backup.sh ]; then
  chmod +x backup.sh
  sudo tee /etc/systemd/system/server-backup.service >/dev/null <<'UNIT'
[Unit]
Description=Snapshot the home-server stack volumes (~/server -> ~/backups)

[Service]
Type=oneshot
ExecStart=/home/tmoots/server/backup.sh
UNIT
  sudo tee /etc/systemd/system/server-backup.timer >/dev/null <<'UNIT'
[Unit]
Description=Nightly home-server backup at 03:30

[Timer]
OnCalendar=*-*-* 03:30:00
RandomizedDelaySec=15m
Persistent=true

[Install]
WantedBy=timers.target
UNIT
  sudo systemctl daemon-reload
  sudo systemctl enable --now server-backup.timer
fi

docker compose ps
echo "HA will be at http://$(hostname).local:8123 in ~a minute (first boot pulls + migrates)."
