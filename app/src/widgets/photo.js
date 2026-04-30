const ROTATE_MS = 8_000;

export function renderPhoto(photos, currentIndex = 0) {
  if (!photos.length) return '<div class="photo"></div>';
  const caption = photos[currentIndex]?.caption ?? '';
  return `
    <div class="photo">
      ${photos.map((p, i) => `
        <img class="photo__img${i === currentIndex ? ' photo__img--current' : ''}"
             src="${escapeAttr(p.src)}" alt="" />
      `).join('')}
      ${caption ? `<div class="photo__caption">${escapeHtml(caption)}</div>` : ''}
    </div>
  `;
}

export function mountPhotoBackground(host, photos, { intervalMs = ROTATE_MS } = {}) {
  if (!photos.length) return;
  host.classList.add('photo-bg');
  host.innerHTML = photos.map((p, i) => `
    <img class="photo-bg__img${i === 0 ? ' photo-bg__img--current' : ''}"
         src="${escapeAttr(p.src)}" alt="" />
  `).join('');

  let i = 0;
  setInterval(() => {
    i = (i + 1) % photos.length;
    host.querySelectorAll('.photo-bg__img').forEach((img, idx) => {
      img.classList.toggle('photo-bg__img--current', idx === i);
    });
  }, intervalMs);
}

export function mountPhoto(slot, photos, { intervalMs = ROTATE_MS } = {}) {
  if (!photos.length) {
    slot.innerHTML = renderPhoto(photos);
    return;
  }
  let i = 0;
  slot.innerHTML = renderPhoto(photos, i);

  const captionEl = () => slot.querySelector('.photo__caption');
  const imgs = () => slot.querySelectorAll('.photo__img');

  setInterval(() => {
    i = (i + 1) % photos.length;
    imgs().forEach((img, idx) => {
      img.classList.toggle('photo__img--current', idx === i);
    });
    const cap = captionEl();
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
