# Tablet (Fully Kiosk) setup — scroll, mic → Hermes, and friends

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

## 2. Mic button → voice note to Hermes (Telegram)

The mic action button deep-links into the Telegram app on the @mootsfambot
chat. Hold Telegram's mic to record; Hermes transcribes voice notes
server-side (Whisper STT is enabled), so a voice note is just a message.

One-time on the tablet:

1. **Install Telegram** from the Play Store.
2. **Sign in as Tim** (multi-device session — approve the login code from your
   phone's Telegram). Hermes ignores senders it doesn't know, so the tablet
   must be one of the allowed accounts (Tim or Caroline).
3. Open the **@mootsfambot** chat once so it's in the chat list.
4. In Fully Kiosk: **Web Content Settings → Open URL Schemes in Other Apps**
   (sometimes "Open URLs in Other Apps") → ON. This lets the `tg://` link
   launch the Telegram app.
5. Optional but recommended: **Device Management → Return to Start URL after
   Idle** (e.g. 60s), so the tablet drifts back to the dashboard after you
   send the voice note. (The FK home/back gesture works immediately too.)

Test: tap the mic on the dashboard → Telegram opens on the Hermes chat →
hold mic, say "add paper towels to groceries", release → within ~5 min the
item appears on the dashboard (task cache TTL).

## 3. Nothing else changed on the tablet

Start URL stays the same (`…pages.dev/?kiosk=1&…`). New features (undo toasts,
inline add, calendar overlay, Home card) are all in-page.
