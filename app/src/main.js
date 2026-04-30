import { renderMorningBriefing } from './views/morning-briefing.js';
import { mountPhotoBackground } from './widgets/photo.js';
import { getMockPhotos } from './lib/photos-mock.js';

// Pi kiosk launcher will hit /?kiosk=1 — that flag locks scrolling and any
// other dev-only affordances out of the wall view.
if (new URLSearchParams(window.location.search).has('kiosk')) {
  document.documentElement.classList.add('kiosk');
}

const bgHost = document.createElement('div');
document.body.prepend(bgHost);
mountPhotoBackground(bgHost, getMockPhotos());

const root = document.querySelector('#app');
renderMorningBriefing(root);
