import { renderMorningBriefing } from './views/morning-briefing.js';
import { applyTheme } from './lib/theme-mode.js';

const params = new URLSearchParams(window.location.search);

// Pi kiosk launcher will hit /?kiosk=1 — that flag locks scrolling and any
// other dev-only affordances out of the wall view.
if (params.has('kiosk')) {
  document.documentElement.classList.add('kiosk');
}

// Time-of-day theme: `light` during the day, `cosy` after sunset (sunrise/sunset
// come from the weather cache). `?theme=` URL param forces a specific theme for
// previews. Re-evaluated every 5 minutes so a long-running kiosk crosses sunset
// cleanly without a reload.
applyTheme();
setInterval(applyTheme, 5 * 60 * 1000);

// ?scale=0.6 shrinks the whole UI proportionally. Needed for tablets where
// the CSS viewport is small but the physical screen is large (MESWAO B3 etc.).
// Every rem-based dimension scales together since this multiplies the root font.
const scale = parseFloat(params.get('scale'));
if (scale > 0 && scale < 4) {
  document.documentElement.style.fontSize = `${scale * 16}px`;
}

const root = document.querySelector('#app');
renderMorningBriefing(root);

document.addEventListener('pointerdown', () => {
  if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}, true);

// Nightly self-reload at 04:00 local. Clears any accumulated state / leak; runs
// while the screen is asleep so it's invisible to the user.
(function scheduleNightlyReload() {
  const now = new Date();
  const next = new Date();
  next.setHours(4, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  setTimeout(() => window.location.reload(), next - now);
})();
