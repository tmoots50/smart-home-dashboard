# Home Assistant integration — design doc

**Status:** design / sign-off. Started 2026-07-06.
**Goal:** a "Home" control surface on the dashboard to view + control the Aqara U100
smart lock and smart plugs.

> **Scope change vs. the old reality check.** `CLAUDE.md` and `_context/ui-inspo.md`
> previously said "no Home Assistant — don't wire widgets to it." That is now
> **superseded**: Tim has an Aqara U100 lock + smart plugs in Aqara Home **and**
> Apple HomeKit, and has decided to stand up HA on the Pi as the control backend.
> Those docs are being updated to match.

---

## Decisions (locked 2026-07-06)

| Question | Answer | Consequence |
|---|---|---|
| Hub Matter support | **Yes, Matter-capable** | Aqara devices shared into HA over **Matter multi-admin** → Apple Home keeps working, HA is a *second* admin. Local control. No un-pairing from Apple Home. |
| Lock control level | **Full lock + unlock, PIN-gated** | Unlock is a real threat surface. Needs defense-in-depth (below). |
| HA install | **Home Assistant OS** on the Pi 5 | Wipe Pi OS → HAOS. Gain the add-on store (Matter Server, Cloudflare Tunnel add-ons). Pi becomes HA-focused; other shims run as add-ons/containers. |

---

## Architecture

```
Aqara U100 + smart plugs
  └─ Aqara hub (Matter bridge; multi-admin: Apple Home AND Home Assistant)
       └─ Home Assistant OS on Raspberry Pi 5
            • Matter integration (via Matter Server add-on)
            • dedicated long-lived access token for the dashboard
            • Cloudflare Tunnel add-on → private hostname reachable from CF edge
       └─ Cloudflare Pages Functions (server-side; hold HA token + PIN hash)
            GET  /api/home           → { lock: {state, battery}, plugs: [{id,name,on}] }
            POST /api/home/plug      → { id, on }        (read-token auth)
            POST /api/home/lock      → { action, pin? }  (unlock requires PIN)
       └─ Dashboard "Home" overlay (tablet, Fully Kiosk)
            • opened from the action-bar button (repurpose the stubbed `lights` btn)
            • Mushroom-style tiles: front-door lock + plug toggles
            • PIN pad appears only for unlock
```

### Why a CF Function proxy and not direct tablet→HA calls
The tablet is on the LAN and *could* hit HA directly, but:
1. The dashboard is served over **HTTPS from pages.dev**; a direct call to
   `http://homeassistant.local:8123` is blocked as mixed content.
2. Any token the tablet holds is in the **public client bundle** — unacceptable for a
   token that can unlock a deadbolt.

Routing control through CF Functions keeps the **HA token server-side only**, lets us
enforce the PIN + rate-limit centrally, and reaches HA privately via Cloudflare Tunnel
(no ports opened, HA never on the raw public internet).

---

## Security model (the deadbolt is the whole ballgame)

The read token (`VITE_DASHBOARD_TOKEN`) ships in the public bundle — assume it is known.
So the security of **unlock** must not depend on it. Layers:

1. **Two-tier auth.**
   - Read + plug-toggle endpoints: authorized by the bundle read token (public, low stakes — worst case someone toggles a lamp on the tailnet-reachable... no, on the public endpoint. Plugs are low-consequence; acceptable).
   - **Unlock**: requires a **PIN** in the request body, verified server-side against
     `HOME_UNLOCK_PIN_HASH` (salted SHA-256, constant-time compare). The PIN is the real
     secret and is **never** in the bundle.
2. **HA token server-side only** — in CF env, never shipped to the browser. Even with the
   public read token, an attacker cannot call HA directly.
3. **Rate-limit / lockout (mandatory, not optional).** A 6-digit PIN on a public endpoint
   is brute-forceable without it. Back a failed-attempt counter with **CF KV**: lock out
   after 5 fails for 15 min, per-IP and global. Log every attempt.
