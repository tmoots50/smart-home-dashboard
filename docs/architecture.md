# Architecture

Stub. To be filled out after Phase 2 (kiosk loop running on the Pi).

## Components

```
┌─────────────────────────────────────────────────────┐
│  Raspberry Pi 5 (Bookworm, headless after setup)    │
│                                                     │
│   systemd: dashboard-server.service                 │
│     └─ npm run preview  (vite, port 4173)           │
│                                                     │
│   systemd: dashboard-kiosk.service                  │
│     └─ chromium --kiosk http://localhost:4173       │
│                                                     │
│   wlr-randr: portrait rotation                      │
│   tailscale: remote SSH after wall-mount            │
└─────────────────────────────────────────────────────┘
                       │ HDMI + USB-C
                       ▼
              cocopar 15.6" portrait touchscreen
```

## Data flow (v1, mock-data first)

```
widget ── reads ──> lib/<source>-mock.js ── returns ──> fixture data
                            │
                            └─ later swap ─> real adapter (API, file, etc.)
```

Widgets never fetch. Views compose. Adapters in `lib/` are the swap surface between mock and real.
