import { renderMorningBriefing } from './views/morning-briefing.js';

const params = new URLSearchParams(window.location.search);

// Pi kiosk launcher will hit /?kiosk=1 — that flag locks scrolling and any
// other dev-only affordances out of the wall view.
if (params.has('kiosk')) {
  document.documentElement.classList.add('kiosk');
}

// ?theme=fun swaps the editorial dark theme for the warm light variant.
const theme = params.get('theme');
if (theme) document.documentElement.dataset.theme = theme;

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