4. **Private reachability.** HA is exposed to CF only through Cloudflare Tunnel; optionally
   put **Cloudflare Access (service token)** in front so the hostname leaking isn't enough.
5. **Audit.** Every lock/unlock (success + fail) logged with timestamp + outcome.
6. **Revocable.** The dashboard uses a dedicated HA long-lived token — revoke it in HA to
   kill dashboard control instantly without touching Apple Home.

**Residual risk (accept explicitly):** a 6-digit PIN + KV lockout is "home-grade," not
"bank-grade." Good enough for a family front door where the physical fallback is a key and
the Apple Home path is unchanged. If we ever want stronger, add Cloudflare Access on the
control endpoints or a TOTP second factor. **Lock (not unlock) is always allowed without a
PIN** — locking your own door is not a threat.

---

## Build order

### Buildable NOW (no Pi / no HA needed — mock-first, per house rules)
- [ ] `lib/home-mock.js` — fixture: 1 lock (locked, 87% battery) + 3 named plugs.
- [ ] `widgets/home.js` — the overlay: lock tile (state + battery + lock/unlock), plug
      toggle tiles, PIN pad shown only on unlock. Mushroom-card aesthetic.
- [ ] Co-located tests (`widgets/home.test.js`): render states, PIN-pad gating, optimistic
      toggle + rollback on failure.
- [ ] Wire the action-bar `lights` button → open the Home overlay (replace the stub alert).
- [ ] `lib/home.js` — CF Function client, same `{initial, live}` + actions contract as
      `tasks.js`. Fails soft to mock when unconfigured.
- [ ] CF Functions `/api/home`, `/api/home/plug`, `/api/home/lock` — return mock/501 until
      `HA_BASE_URL` + `HA_TOKEN` env are set, so they're deployable before HA exists.
- [ ] Deploy → Tim reacts to the UX on the real tablet ("show me, then I'll know").

### Blocked on Tim + Pi online (physical / hands-on session)
- [ ] Power the Pi on; confirm reachable (Tailscale up here or on the Pi).
- [ ] Flash Pi 5 → **Home Assistant OS**; complete onboarding.
- [ ] Install **Matter Server** add-on. In the Aqara app, share the hub/devices to Matter;
      add the Matter code(s) to HA. Confirm the U100 + plugs appear as HA entities.
      Verify Apple Home still controls them (multi-admin sanity check).
- [ ] Install **Cloudflare Tunnel** add-on (or `cloudflared`); expose HA at a private
      hostname. Optionally add Cloudflare Access service token.
- [ ] Create a dedicated HA long-lived token for the dashboard.
- [ ] Set CF env: `HA_BASE_URL`, `HA_TOKEN`, `HOME_UNLOCK_PIN_HASH`, KV binding for lockout.
- [ ] Flip `/api/home*` Functions from mock → live. Verify end-to-end on the tablet.
- [ ] Confirm lock/unlock + plug toggle work from the wall; verify lockout after bad PINs.

---

## Open items / notes
- **Entity IDs**: the Matter integration names entities like `lock.front_door` and
  `switch.<plug>`; the exact IDs come from HA after pairing. `/api/home` maps them to the
  stable shape the widget expects, configured via an `HA_ENTITIES_JSON` env var (same
  pattern as `GOOGLE_CALENDARS_JSON`).
- **Plug consequence check**: confirm which plugs are safe to toggle from a wall tap (a lamp
  is fine; a plug feeding a router or a sump pump is not). Allowlist only the safe ones in
  `HA_ENTITIES_JSON`.
- **Nabu Casa alternative**: HA Cloud ($6.50/mo) is an easier remote path than Cloudflare
  Tunnel and funds the project. Tunnel chosen for $0 + it keeps everything on Cloudflare,
  but revisit if the tunnel is fiddly.
- **Old reality-check docs** to update once this is approved: `CLAUDE.md` "Smart-home reality
  check", `_context/ui-inspo.md` HA notes, and the `spec.md` smart-home inventory.
