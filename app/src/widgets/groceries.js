// v1 edit UX uses window.prompt/confirm — functional placeholder, will be
// replaced with proper touch UI later.

export function renderGroceries(items) {
  return `
    <div class="groceries">
      <div class="card__header">
        <h2 class="card__title">Groceries</h2>
        <button class="btn btn--add" data-action="add" aria-label="Add grocery">+</button>
      </div>
      ${!items.length ? '<p class="muted">List is empty.</p>' : `
        <ul class="groceries__list">
          ${items.map((item, i) => `
            <li class="groceries__item">
              <span class="groceries__check${item.done ? ' groceries__check--done' : ''}" data-action="toggle" data-idx="${i}"></span>
              <span class="groceries__text${item.done ? ' groceries__text--done' : ''}">
                ${escapeHtml(item.text)}${item.qty ? ` <span class="groceries__qty">· ${escapeHtml(item.qty)}</span>` : ''}
              </span>
              <span class="card__row-actions">
                <button class="btn btn--icon" data-action="edit" data-idx="${i}" aria-label="Edit">✎</button>
                <button class="btn btn--icon" data-action="delete" data-idx="${i}" aria-label="Delete">✕</button>
              </span>
            </li>
          `).join('')}
        </ul>
      `}
    </div>
  `;
}

export function mountGroceries(slot, initialItems) {
  let items = [...initialItems];

  const draw = () => {
    slot.innerHTML = renderGroceries(items);
  };

  slot.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (!action) return;
    const idx = Number(e.target.dataset.idx);

    if (action === 'add') {
      const text = window.prompt('What to add?');
      if (!text) return;
      const qty = window.prompt('Quantity (optional):') ?? '';
      items = [...items, { text, qty, done: false }];
    } else if (action === 'edit') {
      const next = window.prompt('Edit:', items[idx].text);
      if (next === null) return;
      items = items.map((it, i) => i === idx ? { ...it, text: next } : it);
    } else if (action === 'delete') {
      if (!window.confirm(`Delete "${items[idx].text}"?`)) return;
      items = items.filter((_, i) => i !== idx);
    } else if (action === 'toggle') {
      items = items.map((it, i) => i === idx ? { ...it, done: !it.done } : it);
    } else {
      return;
    }
    draw();
  });

  draw();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
