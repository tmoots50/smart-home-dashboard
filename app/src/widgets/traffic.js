export function renderTraffic(data) {
  if (!data) return '';
  const delta = data.durationMin - data.typicalMin;
  const deltaText = delta === 0 ? 'on time'
                  : delta > 0  ? `+${delta} vs typical`
                              : `${delta} vs typical`;

  return `
    <div class="traffic">
      <h2 class="card__title">Commute · ${escapeHtml(data.destination)}</h2>
      <div class="traffic__row">
        <span class="traffic__duration traffic__duration--${escapeHtml(data.status)}">${data.durationMin} min</span>
        <span class="traffic__via">via ${escapeHtml(data.via)}</span>
      </div>
      <div class="traffic__delta">${deltaText}</div>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
