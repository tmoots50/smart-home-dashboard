# pi/

Raspberry Pi system config: scripts and unit files that turn a fresh Pi into a wall-mounted dashboard.

These run **on the Pi**, not on the dev laptop. See [`docs/install.md`](../docs/install.md) for the full runbook.

## Files
- `install.sh` — one-shot kiosk setup script (run after first SSH in)
- `server/` — home-server stack (Home Assistant + Matter + cloudflared, docker-compose). Deploy: `rsync -av pi/server/ pi@dashboard.local:~/server/ && ssh pi@dashboard.local '~/server/install.sh'`. See `docs/home-assistant.md`.
- `kiosk.sh` — Chromium kiosk launcher
- `rotate-display.sh` — `wlr-randr` portrait rotation (Wayland)
- `systemd/dashboard-server.service` — `vite preview` static server at boot
- `systemd/dashboard-kiosk.service` — Chromium `--kiosk` at boot, after server is up
