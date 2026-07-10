// Time-of-day theme switcher: light from 07:00 through 22:59, cosy from
// 23:00 through 06:59. This intentionally follows the household schedule,
// not seasonal sunrise/sunset, so winter evenings don't darken the kiosk early.
//
// The URL param `?theme=...` always wins so Tim can force a theme for previews.

const DAY_THEME = 'light';
const NIGHT_THEME = 'cosy';
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 23;

export function pickTheme(now) {
  const h = now.getHours();
  return (h >= DAY_START_HOUR && h < DAY_END_HOUR) ? DAY_THEME : NIGHT_THEME;
}

export function applyTheme() {
  const params = new URLSearchParams(window.location.search);
  const override = params.get('theme');
  const theme = override || pickTheme(new Date());
  document.documentElement.dataset.theme = theme;
}
