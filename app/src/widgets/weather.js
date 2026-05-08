import { getWeather, fetchWeather } from '../lib/weather.js';

const REFRESH_MS = 15 * 60 * 1000;

export function renderWeather(data) {
  return `
    <div class="weather">
      <h2 class="card__title">${escapeHtml(data.location)}</h2>
      <div class="weather__main">
        <div class="weather__current">
          <div class="weather__now">
            <span class="weather__temp">${data.current.tempF}°</span>
            <div class="weather__meta">
              <span class="weather__condition">${escapeHtml(data.current.condition)}</span>
              <div class="weather__hilo">H ${data.current.hi}° · L ${data.current.lo}°</div>
            </div>
          </div>
        </div>
        <div class="weather__forecast">
          ${data.forecast.map(day => `
            <div class="weather__day">
              <div class="weather__day-label">${escapeHtml(day.label)}</div>
              <div class="weather__day-temp">${day.tempF}°</div>
              ${day.emoji ? `<div class="weather__day-emoji" aria-hidden="true">${day.emoji}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// Mounts into a slot. Renders the freshest cached/mock data instantly, then
// fetches live and swaps in. Re-fetches every REFRESH_MS so a long-running
// kiosk doesn't sit on stale data. Returns a teardown function.
export function mountWeather(el, opts) {
  const { initial, live } = getWeather(opts);
  el.innerHTML = renderWeather(initial);
  live.then(data => { if (data) el.innerHTML = renderWeather(data); });

  const id = setInterval(() => {
    fetchWeather(opts)
      .then(data => { el.innerHTML = renderWeather(data); })
      .catch(() => { /* keep showing the last good frame */ });
  }, REFRESH_MS);

  return () => clearInterval(id);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
