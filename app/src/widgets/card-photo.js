// Rotating photo for the bottom of a host card. Caller controls the
// container's aspect ratio + border radius via CSS (.card__photo).

const ROTATE_MS = 8_000;

export function renderCardPhoto(photos, currentIndex = 0) {
  if (!photos.length) return '';
  const caption = photos[currentIndex]?.caption ?? '';
  return `
    ${photos.map((p, i) => `
      <img class="${i === currentIndex ? 'is-current' : ''}"
           src="${escapeAttr(p.src)}" alt="" />
    `).join('')}
    ${caption ? `<div class="card__photo-caption">${escapeHtml(caption)}</div>` : ''}
  `;
}

export function mountCardPhoto(slot, photos, { intervalMs = ROTATE_MS } = {}) {
  if (!slot || !photos.length) return;
  let i = 0;
  slot.innerHTML = renderCardPhoto(photos, i);

  setInterval(() => {
    i = (i + 1) % photos.length;
    slot.querySelectorAll('img').forEach((img, idx) => {
      img.classList.toggle('is-current', idx === i);
    });
    const cap = slot.querySelector('.card__photo-caption');
    if (cap) cap.textContent = photos[i].caption ?? '';
  }, intervalMs);
}

function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;');
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
