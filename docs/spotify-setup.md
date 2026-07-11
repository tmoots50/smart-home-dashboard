# Spotify setup — ticker, drawer, and dashboard playback

The dashboard uses one personal Spotify Premium account in two ways:

- Cloudflare Functions call the Web API for now-playing, controls, playlists,
  search, queueing, and playlist updates.
- The browser receives a short-lived access token only when the in-dashboard
  Web Playback SDK starts. That makes the kiosk a Spotify Connect device named
  **Dashboard**, so sound can come from the tablet without leaving the page.

The refresh token and client secret never enter the bundle. The short-lived SDK
token does; this is an accepted trade-off for this personal kiosk and has the
same audience as `VITE_DASHBOARD_TOKEN`.

## 1. Prove the tablet can play protected audio

In Fully Kiosk, enable **Protected Content**, cookies, and autoplay, then load
`https://open.spotify.com/`, sign in, and play a track. Restart Fully Kiosk and
reboot Android; confirm the login persists. If the normal user agent is blocked,
try Fully Kiosk's desktop user agent.

This is the cheapest risk test. The web player and Web Playback SDK both rely
on Android WebView's EME/Widevine path. If it fails, the drawer still works as
a controller for phones and Spotify Connect speakers.

## 2. Create the Spotify app

1. Open the Spotify Developer Dashboard and create an app named `Dashboard`.
2. Add Tim's Spotify account as an authorized user if the app is in Development
   mode (the owner is normally authorized already).
3. Register this redirect URI exactly—host, port, path, and `http` all matter:

   `http://127.0.0.1:8899/callback`

4. Copy the Client ID and Client Secret into the password manager.

Spotify playback through the SDK requires Premium.

## 3. Mint the long-lived refresh token

From the repository root:

```bash
node scripts/mint-spotify-token.mjs
```

The script opens consent, requests the complete v1+v2 scope set, receives the
callback on fixed port 8899, and verifies a refresh grant before printing:

```text
SPOTIFY_CLIENT_ID=…
SPOTIFY_CLIENT_SECRET=…
SPOTIFY_REFRESH_TOKEN=…
```

Put those values in `.envrc.local`; do not commit or paste them into chat.
Spotify refresh tokens do not have Google's seven-day testing-mode expiry, but
Spotify now gives Developer Dashboard app tokens a six-month lifetime. Record
the authorization date and re-run the mint before expiry. The scope set includes
the SDK-required `streaming`, `user-read-email`, and `user-read-private` scopes.

## 4. Add Cloudflare variables and deploy

With the existing Cloudflare values loaded from `.envrc.local`:

```bash
source .envrc.local
node scripts/set-cf-env-var.mjs SPOTIFY_CLIENT_ID "$SPOTIFY_CLIENT_ID"
node scripts/set-cf-env-var.mjs SPOTIFY_CLIENT_SECRET "$SPOTIFY_CLIENT_SECRET" --secret
node scripts/set-cf-env-var.mjs SPOTIFY_REFRESH_TOKEN "$SPOTIFY_REFRESH_TOKEN" --secret
node scripts/set-cf-env-var.mjs VITE_SPOTIFY_LIVE 1
```

`--secret` stores the client secret and refresh token as encrypted Pages
variables. The helper preserves all existing variables and both environments.

Redeploy after changing variables. Verify:

```bash
curl -H "Authorization: Bearer $DASHBOARD_TOKEN" \
  https://smart-home-dashboard-de0.pages.dev/api/spotify/player
```

A phone playing Spotify should appear within ten seconds. A 204 from Spotify
normalizes to `{ "active": false }`; it is not an outage.

## 5. On-wall acceptance

1. Start playback on a phone: ticker appears within 10 seconds with correct art,
   title, artist, and progress.
2. Pause and Next work from the ticker in under two seconds.
3. Stop playback: ticker disappears without leaving a bottom gap.
4. Tap ♪: the drawer opens over the untouched dashboard.
5. Pick a playlist: **Dashboard** becomes the active device and tablet audio
   begins. Search, queue, and add-to-playlist round-trip to the account.
6. Close the drawer: scroll position and dashboard context remain intact.
7. Turn off protected content and repeat: the drawer explains dashboard audio
   is unavailable but continues controlling the phone/speaker.
8. Let the screen sleep and wake: polling resumes immediately; the nightly 04:00
   reload also returns to a live state.

If the SDK cannot play after the web-player smoke test succeeds, inspect Fully
Kiosk's WebView version and Spotify account eligibility before changing code.

## 6. Six-month reauthorization

Spotify's current token policy does not extend the refresh-token lifetime when
the server refreshes hourly. Before six months elapse, re-run the mint, replace
`SPOTIFY_REFRESH_TOKEN`, and redeploy. An `invalid_grant` response means the
token is expired/revoked and the consent flow must run again; retrying cannot
repair it. If Spotify returns a different refresh token during an ordinary
refresh, `spotify-auth.js` logs a warning so it can be stored promptly.
