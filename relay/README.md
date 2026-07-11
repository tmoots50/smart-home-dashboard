# Hermes Telegram relay

This service runs on the old Mac and sends one dashboard command at a time to
`@mootsfambot` as Tim. It listens on localhost only, accepts one fixed secret,
has one fixed Telegram destination, limits commands to six/minute with burst
three, and returns all Hermes progress/reply messages after a two-second quiet
window (20-second overall cap).

## Install and authorize

Requires Python 3.11+ and FileVault.

```bash
brew install python@3.11
mkdir -p ~/.hermes-relay/logs
python3.11 -m venv ~/.hermes-relay/venv
~/.hermes-relay/venv/bin/pip install -r relay/requirements.txt
cp relay/relay.py ~/.hermes-relay/
```

Create `~/.hermes-relay/.env`:

```dotenv
TG_API_ID=12345678
TG_API_HASH=from-my-telegram-org
RELAY_SECRET=generate-with-openssl-rand-hex-32
RELAY_PORT=8787
BOT_USERNAME=mootsfambot
SESSION_PATH=/Users/YOU/.hermes-relay/tim.session
```

```bash
chmod 600 ~/.hermes-relay/.env
~/.hermes-relay/venv/bin/python relay/relay.py --login
chmod 600 ~/.hermes-relay/*.session*
```

Enter the phone, Telegram login code, and—if enabled—the 2FA password. The 2FA
password uses a non-echoing prompt. Never copy the session file to Cloudflare or
the repository. Telegram may revoke a new session it considers suspicious;
verify it remains authorized after 48 hours before calling production stable.

## Run and test locally

```bash
~/.hermes-relay/venv/bin/python relay/relay.py
curl http://127.0.0.1:8787/healthz
cd relay && RELAY_SECRET=… ./smoke.sh
```

`smoke.sh` pauses before sending one real `ping` to the bot and is never a CI
test. Wrong secrets return 401; malformed/long commands return 400; command
bursts return 429; disconnected Telegram returns 503.

## launchd and deploy

`deploy.sh` copies code to the configured Mac, creates the venv, installs pinned
dependencies, expands `__HOME__` in the LaunchAgent, and bootstraps it:

```bash
cd relay
RELAY_HOST=old-mac.local ./deploy.sh
launchctl kickstart -k gui/$(id -u)/ai.hermes.relay
```

The deploy helper defaults to Intel Homebrew's `/usr/local/bin/python3.11`
because the old Mac's Apple `python3` currently has a broken Command Line Tools shim.
Set `RELAY_PYTHON=/another/python3.11` if Homebrew is in a different location.

The LaunchAgent runs after user login/FileVault unlock. cloudflared should run as
its system LaunchDaemon so the tunnel comes up before login, though the relay
health endpoint will correctly return 503 until the user service is connected.

Revocation and tunnel procedures live in `docs/voice-command-flow.md`.
