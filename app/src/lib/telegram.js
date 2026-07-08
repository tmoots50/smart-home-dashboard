// Voice path to Hermes: the mic button deep-links into the Telegram app on
// the tablet, opening the @mootsfambot chat, where holding the mic records a
// voice note. Hermes has server-side STT (Whisper), so a voice note IS a
// message to the agent — no dashboard-side audio plumbing needed.
//
// Requirements on the tablet (one-time, documented in docs/install.md):
//   1. Telegram installed + signed in as Tim (Hermes ignores unknown senders).
//   2. Fully Kiosk → Web Content Settings → "Open URL Schemes in Other Apps".
//
// tg:// only — no https://t.me fallback on purpose. In a kiosk browser the
// universal link would navigate the DASHBOARD tab to Telegram Web and take
// the wall display down with it; a silently-ignored tg:// is the safer miss.

export const HERMES_BOT = 'mootsfambot';
export const hermesChatUrl = `tg://resolve?domain=${HERMES_BOT}`;

export function openHermesChat(navigate = defaultNavigate) {
  navigate(hermesChatUrl);
}

function defaultNavigate(url) {
  window.location.href = url;
}
