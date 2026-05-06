export function renderAiMessage(msg, now = new Date()) {
  if (!msg) return '';
  const ago = msg.sentAt ? formatAgo(new Date(msg.sentAt), now) : '';
  return `
    <div class="aimessage">
      <h2 class="card__title">🤖 ${escapeHtml(msg.source)}${ago ? ` · ${ago}` : ''}</h2>
      <p class="aimessage__text">${escapeHtml(msg.text)}</p>
    </div>
  `;
}

// Mounts into a slot. Renders `initial` instantly, swaps to `live` when it
// resolves. Caller passes the result of getAiMessage().
export function mountAiMessage(el, { initial, live }) {
  el.innerHTML = renderAiMessage(initial);
  live.then(msg => { if (msg) el.innerHTML = renderAiMessage(msg); });
}

function formatAgo(then, now) {
  const ms = now - then;
  if (ms < 60_000) return 'just now';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
