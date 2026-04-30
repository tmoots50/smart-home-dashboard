export function renderWeather(data) {
  return `
    <div class="weather">
      <h2 class="card__title">${escapeHtml(data.location)}</h2>
      <div class="weather__main">
        <div class="weather__current">
          <div class="weather__now">
            <span class="weather__temp">${data.current.tempF}°</span>
            <span class="weather__condition">${escapeHtml(data.current.condition)}</span>
          </div>
          <div class="weather__hilo">H ${data.current.hi}° · L ${data.current.lo}°</div>
        </div>
        <div class="weather__forecast">
          ${data.forecast.map(day => `
            <div class="weather__day">
              <div class="weather__day-label">${escapeHtml(day.label)}</div>
              <div class="weather__day-temp">${day.tempF}°</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
