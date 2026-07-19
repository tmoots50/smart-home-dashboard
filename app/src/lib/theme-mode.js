// Light/dark theme control for the wall kiosk. Two behaviours, one brain:
//
//   1. AUTO — the dash follows the sun. `fun` (warm light) between sunrise and
//      sunset for our ZIP (30324, Atlanta), `cosy` (warm dark) overnight. Sun
//      times are computed locally (lib/suntimes.js), so no network is needed.
//
//   2. MANUAL — the action-bar toggle flips light↔dark on demand. A tap writes
//      an override that WINS over auto, but only until the next sun event
//      (sunrise or sunset), at which point auto resumes. This lets Tim force a
//      mode now ("make it dark for movie night") without permanently disabling
//      the automatic schedule — the override always expires into the auto value
//      at the next boundary, so there's never a jarring flip.
//
// Precedence: URL ?theme= (dev preview, NON-kiosk only) > manual override
// (until it expires) > auto. In production the kiosk always loads with
// ?kiosk=1, so a pinned ?theme= in the start URL is intentionally ignored —
// the toggle + auto own the theme and Tim never edits the URL.

import { sunrise, sunset, isDaytime } from './suntimes.js';

const DAY_THEME = 'fun';   // warm light
const NIGHT_THEME = 'cosy'; // warm dark

// ZIP 30324 (Morningside / NE Atlanta). Sun times here differ from downtown by
// seconds — fine for a theme switch.
const COORDS = { lat: 33.82, lon: -84.35 };

const OVERRIDE_KEY = 'theme:override'; // localStorage: { theme, until } (until = epoch ms)

// Which theme should auto show at `now`? Day when the sun is above the horizon.
export function autoTheme(now = new Date(), coords = COORDS) {
  return isDaytime(now, coords.lat, coords.lon) ? DAY_THEME : NIGHT_THEME;
}

// The next sunrise/sunset strictly after `now` — the moment a manual override
// should expire back into auto. Gathers the events around `now` (yesterday →
// tomorrow) and picks the soonest still in the future; robust across the
// midnight-UTC boundary where a single day's sunset can land past 00:00 UTC.
export function nextSunEvent(now = new Date(), coords = COORDS) {
  const events = [];
  for (const offset of [-1, 0, 1]) {
    const day = new Date(now.getTime() + offset * 86_400_000);
    for (const at of [sunrise(day, coords.lat, coords.lon), sunset(day, coords.lat, coords.lon)]) {
      if (at) events.push(at);
    }
  }
  const future = events.filter(t => t.getTime() > now.getTime()).sort((a, b) => a - b);
  return future[0] ?? new Date(now.getTime() + 8 * 3_600_000); // polar fallback
}

function readOverride() {
  try {
    const o = JSON.parse(localStorage.getItem(OVERRIDE_KEY));
    if (typeof o?.theme === 'string' && typeof o?.until === 'number') return o;
  } catch { /* corrupt / unavailable → no override */ }
  return null;
}
function writeOverride(o) { try { localStorage.setItem(OVERRIDE_KEY, JSON.stringify(o)); } catch {} }
function clearOverride() { try { localStorage.removeItem(OVERRIDE_KEY); } catch {} }

// The theme to display right now. Expires a stale override as a side effect so
// auto silently resumes at the next sun event.
export function resolveTheme(now = new Date()) {
  const params = new URLSearchParams(window.location.search);
  const urlTheme = params.get('theme');
  if (urlTheme && !params.has('kiosk')) return urlTheme; // dev preview only

  const ov = readOverride();
  if (ov) {
    if (now.getTime() < ov.until) return ov.theme;
    clearOverride();
  }
  return autoTheme(now);
}

export function isDark(now = new Date()) {
  return resolveTheme(now) === NIGHT_THEME;
}

// Apply the resolved theme to <html>. Dispatches `themechanged` only when the
// value actually changes, so listeners (e.g. the toggle icon) stay in sync
// through both auto transitions and overrides.
export function applyTheme() {
  const theme = resolveTheme(new Date());
  if (document.documentElement.dataset.theme !== theme) {
    document.documentElement.dataset.theme = theme;
    document.dispatchEvent(new CustomEvent('themechanged', { detail: { theme } }));
  }
}

// Flip light↔dark from whatever is showing now, set an override that expires at
// the next sun event, apply immediately, and return the new theme.
export function toggleTheme(now = new Date()) {
  const current = document.documentElement.dataset.theme === NIGHT_THEME ? NIGHT_THEME : DAY_THEME;
  const next = current === NIGHT_THEME ? DAY_THEME : NIGHT_THEME;
  writeOverride({ theme: next, until: nextSunEvent(now).getTime() });
  applyTheme();
  return next;
}
