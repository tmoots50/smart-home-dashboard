// Shared engine behind the Todo and Groceries cards. Both lists get identical
// touch behavior:
//   - whole-row tap toggles done (undoable, commits after the toast expires)
//   - delete is instant with Undo — no confirm dialog
//   - add/edit happen in an inline input row — no window.prompt
//   - long-press the ⋮⋮ handle to drag-reorder (SortableJS)
//
// `actions` (optional) wires mutations to a backend:
//   append(text), strike({id, text}), move(id, previousId), update(id, text)
// Every mutation is optimistic; failures revert the UI and surface a toast.
// Destructive calls (strike) are deferred until the Undo toast expires, so
// "Undo" means the request never happened — the API needs no unstrike.

import Sortable from 'sortablejs';
import { showToast } from './toast.js';

const UNDO_MS = 5000;
const DRAG_HANDLE = '<span class="drag-handle" aria-label="Drag to reorder">⋮⋮</span>';

export function createListWidget(cfg) {
  // cfg: { name, title, addLabel, placeholder, emptyText, renderBody(item, now), pageSize }
  const c = (el) => `${cfg.name}__${el}`;

  function render(items, state, now = new Date()) {
    const { visibleCount, adding, editingIdx, draft } = state;
    const visible = items.slice(0, visibleCount);
    const remaining = items.length - visible.length;
    const expanded = visibleCount > cfg.pageSize;
    return `
      <div class="${cfg.name}">
        <div class="card__header">
          <h2 class="card__title">${cfg.title}</h2>
          <span class="card__header-actions">
            <button class="btn btn--add" data-action="add" aria-label="${cfg.addLabel}">+</button>
          </span>
        </div>
        ${!items.length && !adding ? `<p class="muted">${cfg.emptyText}</p>` : `
          <ul class="${c('list')}">
            ${adding ? inputRow('add', draft, cfg.placeholder) : ''}
            ${visible.map((item, i) => i === editingIdx
              ? inputRow('edit', draft, cfg.placeholder)
              : row(item, i, now)).join('')}
          </ul>
          ${(remaining > 0 || expanded) ? `
            <div class="${c('more')} list-more">
              ${remaining > 0 ? `<button class="btn btn--text" data-action="more">See more (${remaining})</button>` : ''}
              ${expanded ? `<button class="btn btn--text" data-action="less">See less</button>` : ''}
            </div>
          ` : ''}
        `}
      </div>
    `;
  }

  function row(item, i, now) {
    return `
      <li class="${c('item')}" data-action="toggle" data-idx="${i}" data-id="${escapeHtml(item.id ?? '')}">
        ${DRAG_HANDLE}
        <span class="${c('check')}${item.done ? ` ${c('check')}--done` : ''}"></span>
        <div class="${c('body')} list-body">${cfg.renderBody(item, now)}</div>
        <span class="card__row-actions">
          <button class="btn btn--icon" data-action="edit" data-idx="${i}" aria-label="Edit">✎</button>
          <button class="btn btn--icon" data-action="delete" data-idx="${i}" aria-label="Delete">✕</button>
        </span>
      </li>
    `;
  }

  function inputRow(kind, value, placeholder) {
    return `
      <li class="list-input" data-input="${kind}">
        <input class="list-input__field" type="text" value="${escapeHtml(value)}"
               placeholder="${escapeHtml(placeholder)}" enterkeyhint="done"
               autocomplete="off" autocapitalize="sentences" />
        <span class="card__row-actions list-input__actions">
          <button class="btn btn--icon list-input__ok" data-action="${kind}-commit" aria-label="Save">✓</button>
          <button class="btn btn--icon" data-action="${kind}-cancel" aria-label="Cancel">✕</button>
        </span>
      </li>
    `;
  }

  function mount(slot, initial, actions = null) {
    let items = [...initial];
    const state = { visibleCount: cfg.pageSize, adding: false, editingIdx: null, draft: '' };
    let sortable = null;

    const draw = () => {
      if (sortable) { sortable.destroy(); sortable = null; }
      slot.innerHTML = render(items, state, new Date());
      const list = slot.querySelector(`.${c('list')}`);
      if (list) sortable = wireSortable(list);
      const field = slot.querySelector('.list-input__field');
      if (field) {
        field.focus();
        field.setSelectionRange?.(field.value.length, field.value.length);
      }
    };

    // Long-press a row's drag handle, drop into a new position, persist.
    // Touch-only delay disambiguates drag from a quick tap-to-toggle.
    function wireSortable(list) {
      return Sortable.create(list, {
        handle: '.drag-handle',
        draggable: `.${c('item')}`, // never the inline input row
        animation: 150,
        delay: 200,
        delayOnTouchOnly: true,
        onEnd(evt) {
          if (evt.oldIndex === evt.newIndex) return;
          // Sortable indexes count the input row when present; normalize.
          const offset = state.adding ? 1 : 0;
          const from = evt.oldIndex - offset;
          const to = evt.newIndex - offset;
          const before = items.slice();
          const moved = items[from];
          const next = items.slice();
          next.splice(from, 1);
          next.splice(to, 0, moved);
          const previous = to > 0 ? next[to - 1] : null;
          items = next;
          // Visual order already updated by Sortable; only re-draw on failure.
          if (actions?.move && moved?.id) {
            actions.move(moved.id, previous?.id ?? null).catch(() => {
              items = before;
              draw();
            });
          }
        },
      });
    }

    // Undo window: revert is free until the toast expires; only then does the
    // backend call fire. A failed commit restores the row.
    function scheduleCommit({ message, revert, commit }) {
      showToast(message, {
        actionLabel: 'Undo',
        duration: UNDO_MS,
        onAction: () => { revert(); draw(); },
        onExpire: () => {
          commit?.().catch(() => {
            revert();
            draw();
            showToast("Couldn't sync — restored", { duration: 3500 });
          });
        },
      });
    }

    function commitAdd(field) {
      const text = field.value.trim();
      if (!text) { state.adding = false; state.draft = ''; draw(); return; }
      const optimistic = { text, done: false };
      // Google Tasks inserts at the top; mirror that so the next fetch agrees.
      items = [optimistic, ...items];
      state.draft = ''; // composer stays open for rapid multi-add
      draw();
      actions?.append(text).catch(() => {
        items = items.filter(x => x !== optimistic);
        draw();
        showToast(`Couldn't add "${truncate(text)}"`, { duration: 3500 });
      });
    }

    function commitEdit(field) {
      const idx = state.editingIdx;
      const it = items[idx];
      const text = field.value.trim();
      state.editingIdx = null;
      state.draft = '';
      if (!it || !text || text === it.text) { draw(); return; }
      const prev = it.text;
      const edited = { ...it, text };
      items = items.map((x, i) => (i === idx ? edited : x));
      draw();
      if (actions?.update && it.id) {
        actions.update(it.id, text).catch(() => {
          items = items.map(x => (x === edited ? { ...x, text: prev } : x));
          draw();
          showToast(`Couldn't save "${truncate(text)}"`, { duration: 3500 });
        });
      }
    }

    slot.addEventListener('keydown', (e) => {
      if (!e.target.classList?.contains('list-input__field')) return;
      const kind = e.target.closest('.list-input')?.dataset.input;
      if (e.key === 'Enter') {
        e.preventDefault();
        kind === 'edit' ? commitEdit(e.target) : commitAdd(e.target);
      } else if (e.key === 'Escape') {
        state.adding = false;
        state.editingIdx = null;
        state.draft = '';
        draw();
      }
    });

    slot.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const action = target.dataset.action;
      const idx = Number(target.dataset.idx);
      const field = slot.querySelector('.list-input__field');

      if (action === 'more') { state.visibleCount += cfg.pageSize; draw(); return; }
      if (action === 'less') { state.visibleCount = cfg.pageSize; draw(); return; }

      if (action === 'add') {
        state.adding = !state.adding;
        state.editingIdx = null;
        state.draft = '';
        draw();
        return;
      }
      if (action === 'add-commit') { if (field) commitAdd(field); return; }
      if (action === 'add-cancel') { state.adding = false; state.draft = ''; draw(); return; }
      if (action === 'edit-commit') { if (field) commitEdit(field); return; }
      if (action === 'edit-cancel') { state.editingIdx = null; state.draft = ''; draw(); return; }

      if (action === 'edit') {
        state.editingIdx = idx;
        state.adding = false;
        state.draft = items[idx]?.text ?? '';
        draw();
        return;
      }

      if (action === 'delete') {
        const removed = items[idx];
        if (!removed) return;
        items = items.filter((_, i) => i !== idx);
        draw();
        scheduleCommit({
          message: `Deleted "${truncate(removed.text)}"`,
          revert: () => {
            const at = Math.min(idx, items.length);
            items = [...items.slice(0, at), removed, ...items.slice(at)];
          },
          // Delete means strike — Google Tasks keeps the line, marked done.
          commit: actions ? () => actions.strike({ id: removed.id, text: removed.text }) : null,
        });
        return;
      }

      if (action === 'toggle') {
        if (state.editingIdx !== null || state.adding) return; // don't fight the composer
        const it = items[idx];
        if (!it) return;
        const toggled = { ...it, done: !it.done };
        items = items.map((x, i) => (i === idx ? toggled : x));
        draw();
        if (actions?.setDone && it.id) {
          actions.setDone(it.id, toggled.done).catch(() => {
            items = items.map(x => (x === toggled ? it : x));
            draw();
            showToast("Couldn't sync — restored", { duration: 3500 });
          });
          return;
        }
        if (it.done) return;
        const struck = toggled;
        scheduleCommit({
          message: `Done: "${truncate(it.text)}"`,
          revert: () => { items = items.map(x => (x === struck ? { ...x, done: false } : x)); },
          commit: actions ? () => actions.strike({ id: it.id, text: it.text }) : null,
        });
      }
    });

    draw();

    return {
      setItems(next) {
        // A live refresh mustn't eat a half-typed entry.
        const field = slot.querySelector('.list-input__field');
        if (field) state.draft = field.value;
        items = [...next];
        draw();
      },
    };
  }

  return { render, mount };
}

function truncate(s, max = 28) {
  const str = String(s);
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
