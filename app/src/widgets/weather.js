import { getWeather, fetchWeather } from '../lib/weather.js';

const REFRESH_MS = 15 * 60 * 1000;

// The quiet 2×2 stat cluster to the right of the hero temp. Cells with no
// data are omitted; under two cells the whole cluster disappears (old cached
// payloads, mock without the fields) rather than looking lopsided.
function renderStats(data) {
  const cells = [
    { label: 'Feels like', value: data.current?.feelsLikeF != null ? `${data.current.feelsLikeF}°` : null },
    { label: 'Rain', value: data.today?.rainPct != null ? `${data.today.rainPct}%` : null },
    { label: 'Wind', value: data.current?.windMph != null ? `${data.current.windMph} mph` : null },
    { label: 'UV', value: data.today?.uvMax != null ? String(data.today.uvMax) : null },
  ].filter(c => c.value != null);
  if (cells.length < 2) return '';
  return `
    <div class="weather__stats" aria-label="Current conditions">
      ${cells.map(c => `
        <div class="weather__stat">
          <span class="weather__stat-label">${escapeHtml(c.label)}</span>
          <span class="weather__stat-value">${escapeHtml(c.value)}</span>
        </div>
      `).join('')}
    </div>`;
}

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
        ${renderStats(data)}
      </div>
      <div class="weather__outlook">
        <div class="weather__strip">
          <span class="weather__strip-label">Rest of day</span>
          <div class="weather__hourly" aria-label="Rest of day hourly forecast">
            ${(data.hourly ?? []).map(hour => `
              <div class="weather__hour">
                <div class="weather__hour-label">${escapeHtml(hour.label)}</div>
                <div class="weather__hour-emoji" aria-hidden="true">${hour.emoji ?? ''}</div>
                <div class="weather__hour-temp">${hour.tempF}°</div>
                ${hour.precipitation >= 20 ? `<div class="weather__rain">${hour.precipitation}%</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
        <div class="weather__strip">
          <span class="weather__strip-label">7 days</span>
          <div class="weather__forecast" aria-label="Seven day forecast">
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
