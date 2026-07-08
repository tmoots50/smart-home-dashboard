// The daily "Atlanta Pick" card: one Hermes-chosen thing to do, rotated each
// morning, with a one-line "why you'd like it". Evolves the old 3-headline card
// — a taste pick beats a recency list on a glanceable wall display.

import { getDailyPick, fetchPick } from '../lib/curated.js';

const REFRESH_MS = 30 * 60 * 1000; // re-read through the day so the morning pick appears without a reload

export function renderPick(pick) {
  if (!pick?.title) return '';
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
    <div class="pick">
      <h2 class="card__title">Atlanta Pick</h2>
      ${source}
      ${title}
      ${note}
    </div>
  `;
}

export function mountPick(el) {
  const { initial, live } = getDailyPick();
  el.innerHTML = renderPick(initial);
  live.then(pick => { if (pick?.title) el.innerHTML = renderPick(pick); });

  const id = setInterval(() => {
    fetchPick()
      .then(pick => { el.innerHTML = renderPick(pick); })
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
