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

const root = document.querySelector('#app');
renderMorningBriefing(root);
