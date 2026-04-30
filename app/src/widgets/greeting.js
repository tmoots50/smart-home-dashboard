export function renderGreeting(data) {
  return `
    <div class="greeting">
      <h1 class="greeting__headline">${escapeHtml(data.headline)}</h1>
      <p class="greeting__subline">${escapeHtml(data.subline)}</p>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
