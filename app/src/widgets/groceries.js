// Groceries card. All interaction behavior (inline add/edit, undoable strike
// and delete, drag-reorder) lives in the shared engine — see list-widget.js.
// This file only knows how a grocery row's body renders: text + optional qty.

import { createListWidget, escapeHtml } from './list-widget.js';

const widget = createListWidget({
  name: 'groceries',
  title: 'Groceries',
  addLabel: 'Add grocery',
  placeholder: 'Add groceries…',
  emptyText: 'List is empty.',
  pageSize: Infinity, // grocery runs are short; show the whole list
  renderBody(item) {
    return `
      <span class="groceries__text${item.done ? ' groceries__text--done' : ''}">
        ${escapeHtml(item.text)}${item.qty ? ` <span class="groceries__qty">· ${escapeHtml(item.qty)}</span>` : ''}
      </span>
    `;
  },
});

export function renderGroceries(items) {
  return widget.render(items, { visibleCount: Infinity, adding: false, editingIdx: null, draft: '' });
}

export function mountGroceries(slot, initialItems, actions = null) {
  return widget.mount(slot, initialItems, actions);
}
