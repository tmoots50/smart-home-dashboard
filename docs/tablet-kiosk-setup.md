# Tablet (Fully Kiosk) setup — dashboard, voice, and Spotify

One-time setup on the Meswao tablet for the 2026-07 UX refresh. Settings names
are from Fully Kiosk Browser ~1.57; minor naming drift between versions is
normal — look for the closest match.

## 1. Touch scrolling (required)

The dashboard now scrolls by touch (the CSS `overflow: hidden` kiosk rule was
retired 2026-07-07). If the page still won't scroll on the tablet, Fully Kiosk
is blocking it at the app level:

1. Open Fully Kiosk settings (default gesture: tap the screen 5×, or swipe in
   from the left edge; enter the FK PIN).
2. **Web Content Settings** → make sure **Enable Scrolling** / touch drag is ON
   (and "Disable Overscroll" can stay on — the page sets its own
   `overscroll-behavior` so there's no pull-to-refresh bounce).
3. While you're there, confirm **Swipe to Refresh** is OFF (the dashboard
   refreshes itself; an accidental pull-refresh just flashes the screen).

## 2. In-dashboard voice → Hermes

Tap the mic to record without leaving the dashboard. The kiosk shows the
transcript, waits five seconds for confirmation, sends through the local relay,
and shows Hermes's reply. The exchange also stays in the real Telegram thread.
A ~600ms long-press keeps Telegram as the deliberate fallback.

One-time on the tablet:

1. Android Settings → Apps → Fully Kiosk → Permissions → **Microphone: Allow**.
2. Fully Kiosk → Web Content Settings → **Enable Microphone Access: ON**. This
   is a PLUS feature; confirm the PLUS license is active.
3. Load the dashboard with `?voice=mock`, tap the mic, and walk through every
   state without infrastructure. Then remove that query parameter for live use.
4. Install Telegram from the Play Store for the long-press/error fallback.
5. **Sign in as Tim** (multi-device session — approve the login code from your
   phone's Telegram). Hermes ignores senders it doesn't know, so the tablet
   must be one of the allowed accounts (Tim or Caroline).
6. Open the **@mootsfambot** chat once so it's in the chat list.
7. In Fully Kiosk: **Web Content Settings → Open URL Schemes in Other Apps**
   (sometimes "Open URLs in Other Apps") → ON. This lets the `tg://` link
   launch the Telegram app.
8. In the real WebView console, verify `MediaRecorder` exists and
   `MediaRecorder.isTypeSupported('audio/webm;codecs=opus')` returns true.

Test: tap mic → say “add paper towels to groceries” → stop → confirm transcript
→ Hermes reply appears on the kiosk and the command/reply appear in Telegram.
Long-press mic separately and confirm Telegram opens.

## 3. Screen and lifecycle settings

- Keep the nightly dashboard reload and Fully Kiosk screensaver enabled.
- Do not clear cookies/storage on reload; Spotify login and kiosk preferences
  need to survive process restarts and reboots.
- Keep **Autoplay Videos** on. Voice polling and Spotify polling pause while the
  document is hidden and refresh immediately when it returns.

## 4. Spotify playback

1. Fully Kiosk → Web Content Settings → **Enable Protected Content: ON**.
2. Enable autoplay and cookies; disable cookie/cache clearing on reload.
3. Load `https://open.spotify.com`, sign in to Tim's Premium account, and play a
   track through tablet speakers. If Spotify rejects the normal WebView user
   agent, retry with Fully Kiosk's desktop user agent.
4. Kill/relaunch Fully Kiosk, then reboot Android. Confirm the Spotify login and
   playback capability survive both.
5. Return to the dashboard and tap ♪. The final experience is the in-dashboard
   drawer; no JavaScript injection or full-page return button is needed.
6. If protected playback fails, the same drawer remains useful in Connect-device
   mode and targets the phone/speakers. A native `spotify://` launch is the last
   resort because it leaves kiosk context.

Do not use a 60-second idle-return timer: it can kill tablet-speaker playback.
If an idle return is still desired for external-app fallbacks, use at least 300
seconds and explicitly test the trade-off.

## 5. Start URL

Start URL stays the same (`…pages.dev/?kiosk=1&…`). New features (undo toasts,
inline add, calendar overlay, Home card, voice, Spotify) are all in-page.
