export function renderBible(verse) {
  if (!verse) return '';
  return `
    <div class="bible">
      <p class="bible__text">${escapeHtml(verse.text)}</p>
      <span class="bible__ref">${escapeHtml(verse.ref)}</span>
    </div>
  `;
}

// The verse must never wrap — it's a one-line ribbon above the fold. Shrink the
// font until the text fits its flex track (floor 0.65rem); past the floor the
// CSS ellipsis takes over. Re-runs after webfonts land, since serif fallback
// metrics differ enough to change the fit.
const FIT_START_REM = 0.95;
const FIT_FLOOR_REM = 0.65;
const FIT_STEP_REM = 0.05;

export function fitBible(container) {
  const text = container?.querySelector('.bible__text');
  if (!text) return;
  const fit = () => {
    let size = FIT_START_REM;
    text.style.fontSize = `${size}rem`;
    while (text.scrollWidth > text.clientWidth && size > FIT_FLOOR_REM) {
      size = Math.round((size - FIT_STEP_REM) * 100) / 100;
      text.style.fontSize = `${size}rem`;
    }
  };
  fit();
  document.fonts?.ready?.then(fit).catch(() => {});
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
