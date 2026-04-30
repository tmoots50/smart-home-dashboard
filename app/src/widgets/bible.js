export function renderBible(verse) {
  if (!verse) return '';
  return `
    <div class="bible">
      <p class="bible__text">${escapeHtml(verse.text)}</p>
      <span class="bible__ref">${escapeHtml(verse.ref)}</span>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
