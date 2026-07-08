// Todo card. All interaction behavior (inline add/edit, undoable strike and
// delete, drag-reorder) lives in the shared engine — see list-widget.js.
// This file only knows how a todo row's body renders: text + due date + owner.

import { createListWidget, escapeHtml } from './list-widget.js';

const DAY_MS = 86_400_000;
const DATE_FMT = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const PAGE_SIZE = 5;

const widget = createListWidget({
  name: 'todos',
  title: 'Todo',
  addLabel: 'Add todo',
  placeholder: 'Add a todo…',
  emptyText: 'Nothing on the list.',
  pageSize: PAGE_SIZE,
  renderBody(t, now) {
    return `
      <span class="todos__text${t.done ? ' todos__text--done' : ''}">${escapeHtml(t.text)}</span>
      ${(t.due || t.owner) ? `<span class="todos__meta">
        ${t.due ? `<span class="todos__due ${dueClass(t.due, now)}">${formatDue(t.due, now)}</span>` : ''}
        ${t.owner ? `<span class="todos__owner">${escapeHtml(t.owner)}</span>` : ''}
      </span>` : ''}
    `;
  },
});

export function renderTodos(todos, visibleCount = PAGE_SIZE, now = new Date()) {
  return widget.render(todos, { visibleCount, adding: false, editingIdx: null, draft: '' }, now);
}

export function mountTodos(slot, initial, actions = null) {
  return widget.mount(slot, initial, actions);
}

function parseLocalDate(s) {
  if (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(s);
}
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function diffDays(due, now) {
  return Math.floor((startOfDay(parseLocalDate(due)) - startOfDay(now)) / DAY_MS);
}

function formatDue(due, now) {
  const d = diffDays(due, now);
  if (d < 0) return 'Overdue';
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  return DATE_FMT.format(parseLocalDate(due));
}

function dueClass(due, now) {
  const d = diffDays(due, now);
  if (d < 0) return 'todos__due--overdue';
  if (d === 0) return 'todos__due--today';
  return '';
}
