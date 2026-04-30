// Chores grouped by owner. v1 edit UX uses window.prompt/confirm.

const OWNERS = ['Tim', 'Caroline'];

export function renderChores(chores) {
  const groups = OWNERS.map(owner => ({
    owner,
    items: chores
      .map((c, i) => ({ ...c, _idx: i }))
      .filter(c => c.owner === owner),
  }));

  return `
    <div class="chores">
      <div class="card__header">
        <h2 class="card__title">Chores</h2>
        <button class="btn btn--add" data-action="add" aria-label="Add chore">+</button>
      </div>
      ${groups.map(group => `
        <div class="chores__group">
          <h3 class="chores__owner-label">${escapeHtml(group.owner)}</h3>
          ${group.items.length ? `
            <ul class="chores__list">
              ${group.items.map(item => `
                <li class="chores__item">
                  <span class="chores__check${item.done ? ' chores__check--done' : ''}" data-action="toggle" data-idx="${item._idx}"></span>
                  <span class="chores__text${item.done ? ' chores__text--done' : ''}">${escapeHtml(item.text)}</span>
                  <span class="card__row-actions">
                    <button class="btn btn--icon" data-action="edit" data-idx="${item._idx}" aria-label="Edit">✎</button>
                    <button class="btn btn--icon" data-action="delete" data-idx="${item._idx}" aria-label="Delete">✕</button>
                  </span>
                </li>
              `).join('')}
            </ul>
          ` : '<p class="muted chores__empty">All clear.</p>'}
        </div>
      `).join('')}
    </div>
  `;
}

export function mountChores(slot, initial) {
  let items = [...initial];

  const draw = () => { slot.innerHTML = renderChores(items); };

  slot.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (!action) return;
    const idx = Number(e.target.dataset.idx);

    if (action === 'add') {
      const text = window.prompt('What chore?');
      if (!text) return;
      const owner = window.prompt(`Whose? (${OWNERS.join(' or ')})`, OWNERS[0]);
      if (!owner) return;
      items = [...items, { text, owner, done: false }];
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
