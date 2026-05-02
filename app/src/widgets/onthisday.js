export function renderOnThisDay(data) {
  if (!data) return '';
  return `
    <div class="onthisday">
      <h2 class="card__title">🗽 On this day · ${data.year}</h2>
      <p class="onthisday__fact">${escapeHtml(data.fact)}</p>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
