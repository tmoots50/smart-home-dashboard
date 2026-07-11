# Dash Integrations: Spotify + In-Kiosk Voice to Hermes

## Context

The smart-home dashboard (vanilla JS + Vite, Cloudflare Pages + Functions, deployed at `smart-home-dashboard-de0.pages.dev`) runs on a Meswao B3 tablet in Fully Kiosk Browser. Two integrations are needed:

1. **Spotify** — tap the music button (currently stubbed) and get the full Spotify experience *without leaving Fully Kiosk*: browse, play, manage playlists, audio from tablet speakers. When something plays, a collapsed-player-style ticker pins to the bottom of the kiosk.
2. **Voice to Hermes** — the mic button currently deep-links into the Telegram app (leaves the kiosk). Replace with a Whisper-Flow-style in-kiosk flow: tap mic → record → see transcript → send → Hermes's reply shows on the kiosk, and the exchange stays in the real Telegram thread.

**Architecture-forcing facts (verified during planning):**
- `open.spotify.com` cannot be iframed (frame-ancestors blocked) → the "embedded view" = **navigate the Fully Kiosk webview** to the Spotify web player, with a return affordance. Never leaves Fully Kiosk.
- A Telegram **bot cannot receive messages sent with its own token** → the dashboard can't inject commands via `@mootsfambot`'s token. Delivery = a small **relay on the old Mac** using a Telethon user session as Tim. Hermes needs **zero changes**; the Telegram thread stays the system of record.
- The CF account has **no domain/zone** (live API probe) → Tim's **existing domain** gets onboarded to Cloudflare (nameserver change) to host the tunnel hostname. Also serves the future Home Assistant tunnel (docs/home-assistant.md Phase C).
- Hermes sends **interim/progress messages** (`interim_assistant_messages: true`) → the relay collects bot messages until 2s of quiet (20s cap), not just "the next reply".
- **Execution correction (2026-07-10):** Spotify's current official docs say
  Developer Dashboard refresh tokens expire after six months, and the Web
  Playback SDK requires `user-read-email` + `user-read-private` alongside
  `streaming`. The implementation/runbook use the current requirements below,
  superseding the stale token/scopes language in S1.

**Decisions locked with Tim:**
- Spotify: his personal **Premium** account (web-player login on tablet + OAuth refresh token).
- Spotify UX: **v1 = navigate the FK webview to the web player with a one-tap return button** (simplest working version); **v2 = custom in-dash drawer + Web Playback SDK (Goal S5)** so Spotify is managed in a modal over the dashboard without any page navigation — Tim explicitly wants this iteration in the plan. Standing UX principle (→ dashboard CLAUDE.md via Goal M): *kiosk interactions stay in-context — modals/drawers over the dashboard, never full-page navigations that lose context.*
- Voice reply: shown on **kiosk + stays in Telegram**.
- Send mechanism: **Telethon user session** on the old Mac (one-time code login, session chmod 600).
- Voice authz: **relay rails only** (rate limit, only-to-bot, audit log, Telegram-Devices kill switch) — no PIN, no IP allowlist.
- Tunnel host: **Tim's existing domain** → ⚠️ *Tim input needed at V0: domain name + current registrar.*
- STT: **Cloudflare Workers AI** `@cf/openai/whisper-large-v3-turbo` (AI binding on the Pages project; fallbacks `@cf/openai/whisper`, `whisper-tiny-en`).
- Recording UX: tap-to-start / tap-to-stop, 30s hard cap, no silence-VAD in v1. Transcript confirm screen with 5s auto-send countdown + Cancel/Re-record.
- Relay: Python + **aiohttp** (Telethon is asyncio-native; no ASGI stack), lives in the dashboard repo at `relay/` (precedent: `pi/`).
- Two voice endpoints (`/transcribe`, `/send`), single held fetch (≤25s) for the reply wait — no SSE (Workers have no wall-clock limit on I/O waits).

