// v1 edit UX uses window.prompt/confirm — functional placeholder, will be
// replaced with proper touch UI later.
//
// `actions` (optional) wires mutations through to the iNote bridge. When passed,
// add/toggle/delete persist via actions.{append,strike,move} with optimistic-update
// + revert-on-failure. When omitted, behaves as a pure-local widget.

import Sortable from 'sortablejs';

const DRAG_HANDLE = '<span class="drag-handle" aria-label="Drag to reorder">⋮⋮</span>';

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
            <li class="groceries__item" data-action="toggle" data-idx="${i}" data-id="${escapeHtml(item.id ?? '')}">
              ${DRAG_HANDLE}
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

export function mountGroceries(slot, initialItems, actions = null) {
  let items = [...initialItems];
  let sortable = null;

  const draw = () => {
    if (sortable) { sortable.destroy(); sortable = null; }
    slot.innerHTML = renderGroceries(items);
    const list = slot.querySelector('.groceries__list');
    if (list) sortable = wireSortable(list);
  };

  function wireSortable(list) {
    return Sortable.create(list, {
      handle: '.drag-handle',
      animation: 150,
      delay: 200,
      delayOnTouchOnly: true,
      onEnd(evt) {
        if (evt.oldIndex === evt.newIndex) return;
        const before = items.slice();
        const moved = items[evt.oldIndex];
        const next = items.slice();
        next.splice(evt.oldIndex, 1);
        next.splice(evt.newIndex, 0, moved);
        const previous = evt.newIndex > 0 ? next[evt.newIndex - 1] : null;
        items = next;
        if (actions?.move && moved?.id) {
          actions.move(moved.id, previous?.id ?? null).catch(() => {
            items = before;
            draw();
          });
        }
      },
    });
  }

  slot.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    const idx = Number(target.dataset.idx);

    if (action === 'add') {
      const text = window.prompt('What to add?');
      if (!text) return;
      if (actions) {
        // Apple Notes doesn't carry qty — skip the prompt when wired to bridge.
        items = [...items, { text, done: false }];
        draw();
        actions.append(text).catch(() => {
          items = items.filter(x => x.text !== text);
          draw();
        });
      } else {
        const qty = window.prompt('Quantity (optional):') ?? '';
        items = [...items, { text, qty, done: false }];
        draw();
      }
    } else if (action === 'edit') {
      // No bridge edit endpoint — local-only.
      const next = window.prompt('Edit:', items[idx].text);
      if (next === null) return;
      items = items.map((it, i) => i === idx ? { ...it, text: next } : it);
      draw();
    } else if (action === 'delete') {
      if (!window.confirm(`Delete "${items[idx].text}"?`)) return;
      const removed = items[idx];
      items = items.filter((_, i) => i !== idx);
      draw();
      actions?.strike(removed.text).catch(() => {
        items.splice(idx, 0, removed);
        draw();
      });
    } else if (action === 'toggle') {
      const it = items[idx];
      if (actions && it.done) return; // no unstrike yet
      items = items.map((x, i) => i === idx ? { ...x, done: !x.done } : x);
      draw();
      if (actions && !it.done) {
        actions.strike(it.text).catch(() => {
          items = items.map((x, i) => i === idx ? { ...x, done: false } : x);
          draw();
        });
      }
    }
  });

  draw();

  return {
    setItems(next) { items = [...next]; draw(); },
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
