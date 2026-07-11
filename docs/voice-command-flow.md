# Voice command flow — kiosk → Hermes → Telegram

## Architecture

```text
Fully Kiosk microphone
  → POST /api/voice/transcribe (Cloudflare Workers AI / Whisper)
  → transcript confirmation + five-second auto-send
  → POST /api/voice/send (held for at most 25 seconds)
  → Cloudflare Tunnel
  → 127.0.0.1:8787 on the old Mac
  → Telethon user session sends as Tim to @mootsfambot
  → Hermes replies in the real Telegram thread
  → relay collects progress messages until 2s quiet / 20s total
  → reply appears on the kiosk
```

Hermes needs no code or configuration change. Telegram remains the system of
record. A long press on the dashboard mic always opens the real Telegram chat.

## Secret and binding inventory

| Location | Name | Purpose |
|---|---|---|
| App bundle | `VITE_DASHBOARD_TOKEN` | Calls authenticated dashboard Functions; deterrent, not a cryptographic secret |
| Cloudflare Pages | `DASHBOARD_TOKEN` | Validates dashboard requests |
| Cloudflare Pages | `RELAY_URL` | `https://relay.<domain>` tunnel hostname |
| Cloudflare Pages | `RELAY_SECRET` | Authenticates Function → local relay; never `VITE_` |
| Pages binding | `AI` | Workers AI transcription |
| Old Mac `.env` | `TG_API_ID`, `TG_API_HASH` | Telegram user API application |
| Old Mac `.env` | `RELAY_SECRET` | Must match Cloudflare |
| Old Mac session file | Telethon `.session` | Full user-session credential; most sensitive artifact |

## Cloudflare setup

Bind Workers AI and set live mode:

```bash
source .envrc.local
node scripts/bind-ai.mjs
node scripts/set-cf-env-var.mjs VITE_VOICE_LIVE 1
node scripts/set-cf-env-var.mjs RELAY_URL "https://relay.example.com"
node scripts/set-cf-env-var.mjs RELAY_SECRET "$RELAY_SECRET" --secret
```

The Cloudflare account must have a zone for the relay hostname. Add the existing
domain to Cloudflare, change nameservers at the registrar, and wait for the zone
to become Active before creating the tunnel. Confirm the Workers plan: audio is
capped at 1MB, but the base64 conversion and AI invocation should still be
tested on the actual plan with a real `audio/webm;codecs=opus` tablet recording.

The automation token needs Account **Cloudflare Tunnel: Edit** plus zone-scoped
**Zone: Read** and **DNS: Edit** for `mootsproductgroup.com`. Then run:

```bash
source .envrc.local
node scripts/setup-relay-tunnel.mjs mootsproductgroup.com oldmac
```

The script never prints the tunnel secret: it sends credentials to the old Mac
over SSH stdin, installs `~/.cloudflared/config.yml`, and creates the proxied DNS
record idempotently.

On the old Mac:

```bash
brew install cloudflared
cloudflared tunnel login
cloudflared tunnel create hermes-relay
# copy relay/cloudflared-config.example.yml to ~/.cloudflared/config.yml and edit
cloudflared tunnel route dns hermes-relay relay.example.com
sudo cloudflared service install
```

The relay itself binds only to `127.0.0.1`; cloudflared is the only remote path.

## Runbooks

### Relay health and logs

```bash
curl https://relay.example.com/healthz
tail -f ~/.hermes-relay/logs/relay.log
launchctl kickstart -k gui/$(id -u)/ai.hermes.relay
```

Audit lines include character count, response count, status, and elapsed time;
they never contain the command, Telegram credentials, or relay secret.

### Revoke a compromised Telegram session

In Telegram: **Settings → Devices → terminate the old Mac session immediately**.
Then remove the local `.session*` files, rotate `TG_API_HASH` if warranted, and
run `relay.py --login` again. Treat the session plus API hash as account takeover
material. Keep FileVault enabled and both `.env` and `.session` mode 600.

### Rotate the tunnel or relay secret

Create/route a replacement tunnel, update `RELAY_URL`, and redeploy. For the
secret, generate `openssl rand -hex 32`, update the old Mac `.env` and Cloudflare
`RELAY_SECRET`, then restart the relay. Never prefix it with `VITE_`.

## Failure drills

- Stop relay → kiosk shows “Hermes is out of reach,” with Telegram fallback.
- Stop tunnel → same designed failure, never a blank overlay.
- Return empty transcription → confirm screen says “Didn’t catch that” and does
  not auto-send.
- Make Hermes exceed 25 seconds → kiosk shows Sent; reply arrives in Telegram.
- Revoke microphone → permission guidance plus Telegram fallback.
- Double-tap mic → only one overlay exists.
- Send seven rapid commands → relay returns 429 after the allowed token-bucket
  burst/refill behavior.

The final proof is a spoken grocery command: it appears in the Telegram thread,
Hermes writes Google Tasks, and the dashboard shows it after the task cache TTL.
