// Rotating photo for the bottom of a host card. Caller controls the
// container's aspect ratio + border radius via CSS (.card__photo).
//
// Mount accepts EITHER a plain array of {src, caption} (mock-style) OR the
// {initial, live} contract used by the real-data libs — caller's choice.
// Returns a controller with setPhotos(next) for late updates.

const ROTATE_MS = 60_000;

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

export function mountCardPhoto(slot, source, { intervalMs = ROTATE_MS } = {}) {
  if (!slot) return null;

  let photos = [];
  let i = 0;
  let timer = null;

  const draw = () => {
    if (!photos.length) { slot.innerHTML = ''; return; }
    if (i >= photos.length) i = 0;
    slot.innerHTML = renderCardPhoto(photos, i);
  };

  const tick = () => {
    if (photos.length < 2) return;
    i = (i + 1) % photos.length;
    const imgs = slot.querySelectorAll('img');
    imgs.forEach((img, idx) => img.classList.toggle('is-current', idx === i));
    const cap = slot.querySelector('.card__photo-caption');
    if (cap) cap.textContent = photos[i].caption ?? '';
  };

  const setPhotos = (next) => {
    photos = next || [];
    i = 0;
    draw();
    if (timer) { clearInterval(timer); timer = null; }
    if (photos.length > 1) timer = setInterval(tick, intervalMs);
  };

  // Accept both shapes.
  if (Array.isArray(source)) {
    setPhotos(source);
  } else if (source && source.initial !== undefined) {
    setPhotos(source.initial);
    source.live?.then(next => { if (next && next.length) setPhotos(next); });
  }

  return { setPhotos };
}

function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;');
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
