# Home Assistant integration — design doc

**Status:** design / sign-off. Rev 2, 2026-07-10 (supersedes the 2026-07-06 rev).
**Goal:** make Home Assistant the household's control brain, and give the wall
dashboard two ways into it — curated PIN-gated tiles for daily actions, and a
"Full Home" button that opens the real HA UI. Voice (replacing Alexa) is the
same dependency wearing a different hat.

> **What rev 1 got wrong.** The 2026-07-06 "decisions locked" table assumed Tim
> already owned a **Matter-capable Aqara hub** with devices in Aqara Home + Apple
> Home. Ground truth (2026-07-10): **no hub**, the U100 is Bluetooth/Apple-Home
> only (not reliably on Alexa), the plugs are **Gosund (Wi-Fi/Tuya) + Linkind**,
> and everything "smart" is really just remoted through Alexa's cloud. The UI and
> security layers rev 1 built are fine; only the "how devices reach HA" layer was
> founded on a hub that doesn't exist. This rev fixes that and adds voice.

---

## The thesis: HA is the hub we don't have

Every device is currently islanded in a vendor cloud. "On Alexa" is a voice remote,
not control we own — Alexa takes commands in but exposes nothing out. The whole
design is: **represent every device once, inside HA**, and then the wall tablet,
voice, the phone, and Apple Home all become *clients* of HA. We stop renting control
from Amazon and own it locally.

Corollary that drives sequencing: **HA can only control or voice-command devices
that are in HA.** Voice-replacing-Alexa and dashboard-control are one dependency
(get devices into HA), not two projects.

## Decisions (locked 2026-07-10)

| Question | Answer | Consequence |
|---|---|---|
| Do we own a hub? | **No.** Buy one. | The U100 has no hubless local path — an Aqara Matter-capable hub is required. |
| Lock → HA path | **Aqara Matter hub → Matter multi-admin → HA** | Apple Home Key keeps working; HA is a second admin. Local control. |
| Zigbee plugs / future sensors | **Zigbee coordinator on the Pi, ZHA for v1** | Linkind + cheap Aqara sensors + the PIR wake/sleep followup, all hubless. ZHA is built into HA — no MQTT broker container. Migrate to Zigbee2MQTT only if a device proves unsupported (re-pairing a handful of devices is cheap). |
| Wi-Fi/Tuya plugs (Gosund) | **Official Tuya cloud integration for v1; local is a later upgrade** | Cloud-first is the highest-probability one-shot path — no Tuya IoT developer account, no local-key extraction, no DP guessing. Upgrade to HACS `tuya-local` when cloud latency/outages grate (see Support later). |
| Remote reach + voice | **DIY: Cloudflare Tunnel + local Whisper/Piper** | $0/mo, most private, ~2s voice latency, more containers. Nabu Casa is a later drop-in. |
| Lock in the Full HA view? | **Yes, allowed** | Convenience over kiosk-physical-access purity — see residual risk. |

## Architecture

```
LAYER 1 — RADIOS / BRIDGES
   Aqara U100 lock ── Aqara Matter hub ──┐
   Linkind plugs ──── Zigbee dongle ──────┤
   Gosund plugs ───── Wi-Fi / Tuya ───────┤
   Pura diffuser ──── vendor cloud (HACS) ┘
                                          │
LAYER 2 — HOME ASSISTANT (single source of truth)
   Matter Server · ZHA · Tuya (cloud v1 → local later) · Assist voice pipeline
                                          │
LAYER 3 — CONTROL SURFACES (clients of HA)
   • Wall tablet: curated PIN-gated tiles      (BUILT: widgets/home.js)
   • Wall tablet: "Full Home" → real HA UI     (new)
   • Voice (Assist) — replaces Alexa           (new)
   • Phone (HA app) · Apple Home (parallel, via Matter multi-admin)
                                          │
LAYER 4 — REACH / SECURITY
   • Cloudflare Tunnel + Access · Tailscale for admin
   • token + PIN + KV lockout for curated actions  (BUILT: functions/_lib/ha.js)
```

## Per-device control paths