**Key reuse (existing code to mirror):**
- `app/functions/_lib/google-auth.js` — refresh-token → access-token with in-memory per-isolate cache → template for `spotify-auth.js`.
- `scripts/mint-google-token.mjs` — loopback OAuth mint script → template for `mint-spotify-token.mjs` (fixed port 8899; Spotify requires exact-match `http://127.0.0.1:<port>/callback`).
- `app/src/lib/home.js` — two-flag live/mock client (`VITE_DASHBOARD_TOKEN` + `VITE_*_LIVE`) → template for `lib/spotify.js`, `lib/voice.js`.
- `app/src/widgets/home.js` — `.overlay` scrim+panel pattern (global.css:222) → template for `voice-overlay.js`.
- `app/functions/_lib/auth.js` — `checkAuth`/`corsHeaders`; `scripts/bind-kv.mjs` → template for `bind-ai.mjs`; `scripts/set-cf-env-var.mjs` for env vars (or the `cf-pages-infra` skill).
- Mic handler to rewire: `app/src/views/morning-briefing.js:123-126`; music stub: `LAUNCH_STUBS` at `:35-39`, handler `:118-136`.

---

## Goals — Workstream S: Spotify

### S0 — Tablet smoke test (manual, gates ONLY the music-button navigation)
**Execution status (2026-07-10):** normal Fully Kiosk WebView UA returned
Spotify “unsupported.” Desktop Mode and Edge fake-UA retries are pending. If
both fail, S5 ships in Connect-controller mode without tablet-speaker playback.
**Objective:** Prove the Spotify web player plays audio inside Fully Kiosk's Android WebView (Widevine DRM).
**Steps:** FK settings → Web Content: **Enable Protected Content ON**, Autoplay Videos ON, cookies ON, no cache/cookie clearing on reload. Load `open.spotify.com`, log in (Tim's Premium), play a track. If UA-blocked, retry with desktop User Agent and record which worked. Kill FK + relaunch, then reboot tablet → verify login + playback persist. Note behavior navigating back to dashboard mid-playback (audio expected to stop). If FK supports tabs, test Spotify in a second tab.
**Acceptance:** on-demand playback from tablet speakers; login survives restart + reboot.
**If it fails:** music button falls back to `spotify://` intent (native app, leaves kiosk — degraded). S1–S3 ship unchanged either way (ticker works via Web API regardless of playback device).

### S1 — Spotify app registration + token mint
**Objective:** `SPOTIFY_CLIENT_ID/SECRET/REFRESH_TOKEN` live in CF Pages Production env (encrypted).
**Deliverables:** Spotify Developer app (Development mode fine — owner auto-authorized), redirect URI exactly `http://127.0.0.1:8899/callback`; `scripts/mint-spotify-token.mjs` (fixed port; auth URL `accounts.spotify.com/authorize`, token exchange with Basic auth; header documents the current six-month refresh-token lifetime); **mint with the full scope set up front so S5 needs no re-mint**: `user-read-playback-state`, `user-modify-playback-state`, `user-read-currently-playing`, plus `streaming`, `user-read-email`, `user-read-private`, `playlist-read-private`, `playlist-modify-public`, `playlist-modify-private`, `user-read-recently-played`, `user-library-read`; env vars set via `set-cf-env-var.mjs`; add to `.envrc.local`; `docs/spotify-setup.md` mirroring google-setup.
**Acceptance:** mint script completes consent flow, prints all three values, and self-verifies one refresh grant.

### S2 — CF Functions (player proxy)
**Objective:** Authenticated now-playing + control endpoints.
**Deliverables:**
- `app/functions/_lib/spotify-auth.js` — `getAccessToken(env)`, in-memory Map cache w/ 60s margin (google-auth.js shape); warn-log if a new refresh_token comes back.
- `app/functions/_lib/spotify-api.js` (+ `.test.js`) — `readPlayer(env)` → `GET /v1/me/player?additional_types=episode`; exported pure `normalizePlayer(json)`; `sendControl(env, action)` for play/pause/next. Normalized shape: `{ active, isPlaying, type, track:{title,artist,album,artUrl}, progressMs, durationMs, fetchedAt, device, shuffle, repeat }`; **204 → `{active:false}`** (not an error); null item → inactive; smallest art ≥128px.
- `app/functions/api/spotify/player.js` — GET (200 state / **501 unconfigured** — the mock-mode signal / 502 upstream; `cache-control: no-store`) and POST `{action}` (200 / 400 / **409 NO_ACTIVE_DEVICE** / 502; Spotify control returns empty body — don't parse JSON).
**Acceptance:** vitest green; deployed `curl -H "Authorization: Bearer $DASHBOARD_TOKEN" .../api/spotify/player` mirrors phone playback; POST pause pauses the phone.

### S3 — Frontend ticker, mock-first (shippable before S1–S2)
**Objective:** Working bottom ticker in mock mode with full harness coverage.
**Deliverables:**
- `app/src/lib/spotify-mock.js` — `playing` / `paused` / `inactive` fixtures incl. long-title overflow case.
- `app/src/lib/spotify.js` — `LIVE_MODE = TOKEN && VITE_SPOTIFY_LIVE==='1'`; **no localStorage cache** (stale now-playing worse than none): live `{initial:null, live:fetchPlayer()}`, mock always shows the bar; `controls` (live vs in-memory mock); `openSpotifyPlayer(navigate)` → `https://open.spotify.com/` (testable, telegram.js pattern); `isConfigured`.
- `app/src/widgets/spotify-ticker.js` — pure `renderSpotifyTicker(state)` + `mountSpotifyTicker(el,{getPlayer,controls})`. Hidden when `!active` + `body.has-spotify-ticker` class toggle. Album art, single-line ellipsized title/artist, thin progress bar, ≥3rem play/pause + next. **Polling: 10s playing / 60s idle; `visibilitychange` pauses timers; 1s local progress interpolation; poll immediately at track boundary; teardown fn.** 409 on control → toast "Nothing playing — tap ♪ to open Spotify".
- Wire `morning-briefing.js`: drop `music` from LAUNCH_STUBS; handler → `openSpotifyPlayer()` (or toast if unconfigured); ticker slot after `</main>`; CSS in global.css using theme tokens; `.has-spotify-ticker .briefing { padding-bottom: … }` so cards aren't occluded.
- Harness trio: `spotify-ticker.fixtures.js` (playing/paused/overflow/episode/inactive), `harness.js` WIDGETS entry, `app/tests/qa/spotify-ticker.spec.js` (geometry + tapTargets; inactive = hidden).
- Vitest: widget render/escaping/state icons; lib navigation target + mock shape.
**Acceptance:** `npm test` + QA gate green; `/harness.html?widget=spotify-ticker&state=playing&theme=fun&scale=0.6` correct; no-env local dev shows mock ticker.

### S4 — Live wiring, return affordance, FK config, E2E
**Objective:** Live on the wall.
**Deliverables:** `VITE_SPOTIFY_LIVE=1` + server vars verified, deploy via `scripts/ship.sh`. **Return affordance primary:** FK "Inject JavaScript" (PLUS) — on `open.spotify.com`, floating home button → `fully.loadStartUrl()` (fallback `location.href` to start URL); snippet lives in docs. **Fallback:** idle-return-to-start-URL — raise 60s → 300s (60s would kill tablet-speaker playback; document trade-off). Final FK settings list documented in `docs/tablet-kiosk-setup.md` §4.
**Acceptance (E2E on tablet):** (1) phone playback → ticker <10s, art/title/progress correct; (2) ticker pause/next controls phone <2s; (3) nothing playing → no ticker, no gap; (4) music button → web player plays from tablet speakers; (5) injected home button returns to dashboard, ticker reflects tablet playback; (6) overnight 04:00 self-reload doesn't wedge polling; (7) polling paused while FK screensaver on.

### S5 — v2: In-dash Spotify drawer + Web Playback SDK (the iteration target)
**Objective:** Replace the full-page web-player navigation with a drawer over the dashboard — browse, play, add to playlist without any page change; audio still from tablet speakers.
**Approach:** The Web API supplies data/actions (your playlists, search, queue, add-to-playlist); the **Web Playback SDK** makes the kiosk page itself a Spotify Connect device ("Dashboard") so audio plays from the tablet speakers. All UI is ours, on the existing `.overlay` pattern and theme tokens — kiosk-scoped: playlist grid, search, now-playing controls (play/pause/prev/next/volume/shuffle), add-to-playlist picker.
**Deliverables:**
- `app/functions/api/spotify/token.js` — returns a short-lived access token to the client for the SDK (`streaming` scope; guarded by `checkAuth`; document the exposure trade-off — same audience as the bundle token, personal app).
- Extend `_lib/spotify-api.js` + `api/spotify/` routes: playlists list, search, play-context/track on a device, queue, add-to-playlist, transfer playback.
- `app/src/lib/spotify-player.js` — SDK loader (`sdk.scdn.co/spotify-player.js`), device registration, token refresh callback, ready/not-ready + state-change events feeding the same normalized shape the ticker uses (SDK events replace polling while the kiosk is the active device).
- `app/src/widgets/spotify-drawer.js` (+ fixtures, tests, QA spec, harness entry) — drawer states: playlists / search / now-playing / add-to-playlist / SDK-unavailable.
- Music button → opens the drawer; remove the web-player navigation + injected FK return button (revert the S4 affordance docs).
**Acceptance:** tap ♪ → drawer over the dashboard; pick a playlist → audio from tablet speakers with no page navigation; search + add-to-playlist round-trips visible in the Spotify account; close drawer → dashboard exactly as left, ticker live; **DRM fallback verified** — if SDK/EME fails in the WebView, the same drawer targets other Connect devices (phone/speakers) and says so.
**Note:** SDK uses the same EME/Widevine as the web player, so S0's result predicts SDK viability. Ship S5 only after v1 has been lived with; it fully supersedes the S4 return-affordance machinery.

---

## Goals — Workstream V: Voice → Hermes

### V0 — Prerequisites (Tim + agent, ~30 min of Tim's time)
**Objective:** Unblock tunnel + confirm platform limits.
**Deliverables:** (a) **Tim provides domain name + registrar**; add zone to CF (nameserver change at registrar), verify `GET /zones` shows it active. (b) Confirm Workers plan tier (Free 10ms CPU vs Paid 30s) — sizes the transcribe path. (c) Confirm **FK PLUS license** on the tablet (mic access is a PLUS setting). (d) Tim mints `api_id`/`api_hash` at my.telegram.org (user-account API credential — password-manager it). (e) 5-min console probe on the deployed site from the tablet: `MediaRecorder` + `audio/webm;codecs=opus` support in the actual WebView.
**Acceptance:** zone active; plan tier known; PLUS confirmed; API creds stored; WebView probe passes.

### V1 — Frontend overlay, mock-first (no infra needed; shippable immediately)
**Objective:** Full voice UX working against mocks, end to end.
**Deliverables:**
- `app/src/lib/voice.js` — `isSupported()`; `createRecorder({getUserMedia, mediaRecorderCtor, audioContextCtor})` (injectable for happy-dom tests) → `{start, stop→Promise<Blob>, onLevel}`; webm/opus w/ mimeType fallback; AnalyserNode RMS ~10Hz for waveform; 30s hard stop; `transcribe(blob)`, `sendCommand(text)` with typed errors; `isConfigured`.
- `app/src/lib/voice-mock.js` — same surface, synthetic levels, canned transcript (~800ms) + canned reply (~2.5s); mock unless TOKEN set; `?voice=mock` URL override for on-tablet demos.
- `app/src/widgets/voice-overlay.js` — `openVoiceOverlay(voice)` on the `.overlay` chrome; pure `render(state)` + factory. States: **recording** (pulse + level bars, whole panel = stop target, Cancel) → **transcribing** → **confirm** (large transcript, 5s countdown ring on Send, tap-transcript pauses countdown, Cancel/Re-record/Send now; empty transcript → "Didn't catch that") → **sending** (up to ~25s, elapsed dots) → **reply** (Hermes bubble, auto-dismiss 20s) | **sent** ("Sent ✓ — reply will land in Telegram", 6s) | **error** (mapped copy per failure; all offer the Telegram fallback where sensible).
- Rewire `morning-briefing.js:123-126`: tap → overlay if supported, else toast + `openHermesChat()`; **long-press (~600ms) → `openHermesChat()`** kept as documented fallback. `lib/telegram.js` header comment updated (now the fallback path).
- CSS (`.voice-overlay`, `.voice-level`, `.voice-transcript`, `.voice-reply`, `.voice-countdown`; ≥44px targets); harness trio (`voice-overlay.fixtures.js` — 11 states incl. error-mic/error-relay, harness WIDGETS entry, `app/tests/qa/voice-overlay.spec.js`); vitest for lib + every widget transition.
**Acceptance:** `npm test` + `npm run qa:gate` green; deployed with `?voice=mock`, full flow walks offline on the tablet; long-press still opens Telegram.

### V2 — Live STT (transcribe endpoint + AI binding)
**Objective:** Real transcription of kiosk-recorded audio.
**Deliverables:** `scripts/bind-ai.mjs` (clone bind-kv.mjs; additive PATCH `ai_bindings:{AI:{}}` into production+preview, read-back check that KV bindings/env survive); `app/functions/_lib/voice-api.js` (+test) — model-id const w/ fallback chain, size validation, **chunked base64 (8KB chunks)**; `app/functions/api/voice/transcribe.js` — POST raw `audio/webm` body (not multipart), `checkAuth`+CORS, >1MB → 413, empty → 400, `env.AI` unbound → 500, `env.AI.run(model, {audio: b64})` → `{transcript}` (empty transcript is a 200, client handles).
**Acceptance:** speaking "add paper towels to the grocery list" **on the tablet** returns that transcript in the overlay; 413/401 guards verified; **webm/opus acceptance by the model confirmed with a real tablet MediaRecorder blob** — run this risk-retiring test before any polish. If opus is rejected: fallback models, worst case client-side WAV encoding (only if forced).

### V3 — Relay service on the old Mac (parallel to V2)
**Objective:** Localhost-verified Telegram round trip as Tim.
**Deliverables:** `relay/relay.py` (Python 3.11, Telethon + aiohttp, bound **127.0.0.1:8787 only**):
- `POST /command` `{"text": 1..1000 chars}` + `X-Relay-Secret` (constant-time compare) → `{"status":"replied","reply",elapsedMs}` | `{"status":"sent","reply":null}` (bot quiet past cap — not an error) | 400/401/429/503.
- **Reply collection:** transient `events.NewMessage(from_users=BOT)` handler; collect until **2s quiescence or 20s cap**; join with `\n\n` (handles Hermes interim messages).
- **Rails:** peer resolved once at startup — can ONLY message `@mootsfambot`; token-bucket 6/min burst 3; asyncio lock (one conversation in flight); one audit line per command to stdout (never the secret).
- `GET /healthz` (no secret) → `{"ok",connected}`.
- Config `~/.hermes-relay/.env` chmod 600 (`TG_API_ID`, `TG_API_HASH`, `RELAY_SECRET`, `RELAY_PORT`, `BOT_USERNAME`, `SESSION_PATH`); `relay/README.md` login runbook (venv install; `relay.py --login` → phone → code → **2FA password handled** via `SessionPasswordNeededError`; session chmod 600; revocation = Telegram → Devices → terminate); security notes (session+api_hash = account takeover if exfiltrated; FileVault, `.gitignore` `*.session*`/`.env`); `relay/ai.hermes.relay.plist` (RunAtLoad+KeepAlive, logs → `~/.hermes-relay/logs/relay.log`, mirrors `ai.hermes.gateway`); `relay/deploy.sh` (scp + `launchctl bootstrap`); `relay/test_relay.py` (pytest: auth compare, rate limiter, quiescence collector w/ fake events); `relay/smoke.sh` (healthz + ONE "ping" — README warns it messages the real bot; never in CI).
**Acceptance:** local curl `/command` "ping" → message appears in the real Telegram thread, Hermes answers, curl returns `replied` with the answer; wrong secret → 401; 7 rapid → 429; `launchctl kickstart -k` clean; survives reboot + FileVault unlock + login; **session still authorized after 48h** (Telegram sometimes kills fresh "suspicious" sessions — verify before calling done).

### V4 — Cloudflare Tunnel + send endpoint (full path live)
**Objective:** Kiosk → Hermes round trip through CF.
**Deliverables:** cloudflared on old Mac (`brew install`, `tunnel login` against the new zone, `tunnel create hermes-relay`, config → `relay.<domain>` → `http://127.0.0.1:8787`, `tunnel route dns`, `sudo cloudflared service install` — LaunchDaemon, up pre-login); `relay/cloudflared-config.example.yml`; `app/functions/api/voice/send.js` — POST `{text}` 1..1000, `checkAuth`, held `fetch(RELAY_URL+'/command')` w/ `AbortSignal.timeout(25000)`, pass-through 200s, map relay/tunnel failures → 502 "relay unreachable", timeout → 504, 429 pass-through; env vars `RELAY_URL` + `RELAY_SECRET` (no VITE_ prefix — never in bundle) via `set-cf-env-var.mjs`; wire `lib/voice.js` live; deploy.
**Acceptance:** off-LAN `curl https://relay.<domain>/healthz` OK; spoken "what's on the calendar today" on the tablet shows Hermes's real answer in the overlay AND in the Telegram thread; a deliberately slow prompt returns the `sent`-timeout UX with the reply arriving in Telegram later.

### V5 — Kiosk config, docs, failure drills, ship
**Objective:** Production hardening + documentation truth.
**Deliverables:** Android mic permission for FK + FK **Enable Microphone Access (PLUS)** ON; keep "Open URL Schemes in Other Apps" ON (long-press fallback); `docs/tablet-kiosk-setup.md` §2 rewrite; new `docs/voice-command-flow.md` (architecture, secret/env inventory, runbooks: session revocation, tunnel rotation, relay logs); `followups.md` entries (silence auto-stop VAD, Cloudflare Access hardening, Caroline's voice); ship.
**Acceptance:** failure drills each produce their designed UX (no blank overlay, no stuck spinner): relay down → 502 copy; tunnel down → 502 copy; STT garbage → countdown-paused confirm + Re-record; Hermes slow → sent-timeout copy; mic revoked → error-mic copy + fallback; double-tap mic → single overlay.

---

## Goal M — Meta
- Append to `~/.claude/llm-context/developer.md` (Engineering defaults): standing directive — *all plans structure work as well-defined goals (objective / deliverables / acceptance criteria) for downstream agent execution.*
- Append to `smart-home-dashboard/CLAUDE.md`: standing UX principle — *kiosk interactions stay in-context: modals/drawers over the dashboard, never full-page navigations that lose context. (Full-page views are acceptable only as an explicit v1 stepping stone with an iteration goal on the books — e.g., Spotify v1 → S5.)*
- Update `smart-home-dashboard/spec.md` + `todo.md` with both integrations; keep todo.md checked off as goals complete.

## Sequencing & parallelism
- **S0 and V0 first** (both are cheap gates; S0 is Tim-on-tablet, V0 needs Tim's domain + telegram creds).
- S3 and V1 (mock-first frontends) are immediately buildable with zero external dependencies — start here while prerequisites resolve.
- S1→S2 and V2, V3 can all proceed in parallel; V4 needs V0 (zone) + V3.
- Each goal is a separate commit/ship via `scripts/ship.sh`.

## Files to create (summary)
- **Spotify:** `scripts/mint-spotify-token.mjs`; `app/functions/_lib/spotify-auth.js`, `spotify-api.js` (+test); `app/functions/api/spotify/player.js`; `app/src/lib/spotify-mock.js`, `spotify.js` (+test); `app/src/widgets/spotify-ticker.js` (+test, fixtures); `app/tests/qa/spotify-ticker.spec.js`; `docs/spotify-setup.md`.
- **Voice:** `app/src/lib/voice.js`, `voice-mock.js` (+test); `app/src/widgets/voice-overlay.js` (+test, fixtures); `app/tests/qa/voice-overlay.spec.js`; `app/functions/api/voice/transcribe.js`, `send.js`; `app/functions/_lib/voice-api.js` (+test); `scripts/bind-ai.mjs`; `relay/{relay.py, requirements.txt, README.md, ai.hermes.relay.plist, cloudflared-config.example.yml, deploy.sh, smoke.sh, test_relay.py, .gitignore}`; `docs/voice-command-flow.md`.
- **Modify:** `app/src/views/morning-briefing.js`, `app/src/harness/harness.js`, `app/src/styles/global.css`, `app/src/lib/telegram.js` (comment), `docs/tablet-kiosk-setup.md`, `app/.env.example`, `spec.md`, `todo.md`, `followups.md`.
- **Zero changes** to `hermes-setup/` or live `~/.hermes/`.

## Risks
| Risk | Mitigation |
|---|---|
| Spotify web player UA-blocks or Widevine fails in FK WebView (S0) | Desktop UA retry → `spotify://` intent fallback; ticker unaffected |
| Idle-return kills tablet-speaker playback | Raise 60s→300s at S4; FK tabs (if supported) may dissolve it — test in S0 |
| FK PLUS license unconfirmed (JS injection + mic access are PLUS) | Verify at S0/V0; ~€8 one-time if missing |
| webm/opus rejection by Workers AI whisper | Risk-retiring test first thing in V2; model fallback chain; WAV worst case |
| CF Free plan 10ms CPU vs base64 of ≤1MB audio | Confirm tier at V0; cap recordings ~20s or $5/mo Paid if it trips |
| Telethon session = full account credential | chmod 600 + FileVault + gitignore; Telegram Devices kill switch; verify session survives 48h |
| Hermes interim messages fragment the reply | Quiescence-window collection (2s quiet / 20s cap); verify with a real multi-message reply in V3 |
| Bundle token can trigger voice-send | Accepted posture: relay rails (6/min, only-to-bot, audit log) + Hermes approval mode as backstop |
| Spotify refresh-token rotation (rare) | Warn-log in spotify-auth.js; re-mint is 2 min |

## Verification (end-to-end)
1. `cd app && npm test` and `npm run qa:gate` green at every goal.
2. Harness renders every new fixture state at device viewports (`spotify-ticker`, `voice-overlay`).
3. S4 acceptance list (7 checks) on the wall tablet.
4. V3/V4 acceptance: relay curl round trip, then spoken command → kiosk reply + Telegram thread parity.
5. V5 failure drills (6 scenarios) each produce designed UX.
6. Grocery-add spoken command lands in Google Tasks via Hermes and appears on the dashboard within task-cache TTL — the full-loop proof.

---

## Summary — goals, acceptance criteria, success metrics

**Goals at a glance:**
- **S0** FK DRM smoke test → gates music-button navigation only (and predicts S5 SDK viability)
- **S1** Spotify app + refresh-token mint (full scope set incl. S5's) → 3 env vars live
- **S2** CF player proxy (GET state / POST controls)
- **S3** Mock-first bottom ticker + music-button navigation wiring
- **S4** Live wiring + return affordance + FK config + on-wall E2E — **v1 done here**
- **S5** v2 iteration: in-dash Spotify drawer + Web Playback SDK (no page navigation; supersedes S4's return affordance)
- **V0** Prereqs: Tim's domain → CF zone; plan tier; FK PLUS; telegram api creds; WebView probe
- **V1** Mock-first voice overlay (record → transcript → countdown → send → reply) + long-press Telegram fallback
- **V2** Workers AI Whisper transcribe endpoint + AI binding (opus test first)
- **V3** Telethon relay on old Mac w/ rails + quiescence reply collection + launchd
- **V4** Cloudflare Tunnel + `/api/voice/send` → full round trip
- **V5** FK mic config, docs, failure drills, ship
- **M** developer.md directive + spec.md/todo.md updates

**Acceptance criteria (the bar for "done"):**
- Music v1: tap ♪ → full Spotify in-kiosk, plays from tablet speakers, one-tap return to dashboard; ticker appears <10s after playback starts anywhere, controls work, hidden when idle.
- Music v2 (S5): tap ♪ → drawer over the dashboard — browse/play/add-to-playlist with zero page navigation, audio from tablet speakers, dashboard context intact on close.
- Voice: tap mic → speak → transcript confirm → Hermes's real reply on the kiosk in ≤25s (or graceful "reply in Telegram" on slow runs); thread intact in Telegram; Tim never leaves Fully Kiosk.
- All vitest + QA-gate suites green; every failure mode has designed copy, not a spinner.

**Success metrics:**
- Zero kiosk exits for either flow in daily use.
- Voice command → Hermes round trip ≤25s p90; transcription accurate enough that Re-record is the exception.
- Ticker state matches reality (no stale track) and survives the nightly 04:00 reload.
- Zero changes to Hermes; Telegram thread remains the single system of record.
