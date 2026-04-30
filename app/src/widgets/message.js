export function renderMessage(msg) {
  if (!msg) return '';
  return `
    <div class="message">
      <h2 class="card__title">Today’s note</h2>
      <p class="message__quote">${escapeHtml(msg.quote)}</p>
      <span class="message__from">— ${escapeHtml(msg.from)}</span>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