| Device | HA path | New hardware |
|---|---|---|
| **Aqara U100 lock** | Aqara Matter hub → Matter multi-admin → HA. Apple Home Key unaffected. | **Aqara Matter hub** — required |
| **Linkind plugs** | Pair to the Zigbee coordinator (ZHA), local. Cheap pre-check tonight: if they onboarded via the Linkind app + Alexa skill (no Echo-with-Zigbee-radio in the house), they're Wi-Fi/Tuya — treat as Gosund. | **Zigbee dongle** |
| **Gosund plugs** | Official Tuya cloud integration for v1. Local (`tuya-local`) later. | none |
| **Pura diffuser** | Community `pura` HACS integration (cloud). Low priority. | none |

The ZBT-1 is bought **regardless** of Linkind's radio: it's what lets us pair cheap
Aqara motion/contact sensors with no hub — the committed "PIR wake/sleep the tablet"
followup needs exactly that — plus any future Zigbee/Thread device.

## Control surfaces

### Curated tiles (BUILT — flip mock→live)
Lock/unlock (PIN-gated) + allowlisted plug toggles. tablet → CF Function → tunnel →
HA, HA token server-side only. Low-consequence toggles can be added from the wall via
the KV device registry (`functions/_lib/ha.js`); anything sensitive requires an env
allowlist change — a deliberate speed-bump.

### "Full Home" view (new)
The Home button also offers a "Full Home" button that opens the real HA Lovelace UI.
- **Mechanism: top-level navigation, never an iframe.** Rev 2 assumed a mixed-content
  block; that only applies to *subresources/iframes*. A top-level navigation from the
  HTTPS dashboard to an `http://` HA URL is plain navigation — always allowed. (Iframing
  HA is a trap regardless: frame-blocking headers, cookie `SameSite`, and Cloudflare
  Access login flows that refuse to run inside frames.)
- **Kiosk path: the local URL.** The kiosk browser lives on the same LAN as (likely the
  same Pi as) HA — navigate straight to `http://<pi>:8123`. No tunnel round-trip, no
  Access session to expire, works when the internet is down. The kiosk's Chromium uses
  its default profile (`pi/kiosk.sh` — no incognito), so the HA login persists across
  reboots after one sign-in.
- **Way back:** add a "Dashboard" weblink to the HA sidebar (or a Lovelace button)
  pointing at the dashboard URL, so there's always an on-screen route home from HA.
- **Remote path (away from home):** the tunnel hostname behind Cloudflare Access — for
  *browsers only*. The HA **companion app** cannot complete Access's challenge flows;
  phones use Tailscale or the LAN internal URL. Don't put Access in front of anything
  the app needs.
- **Landing page:** build a simplified, touch-friendly Lovelace view — don't drop onto
  the admin-dense default.
- **Lock included** (per 2026-07-10 decision) — see residual risk below.

## Voice — replacing Alexa (new phase)

HA **Assist** + a local **Wyoming** pipeline: openWakeWord (wake word) → faster-whisper
(STT, `base`/`small` on the Pi 5) → HA intent engine → Piper (TTS), all as containers on
the Pi. Assist acts on HA entities, so it inherits Layer 1 for free — no Alexa-specific
wiring.
- **Mic:** start with a USB mic; upgrade to the **HA Voice Preview Edition puck** for real
  far-field pickup. One puck ≈ one Alexa location; scale per-room over time.
- **Latency:** expect ~2s on local Whisper — not Alexa-instant. Accepted for privacy +
  $0. Nabu Casa Cloud (~$6.50/mo) is the drop-in if it grates.

## Security model (the deadbolt is the whole ballgame)

The read token (`VITE_DASHBOARD_TOKEN`) ships in the public bundle — assume it is known.
So the security of **unlock** must not depend on it. Layers:

1. **Two-tier auth.** Read + plug-toggle: authorized by the bundle read token (low stakes).
   **Unlock:** requires a **PIN** in the request body, verified server-side against
   `HOME_UNLOCK_PIN_HASH` (salted SHA-256, constant-time compare). The PIN is never in the
   bundle.
2. **HA token server-side only** — CF env, never shipped to the browser.
3. **Rate-limit / lockout (mandatory).** CF KV-backed failed-attempt counter: lock out after
   5 fails for 15 min, per-IP and global. Log every attempt.
