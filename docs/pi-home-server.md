# Pi as home-services server — design doc

**Status:** design / sign-off. Started 2026-07-06.
**One-liner:** the Raspberry Pi 5 becomes the household's central **applications host** —
Home Assistant, DNS filtering, monitoring, energy, and the dashboard's backend — run as
Docker containers **beside** the network, not inline.

> Supersedes the earlier "HAOS on the Pi" call (see `home-assistant.md` and the decision
> log). Under the broader "central home server" goal, a dedicated appliance OS is the wrong
> shape; a container stack on Raspberry Pi OS is.

---

## Goals / non-goals

**Goals** — one Pi 5 (8GB, NVMe, already provisioned) hosting, as containers:
- Home Assistant (Aqara U100 lock + smart plugs, via Matter multi-admin)
- Energy monitoring + automation (HA Energy dashboard)
- Network-wide DNS filtering (Pi-hole / AdGuard Home)
- Observability (WAN speed tracking, uptime, the Pi's own usage)
- The dashboard's backend reach (Cloudflare Tunnel → CF Pages Functions)

**Non-goals (deliberate):**
- **Not the router/gateway.** The Pi never sits inline between modem and LAN. Making the
  smart-home tinkering box a single point of failure for all home internet is a hard no in
  a household with a newborn and a high décor/reliability bar.
- **Not inline QoS / bandwidth shaping.** That's a router/AP function. The Pi observes and
  filters DNS; it does not shape traffic it doesn't route.

## The stack (docker-compose on Raspberry Pi OS)

Keep the CanaKit-preloaded Raspberry Pi OS (64-bit). Add Docker + Compose. Services:

| Container | Image | Purpose | Notes |
|---|---|---|---|
| `homeassistant` | `ghcr.io/home-assistant/home-assistant` | automation + energy | host network mode |
| `matter-server` | `ghcr.io/home-assistant-libs/python-matter-server` | Aqara Matter multi-admin | host network + IPv6 + mDNS |
| `adguard` (or `pihole`) | official | network DNS filtering | see gateway caveat below |
| `cloudflared` | `cloudflare/cloudflared` | tunnel → dashboard's `/api/home*` | private HA reachability |
| `uptime-kuma` | `louislam/uptime-kuma` | service/host uptime | optional, cheap |
| `speedtest-tracker` | `linuxserver/speedtest-tracker` | WAN speed over time | optional |

The `docker-compose.yml` lives in `pi/` (committed) so the box is reproducible. Schedule
volume backups — HA + the lock are family-depended-on; treat this box as production.

Pi 5 8GB runs all of the above comfortably. It's only underpowered as a *router*, which we
aren't making it.

## Network reality with an ISP-gateway-only setup (verify before promising)

- **DNS filtering needs a DHCP DNS override.** Point the ISP gateway to hand out the Pi's IP
  as the DNS server (Xfinity Admin Tool, `http://10.0.0.1`). ⚠️ **Xfinity gateways in gateway
  mode frequently do NOT allow this.** If blocked, fallbacks: (a) per-device DNS pointed at
  the Pi, (b) longer-term, bridge-mode the gateway + add your own router. Confirm the toggle
  exists before committing to Pi-hole as the network-wide solution.
- **No true per-device bandwidth graphs.** Requires inline / port-mirroring / router SNMP —
  none available from a closed gateway with the Pi beside it. Substitute: Pi-hole/AdGuard
  per-device *DNS-query* stats + WAN speed tracking + `vnstat` for the Pi itself.
- **Biggest future unlock:** ISP gateway → **bridge mode** + own router (UniFi etc.). Turns
  "observe + filter DNS" into "manage + optimize." Out of scope today; note it.

## Energy

HA Energy dashboard, fed by the smart plugs **if they report power** (Aqara plug models
vary — verify wattage reporting). Optimization = visibility + automations (kill idle draw,
schedule). Keep this in HA; it's HA's strongest non-automation feature.

## Build order (the Pi standup session — Pi must be powered on + reachable)

1. Power on the Pi; confirm reachable (Tailscale up here or on the Pi).
2. Install Docker + Compose on the existing Raspberry Pi OS.
3. `docker compose up` HA + matter-server; onboard HA.
4. Aqara app → share hub/devices to Matter; commission into HA; verify Apple Home still
   controls them (multi-admin sanity check). Confirm plug wattage reporting for Energy.
5. `cloudflared` tunnel → private HA hostname; wire the dashboard's `/api/home*` (set
   `HA_BASE_URL`, `HA_TOKEN`, `HA_ENTITIES_JSON`, `HOME_UNLOCK_PIN_HASH`, KV) and flip
   `VITE_HOME_LIVE=1`.
6. Add AdGuard/Pi-hole **after** verifying the gateway DNS-override toggle.
7. Add monitoring containers last (nice-to-have).

## Open questions
- Does the Xfinity gateway allow DHCP DNS override? (gates network-wide filtering)
- Do the specific Aqara plug models report power? (gates the Energy dashboard)
- Backup target for the compose volumes (NVMe snapshot? off-box?).
