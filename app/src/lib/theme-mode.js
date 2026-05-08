// Time-of-day theme switcher: `light` between sunrise and sunset, `cosy` after dark.
// Sunrise/sunset come from the weather cache (Open-Meteo daily). Falls back to a
// fixed 7am–7pm window if no weather data is cached yet (first paint, offline).
//
// The URL param `?theme=...` always wins so Tim can force a theme for previews.

const DAY_THEME = 'light';
const NIGHT_THEME = 'cosy';
const FALLBACK_DAY_START_HOUR = 7;
const FALLBACK_DAY_END_HOUR = 19;

export function pickTheme(now, sun) {
  if (!sun?.sunrise || !sun?.sunset) {
    const h = now.getHours();
    return (h >= FALLBACK_DAY_START_HOUR && h < FALLBACK_DAY_END_HOUR) ? DAY_THEME : NIGHT_THEME;
  }
  const sunrise = new Date(sun.sunrise);
  const sunset = new Date(sun.sunset);
  return (now >= sunrise && now < sunset) ? DAY_THEME : NIGHT_THEME;
}

function getSunFromCache() {
  try {
    const raw = localStorage.getItem('weather:v1');
    if (!raw) return null;
    const { data } = JSON.parse(raw);
    return data?.sun ?? null;
  } catch { return null; }
}

export function applyTheme() {
  const params = new URLSearchParams(window.location.search);
  const override = params.get('theme');
  const theme = override || pickTheme(new Date(), getSunFromCache());
  document.documentElement.dataset.theme = theme;
}