4. **Private reachability.** HA reaches CF only through Cloudflare Tunnel; Cloudflare Access
   in front so a leaked hostname isn't enough.
5. **Audit.** Every lock/unlock (success + fail) logged with timestamp + outcome.
6. **Revocable.** Dedicated HA long-lived token — revoke it to kill dashboard control
   instantly without touching Apple Home.

**Residual risk (accepted explicitly):**
- A 6-digit PIN + KV lockout is "home-grade," not "bank-grade." The physical fallback is a
  key and Apple Home is unchanged. Lock (not unlock) is always allowed without a PIN.
- **Lock in the Full HA view:** someone with physical access to the kiosk can unlock via the
  full HA UI without the PIN. Accepted — the PIN's job is stopping *remote/programmatic*
  unlock; the kiosk reaches HA over the LAN, and remote browser access sits behind Cloudflare
  Access — so no stranger reaches the full UI remotely. Being physically at the wall panel already implies being inside. The
  kiosk holds a persisted HA session; if the tablet is pulled off the wall, revoke the session.

## Bill of materials

> **Directional, not prescriptive.** The specific models below are stand-ins for a
> *capability*. Substitute freely — any hardware that satisfies the same requirement works,
> and Tim may well land on different gear. The requirements, not the SKUs, are what's locked:
> - **A hub that bridges the U100 into HA over Matter** (without breaking Apple Home Key).
> - **A Zigbee coordinator** the Pi can host (bonus: also speaks Thread).
> - **A far-field mic** for room voice.

| Requirement | Example model | Cost | Verdict |
|---|---|---|---|
| Matter hub bridging the U100 | **Aqara M100** | ~$25–30 | **Required — and verified (2026-07-10):** field reports (Nov 2025, Aqara forum) confirm U100 → M100 Matter bridge → HA with Apple Home Key intact; Aqara sells a U100+M100 bundle on exactly this premise. Caveats: Wi-Fi-only (2.4 GHz — DHCP-reserve it, good coverage at the door), Aqara-only Zigbee (fine — generic Zigbee goes to the dongle), update firmware before commissioning. M3 (~$130) adds Ethernet/PoE, IR blaster, 127-device capacity — none load-bearing in this architecture. |
| Zigbee (+ Thread) coordinator | HA Connect ZBT-1 (online-only); SONOFF ZBDongle-E is the Amazon-same-day equivalent (Zigbee only, no Thread) | ~$25–30 | **Recommended** — Linkind + sensors + PIR wake/sleep. No big-box store stocks either. |
| Far-field room mic | HA Voice Preview Edition puck | ~$59 | **Optional now**, per-room later. |
| Software | Matter Server, ZHA, Tuya integration, Wyoming/Assist, `pura` | $0 | containers / HACS |

Floor to control lock + local plugs: **~$55** (M100 + dongle). With good voice: ~$115.

## Goal — the one-shot build session

This section is the contract for the autonomous build session. Run it as a **single
well-specified first turn** (this doc is the spec) on **`claude-fable-5`, effort high**
— Fable 5 is the model built for exactly this shape of work: one long-horizon
multi-service run with self-verification. `claude-opus-4-8` is the budget alternative.
Tim is hands for the physical steps (plugging hardware, phone-app Matter commissioning,
pressing pairing buttons); the agent drives everything else.

### /goal

Home Assistant is live on the Pi as the household's control brain: every phase below
that has its hardware present is completed **and verified**, the wall dashboard's
curated tiles operate real devices (mock mode off), and the Full Home button opens the
real HA UI with a route back. Phases whose hardware is absent are explicitly reported
as deferred — never improvised around.

### Success criteria
1. **HA survives a reboot.** `docker compose up -d` (compose file committed in `pi/`)
   brings up HA + matter-server + cloudflared; after a Pi reboot all containers return
   healthy and HA answers at its LAN URL.
2. **Real plugs from the wall.** With `VITE_HOME_LIVE=1` shipped, toggling a Gosund plug
   tile on the deployed dashboard flips the physical plug, and HA state reflects it.
