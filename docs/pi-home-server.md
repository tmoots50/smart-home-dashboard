# Pi as home-services server — design doc

**Status:** deployed (core). Started 2026-07-06; stack live on the Pi since 2026-07-11
(HA + matter-server + cloudflared), monitoring + nightly backups added 2026-07-25.
DNS filtering still pending the Xfinity gateway decision. Kiosk note: since the
2026-05-05 device pivot the wall display is the Meswao tablet — the Pi is server-only.
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
| `uptime-kuma` | `louislam/uptime-kuma` | service/host uptime | ✅ live `:3001` (2026-07-25) |
| `speedtest-tracker` | `linuxserver/speedtest-tracker` | WAN speed over time | ✅ live `:8081`, samples every 6h (2026-07-25) |

The `docker-compose.yml` lives in `pi/server/` (committed) so the box is reproducible.
Volume backups: ✅ nightly `server-backup.timer` (03:30) → `~/backups/server`, 7 daily +
4 weekly tarballs; the HA recorder DB is hot-copied via sqlite's online backup API. See
`pi/server/backup.sh`. Off-box copy is still an open question (below).

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

HA Energy dashboard, fed by the smart plugs **if they report power** (ground truth
2026-07-10: the plugs are Gosund Wi-Fi/Tuya + Linkind — verify wattage reporting per
model once they're in HA). Optimization = visibility + automations (kill idle draw,
schedule). Keep this in HA; it's HA's strongest non-automation feature.

## Build order (status 2026-07-25)

1. ✅ Pi powered + reachable (LAN `dashboard.local` / `10.0.0.110`, Tailscale up).
2. ✅ Docker + Compose on Raspberry Pi OS (2026-07-11).
3. ✅ HA + matter-server up; HA onboarded. Reboot-resilience proven 2026-07-25.
4. ⏳ Device commissioning (Aqara hub → Matter → HA; Zigbee dongle → ZHA) — **runs in the
   parallel Aqara/Zigbee thread**, per `docs/home-assistant.md` Phases D/E.
5. ◑ `cloudflared` tunnel ✅ (`ha.mootsproductgroup.com` + CF Access + service-token auth,
   verified end-to-end). Still to set: `HA_TOKEN`, `HOME_UNLOCK_PIN_HASH`,
   `HA_ENTITIES_JSON`; then flip `VITE_HOME_LIVE=1`.
6. ⏳ AdGuard/Pi-hole **after** verifying the gateway DNS-override toggle (decision pending).
7. ✅ Monitoring containers (uptime-kuma `:3001`, speedtest-tracker `:8081`, 2026-07-25).
   Plus nightly volume backups (`server-backup.timer` → `~/backups/server`).

## Open questions
- Does the Xfinity gateway allow DHCP DNS override? (gates network-wide filtering)
- Do the Gosund/Linkind plugs report power? (gates the Energy dashboard)
- ~~Backup target for the compose volumes~~ → local NVMe snapshots nightly (2026-07-25);
  **off-box copy** still open (old-Mac rsync is the cheap option, or B2/S3).
