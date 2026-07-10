import { renderMorningBriefing } from './views/morning-briefing.js';
import { applyTheme } from './lib/theme-mode.js';

const params = new URLSearchParams(window.location.search);

// Pi kiosk launcher will hit /?kiosk=1 — that flag locks scrolling and any
// other dev-only affordances out of the wall view.
if (params.has('kiosk')) {
  document.documentElement.classList.add('kiosk');
}

// Household schedule: `light` from 07:00–22:59, `cosy` from 23:00–06:59.
// `?theme=` forces a preview. Re-evaluate every five minutes so the always-on
// kiosk crosses both boundaries without a reload.
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

// ?probe=1 overlays the device's real viewport numbers so the QA harness's
// device profiles (app/tests/qa/devices.js) can be grounded in what the wall
// tablet actually reports, not a guess. Load the deployed URL with &probe=1 on
// the tablet, copy the numbers into devices.js, drop the param. Renders
// nothing unless explicitly requested, so it's safe to leave in production.
if (params.has('probe')) {
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;top:12px;left:12px;z-index:9999;background:rgba(0,0,0,.85);' +
    'color:#7CFC00;font:14px/1.7 ui-monospace,monospace;padding:12px 16px;' +
    'border-radius:8px;white-space:pre;pointer-events:none;';
  const update = () => {
    const dpr = window.devicePixelRatio;
    el.textContent = [
      `viewport  ${window.innerWidth} × ${window.innerHeight} css px`,
      `dpr       ${dpr}`,
      `physical  ${Math.round(window.innerWidth * dpr)} × ${Math.round(window.innerHeight * dpr)} px`,
      `?scale=   ${params.get('scale') ?? '(none)'} → root ${getComputedStyle(document.documentElement).fontSize}`,
      `screen    ${window.screen.width} × ${window.screen.height}`,
      `ua        ${navigator.userAgent.slice(0, 64)}`,
    ].join('\n');
  };
  update();
  window.addEventListener('resize', update);
  document.body.appendChild(el);
}

// Nightly self-reload at 04:00 local. Clears any accumulated state / leak; runs
// while the screen is asleep so it's invisible to the user.
(function scheduleNightlyReload() {
  const now = new Date();
  const next = new Date();
  next.setHours(4, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  setTimeout(() => window.location.reload(), next - now);
})();