3. **Security stack proven live, not assumed.** Wrong PIN → rejected; 5 wrong PINs →
   locked out for 15 min; correct PIN → lock/unlock round-trip; every attempt visible in
   the audit log. (Runs only if Phase D's hub is present — else reported deferred.)
4. **Apple Home unharmed.** After Matter multi-admin commissioning, the U100 still locks/
   unlocks from Apple Home and Home Key still works. (Same condition as #3.)
5. **Full Home round-trip on the kiosk.** Button navigates to the HA UI (local URL);
   the HA sidebar link navigates back to the dashboard.

### Boundaries — do not cross
- **Never re-pair or factory-reset the U100's Apple Home relationship.** The hub adds HA
  as a *second* admin; if commissioning demands removal from Apple Home, stop and report.
- **No secrets in git or chat.** CF env only; dedicated revocable HA token; use
  `scripts/ship.sh` for dashboard deploys and the `cf-pages-infra` skill for KV/env
  bindings (no dashboard-clicking hand-offs).
- **No Cloudflare Access in front of anything the HA companion app needs.**
- **Hardware missing → phase deferred**, stated plainly in the report. Don't substitute,
  don't stub, don't loop retrying.
- **Don't touch router/gateway config**, and don't take the kiosk down for longer than a
  container restart — this box is family-production.
- **Voice (Phase F) is out of the one-shot scope** — separate session.
- Dashboard UI changes (Full Home button) follow the repo's QA-harness convention.

## Build order — independently shippable phases

**Order now (long pole):** a Matter hub + a Zigbee coordinator (models directional).

**Buildable without the Pi (done / mock-first):** curated overlay, `lib/home*.js`,
`/api/home*` Functions, KV registry — all shipped in local-mock mode.

The rev-2 ordering put lock commissioning (the most hardware- and luck-dependent step)
second, where a missing hub blocked everything behind it. Re-sequenced: **software-only
phases first**, hardware phases isolated at the end so a missing part blocks only
itself. Each phase ends with its own verification; don't start phase N+1 until N's
check passes.

**Phase A — HA core up ($0, software only).** Docker + Compose on Raspberry Pi OS;
HA + matter-server + cloudflared containers (`network_mode: host` for HA and
matter-server), volumes on NVMe, `restart: unless-stopped`; onboard HA.
*Verify:* HA UI at `http://<pi>:8123`; reboot the Pi; containers return.

**Phase B — Gosund plugs via Tuya cloud ($0 — first real devices).** Official Tuya
integration. *Verify:* both plugs toggle from HA UI (audible click); note wattage
reporting (gates Energy dashboard).

**Phase C — tunnel + curated tiles live + Full Home ($0).** `cloudflared` tunnel →
private hostname + Cloudflare Access (browsers only); set HA `http:`
`use_x_forwarded_for` + `trusted_proxies`; CF env (`HA_BASE_URL`, `HA_TOKEN`,
`HA_ENTITIES_JSON`, `HOME_UNLOCK_PIN_HASH`) + KV bindings (`HOME_LOCKOUT`,
`HOME_DEVICES`) via the `cf-pages-infra` skill; flip `VITE_HOME_LIVE=1`; ship. Add the
Full Home button (top-level nav to local HA URL) + HA sidebar link back.
*Verify:* plug toggles from pages.dev on the wall; PIN-gate + lockout exercised via API
(lock entity arrives in D); kiosk round-trips dashboard ↔ HA.

**Phase D — the lock (needs the Aqara hub).** Update hub firmware first. U100 → Aqara
hub → share to Matter → commission into HA **via the HA companion app on a phone**
(Bluetooth, same LAN — the phone is required hardware). Add the lock to
`HA_ENTITIES_JSON`. *Verify:* success criteria #3 and #4.

**Phase E — Zigbee (needs the dongle).** ZHA with the coordinator at its
`/dev/serial/by-id/...` path, on a USB-2 extension cable. Pair Linkind (if Zigbee).
*Verify:* Linkind toggles locally with Wi-Fi router unplugged from WAN (true-local test).

**Phase F — voice (separate session).** Assist + Wyoming containers (openWakeWord →
faster-whisper → Piper); USB mic first, far-field puck per room later.

## One-shot gotchas — known failure modes

The traps most likely to burn the session, pre-answered:

- **Matter needs host networking + IPv6.** `matter-server` and HA on
  `network_mode: host`; IPv6 link-local must work on the LAN (AP isolation and some
  mesh Wi-Fi setups break commissioning). Wire the Pi via Ethernet if possible.
- **Matter commissioning happens on a phone.** The HA companion app (with Bluetooth)
  does the commissioning dance — it cannot be done from HA's web UI alone.
- **Hub must bridge *locks* over Matter.** Bridged device-type support varies by Aqara
  model/firmware — update firmware before commissioning; M3 is the safe pick, verify M2
  before buying.
- **HA behind a proxy rejects the tunnel without `trusted_proxies`.** Set
  `http: use_x_forwarded_for: true` + `trusted_proxies` in `configuration.yaml` or
  requests via cloudflared 400/ban.
- **Cloudflare Access breaks the HA companion app.** Access is browser-only; phones use
  Tailscale/LAN.
- **USB 3 + NVMe RF interference kills 2.4 GHz Zigbee.** Dongle on a USB-2 extension
  cable, away from the Pi. Reference it by `/dev/serial/by-id/` (stable across reboots),
  never `/dev/ttyUSB0`.
- **Tuya plugs are 2.4 GHz-only** — already paired, so fine; DHCP-reserve their IPs now
  to make the later local-control upgrade painless.
- **One Pi wears two hats.** The same Pi 5 (8 GB) is the kiosk *and* the server. HA +
  matter + cloudflared + Chromium coexist fine; the squeeze arrives with voice (whisper
  + Chromium) — see Support later.
- **KV lockout is best-effort.** Workers KV is eventually consistent; counters can lag
  across edge locations, and the global counter is a self-DoS vector (household member
  fat-fingering the PIN can lock everyone out for 15 min). Accepted — physical key +
  Apple Home unaffected.

## Support later (deliberately deferred)

- **Local Tuya control** ([`make-all/tuya-local`](https://github.com/make-all/tuya-local),
  HACS): newer versions offer cloud-assisted setup (QR scan with the Smart Life app) that
  can fetch device IDs/local keys without a Tuya IoT developer account — much lower
  barrier than the classic local-key extraction chore. Still wants DHCP reservations for
  the plugs. Do it when cloud latency or a Tuya outage bites; verify the QR flow works
  for the Gosund models at that point.
- **Voice depth:** Assist's built-in intents cover "turn on X / is the door locked";
  open-ended queries need an LLM conversation agent behind Assist (local or API) —
  later. Watch Pi RAM once whisper joins Chromium; zram or a second box are the outs.
  Nabu Casa (~$6.50/mo) remains the everything-hurts escape hatch.
- **Failed-unlock push notification** (HA notify / ntfy): cheap, high value. First
  post-standup follow-up.
- **Remote Full-Home session lifetime:** Access sessions expire (re-auth cadence on any
  remote browser). Options when it grates: longer Access session, bypass rule for the
  home IP (dynamic-IP caveat), or Nabu Casa.
- **Energy dashboard** once wattage reporting is confirmed per plug.
- **ZHA → Zigbee2MQTT migration** only if a device is unsupported (full re-pair, cheap
  at this device count).
- **Cross-doc drift:** `pi-home-server.md` still carries rev-1 assumptions ("Aqara plug
  models", "share hub/devices to Matter" as an early step) — sweep it when HA lands.

## Open items
- Confirm Linkind radio (Zigbee vs Wi-Fi/Tuya) — check the app tonight (see per-device
  table); changes nothing in the plan, only which integration adopts them.
- Verify the specific hub model bridges the U100 lock over Matter (the one spec that
  matters).
- Confirm Gosund/Linkind wattage reporting → gates the HA Energy dashboard.
- Align `pi/kiosk.sh` default URL (`localhost:4173`) with the deployed pages.dev URL the
  plan assumes the wall runs.
- Full box architecture (DNS filtering, monitoring, backups) lives in `pi-home-server.md`.
