# pi/

Raspberry Pi system config: scripts and unit files that turn a fresh Pi into a wall-mounted dashboard.

These run **on the Pi**, not on the dev laptop. See [`docs/install.md`](../docs/install.md) for the full runbook.

## Files
- `install.sh` — one-shot kiosk setup script (run after first SSH in)
- `server/` — home-server stack (Home Assistant + Matter + cloudflared + uptime-kuma + speedtest-tracker, docker-compose). Deploy: `rsync -av pi/server/ pi@dashboard.local:~/server/ && ssh pi@dashboard.local '~/server/install.sh'`. See `docs/home-assistant.md` + `docs/pi-home-server.md`.
- `server/backup.sh` — nightly snapshot of `~/server` → `~/backups/server` (7 daily + 4 weekly tarballs; HA recorder DB hot-copied via sqlite online backup). Installed as root systemd timer `server-backup.timer` (03:30). Restore: `docker compose down`, untar over `~/server`, `docker compose up -d`.
- `kiosk.sh` — Chromium kiosk launcher
- `rotate-display.sh` — `wlr-randr` portrait rotation (Wayland)
- `systemd/dashboard-server.service` — `vite preview` static server at boot
- `systemd/dashboard-kiosk.service` — Chromium `--kiosk` at boot, after server is up
