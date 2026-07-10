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
| Zigbee plugs / future sensors | **Zigbee coordinator (ZBT-1) on the Pi** | Linkind + cheap Aqara sensors + the PIR wake/sleep followup, all hubless. |
| Wi-Fi/Tuya plugs (Gosund) | **LocalTuya (HACS)**, cloud fallback | Local control, no flashing. |
| Remote reach + voice | **DIY: Cloudflare Tunnel + local Whisper/Piper** | $0/mo, most private, ~2s voice latency, more containers. Nabu Casa is a later drop-in. |
| Lock in the Full HA view? | **Yes, allowed** | Convenience over kiosk-physical-access purity — see residual risk. |

## Architecture

```
LAYER 1 — RADIOS / BRIDGES
   Aqara U100 lock ── Aqara Matter hub ──┐
   Linkind plugs ──── Zigbee dongle ──────┤
   Gosund plugs ───── Wi-Fi / LocalTuya ──┤
   Pura diffuser ──── vendor cloud (HACS) ┘
                                          │
LAYER 2 — HOME ASSISTANT (single source of truth)
   Matter Server · ZHA/Zigbee2MQTT · LocalTuya · Assist voice pipeline
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
| **Linkind plugs** | Pair to the Zigbee coordinator (ZHA/Zigbee2MQTT), local. If they prove Wi-Fi/Tuya, treat as Gosund. | **ZBT-1 dongle** |
| **Gosund plugs** | LocalTuya (HACS), local. Fallback: official Tuya cloud integration. | none |
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
The Home button also offers a "Full Home" button that opens the real HA Lovelace UI in
the tablet webview.
- **Reachability:** tablet is HTTPS (pages.dev), so `http://homeassistant.local` is a
  mixed-content block. Serve the HA UI over the **same Cloudflare Tunnel hostname**
  (HTTPS), behind **Cloudflare Access**. Log in once on the kiosk; persist the session.
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
  unlock; the Full HA view sits behind Cloudflare Access + a persisted session, so no stranger
  reaches it remotely. Being physically at the wall panel already implies being inside. The
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
| Matter hub bridging the U100 | Aqara M3 (or M2 budget) | ~$60–130 | **Required.** Verify the chosen model bridges the U100 over Matter before buying. |
| Zigbee (+ Thread) coordinator | HA Connect ZBT-1 | ~$30 | **Recommended** — Linkind + sensors + PIR wake/sleep. |
| Far-field room mic | HA Voice Preview Edition puck | ~$59 | **Optional now**, per-room later. |
| Software | Matter Server, ZHA, LocalTuya, Wyoming/Assist, `pura` | $0 | containers / HACS |

Floor to control lock + local plugs: **~$90** (hub + dongle). With good voice: ~$150.

## Build order

**Order now (long pole):** a Matter hub + a Zigbee/Thread coordinator (models above are
directional — buy whatever meets the two requirements).

**Buildable without the Pi (done / mock-first):** curated overlay, `lib/home*.js`,
`/api/home*` Functions, KV registry — all shipped in local-mock mode.

**Pi standup session (Pi powered on + reachable):**
1. Docker + Compose on Raspberry Pi OS; HA + matter-server containers up; onboard HA.
2. Commission the U100 into the Aqara hub → share to Matter → into HA. Verify Apple Home
   still controls it (multi-admin sanity check).
3. Pair Linkind to the coordinator (ZHA/Zigbee2MQTT); add Gosund via LocalTuya. Confirm which
   plugs report wattage (gates the Energy dashboard).
4. `cloudflared` tunnel → private HA hostname; add Cloudflare Access.
5. Set CF env (`HA_BASE_URL`, `HA_TOKEN`, `HA_ENTITIES_JSON`, `HOME_UNLOCK_PIN_HASH`, KV);
   flip `VITE_HOME_LIVE=1`. Curated tiles go live.
6. Add the "Full Home" button + a touch-friendly Lovelace view (lock included).
7. **Voice phase:** Assist + Wyoming containers; USB mic first, then a far-field puck per room.

## Open items
- Confirm Linkind radio (Zigbee vs Wi-Fi/Tuya) at pairing time — changes nothing in the plan,
  only which integration adopts them.
- Verify the specific hub model bridges the U100 lock over Matter (the one spec that matters).
- Confirm Gosund/Linkind wattage reporting → gates the HA Energy dashboard.
- Full box architecture (DNS filtering, monitoring, backups) lives in `pi-home-server.md`.
