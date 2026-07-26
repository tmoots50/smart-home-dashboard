// Sun-based theme switcher: `light` (dark mode OFF) during daylight — from
// sunrise through sunset — and `cosy` (warm dark, dark mode ON) after sunset
// until the next sunrise. Sunrise/sunset are computed locally and offline by
// lib/solar.js (deterministic, no network), so the always-on kiosk tracks the
// real seasonal day/night boundary without a cron job or a fragile dependency
// on async weather data.
//
// The URL param `?theme=...` always wins so Tim can force a theme for QA.

import { isDaytime } from './solar.js';

const DAY_THEME = 'light'; // dark mode OFF
const NIGHT_THEME = 'cosy'; // dark mode ON

// Home coordinates (Atlanta, GA) — mirrors views/morning-briefing.js DEFAULT_LOC.
// Overridable at runtime via ?lat=…&lon=… so a preview/QA run can simulate any
// location's daylight window.
export const DEFAULT_COORDS = { lat: 33.7490, lon: -84.3880 };

/**
 * Pick the theme for instant `now` at the given coordinates.
 *
 * Daytime (sunrise ≤ now < sunset) → light (dark OFF).
 * Otherwise (after sunset until the next sunrise) → cosy (dark ON).
 *
 * @param {Date} now
 * @param {{lat?: number, lon?: number, sun?: {sunrise: string|Date, sunset: string|Date}}} [opts]
 *        Optional coordinate override and/or a precomputed sun pair (e.g. from
 *        the weather API), forwarded to lib/solar.js. Defaults to home coords.
 */
export function pickTheme(now, opts = {}) {
  const safeOpts = opts ?? {};
  const lat = safeOpts.lat ?? DEFAULT_COORDS.lat;
  const lon = safeOpts.lon ?? DEFAULT_COORDS.lon;
  return isDaytime(now, { lat, lon, sun: safeOpts.sun }) ? DAY_THEME : NIGHT_THEME;
}

export function applyTheme() {
  const params = new URLSearchParams(window.location.search);
  const override = params.get('theme');
  // ?lat/?lon let a preview simulate daylight at another location; they mirror
  // the same params morning-briefing.js reads for weather.
  const lat = parseFloat(params.get('lat'));
  const lon = parseFloat(params.get('lon'));
  const coords = {
    lat: Number.isFinite(lat) ? lat : DEFAULT_COORDS.lat,
    lon: Number.isFinite(lon) ? lon : DEFAULT_COORDS.lon,
  };
  const theme = override || pickTheme(new Date(), coords);
  document.documentElement.dataset.theme = theme;
}
