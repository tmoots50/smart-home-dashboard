import { getHeadlines, fetchHeadlines } from '../lib/headlines.js';

const MAX_ITEMS = 3;
const REFRESH_MS = 30 * 60 * 1000;

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

export function mountHeadlines(el) {
  const { initial, live } = getHeadlines();
  el.innerHTML = renderHeadlines(initial);
  live.then(items => { if (items?.length) el.innerHTML = renderHeadlines(items); });

  const id = setInterval(() => {
    fetchHeadlines()
      .then(items => { el.innerHTML = renderHeadlines(items); })
      .catch(() => { /* keep last good frame */ });
  }, REFRESH_MS);

  return () => clearInterval(id);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
