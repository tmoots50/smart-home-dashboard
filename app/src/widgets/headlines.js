const MAX_ITEMS = 3;

export function renderHeadlines(items) {
  if (!items.length) return '';
  const top = items.slice(0, MAX_ITEMS);
  return `
    <div class="headlines">
      <h2 class="card__title">Headlines</h2>
      <ul class="headlines__list">
        ${top.map(h => `
          <li class="headlines__item">
            <span class="headlines__source">${escapeHtml(h.source)}</span>
            <span class="headlines__title">${escapeHtml(h.title)}</span>
          </li>
        `).join('')}
      </ul>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
