// Three linked Atlanta picks with one-line context. Re-checks the curated feed
// every ten minutes so newly published picks reach the wall without a reload.

import { getPicks, fetchPicks } from '../lib/curated.js';

const REFRESH_MS = 10 * 60 * 1000;

export function renderPick(input) {
  const picks = (Array.isArray(input) ? input : [input]).filter(p => p?.title).slice(0, 3);
  if (!picks.length) return '';
  return `
    <div class="pick">
      <h2 class="card__title">Atlanta Picks</h2>
      <div class="pick__list">
        ${picks.map(renderPickItem).join('')}
      </div>
    </div>
  `;
}

function renderPickItem(pick) {
  const source = pick.source
    ? `<span class="pick__source">${escapeHtml(pick.source)}</span>`
    : '';
  const inner = escapeHtml(pick.title);
  // Only wrap the title in an anchor for http(s) urls. escapeHtml does NOT
  // neutralise a javascript:/data: href, so scheme-check before linking
  // (defence in depth — the API already rejects bad urls on write).
  const title = isHttpUrl(pick.url)
    ? `<a class="pick__title" href="${escapeHtml(pick.url)}" target="_blank" rel="noopener noreferrer">${inner}</a>`
    : `<span class="pick__title">${inner}</span>`;
  const note = pick.note
    ? `<p class="pick__note">${escapeHtml(pick.note)}</p>`
    : '';
  return `
    <article class="pick__item">
      ${source}
      ${title}
      ${note}
    </article>
  `;
}

export function mountPick(el) {
  const { initial, live } = getPicks();
  el.innerHTML = renderPick(initial);
  live.then(picks => { if (picks?.length) el.innerHTML = renderPick(picks); });

  const id = setInterval(() => {
    fetchPicks()
      .then(picks => { el.innerHTML = renderPick(picks); })
      .catch(() => { /* keep last good frame */ });
  }, REFRESH_MS);

  return () => clearInterval(id);
}

function isHttpUrl(u) {
  return typeof u === 'string' && /^https?:\/\//i.test(u);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
