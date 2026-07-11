// In-app article popup for Atlanta Picks. On the wall tablet a target=_blank
// pick opened Fully Kiosk's popup view with no way back to the dashboard —
// this overlay keeps reading in context: a persistent header (Back always
// works) over an iframe.
//
// Frame-blocking sites (X-Frame-Options / CSP frame-ancestors) are handled
// WITHOUT load-failure detection — cross-origin refusal semantics are
// version-dependent and contentDocument is unreadable. Instead the fallback
// hint sits BEHIND a transparent iframe: a successfully framed article paints
// its own opaque background and hides the hint; a refused frame stays
// transparent so the hint shows through, and "Open in browser" is always one
// tap away in the header.
//
// Same overlay conventions as calendar-overlay.js: scrim + panel, close via
// Back, a scrim tap, or Escape.

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

function isHttpUrl(u) {
  return typeof u === 'string' && /^https?:\/\//i.test(u);
}

// Harness/dev stubs are same-origin relative paths; production picks are
// absolute http(s). Anything else (javascript:, data:) is rejected.
function isFramableUrl(u) {
  return isHttpUrl(u) || (typeof u === 'string' && u.startsWith('/'));
}

export function renderArticleOverlay(pick) {
  const url = escapeHtml(pick.url);
  return `
    <div class="overlay__panel article-overlay" role="dialog" aria-label="Article">
      <header class="article-overlay__bar">
        <button class="article-overlay__back" data-action="close">‹ Back</button>
        <span class="article-overlay__source">${escapeHtml(pick.source || '')}</span>
        <a class="article-overlay__external" href="${url}" target="_blank" rel="noopener noreferrer">Open in browser ↗</a>
      </header>
      <div class="article-overlay__body">
        <p class="article-overlay__hint">If the article doesn't appear, this site blocks embedding — tap "Open in browser" above.</p>
        <iframe class="article-overlay__frame" src="${url}" title="${escapeHtml(pick.title || 'Article')}" referrerpolicy="no-referrer"></iframe>
      </div>
    </div>
  `;
}

export function openArticleOverlay(pick) {
  if (!isFramableUrl(pick?.url)) throw new TypeError('article-overlay: refusing non-http url');

  const host = document.createElement('div');
  host.className = 'overlay article-overlay-host';
  document.body.appendChild(host);
  document.documentElement.classList.add('has-overlay');
  host.innerHTML = renderArticleOverlay(pick);

  function close() {
    document.removeEventListener('keydown', onKey);
    document.documentElement.classList.remove('has-overlay');
    host.remove();
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  host.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="close"]')) return close();
    if (e.target === host) return close(); // scrim tap
  });

  document.addEventListener('keydown', onKey);
  return close;
}
