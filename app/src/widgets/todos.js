// v1 edit UX uses window.prompt/confirm.

const OWNERS = ['Tim', 'Caroline'];
const DAY_MS = 86_400_000;
const DATE_FMT = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

export function renderTodos(todos, now = new Date()) {
  return `
    <div class="todos">
      <div class="card__header">
        <h2 class="card__title">Todo</h2>
        <span class="card__header-actions">
          <button class="btn btn--text" data-overlay="todos">See more</button>
          <button class="btn btn--add" data-action="add" aria-label="Add todo">+</button>
        </span>
      </div>
      ${!todos.length ? '<p class="muted">Nothing on the list.</p>' : `
        <ul class="todos__list">
          ${todos.map((t, i) => `
            <li class="todos__item" data-action="toggle" data-idx="${i}">
              <span class="todos__check${t.done ? ' todos__check--done' : ''}" data-action="toggle" data-idx="${i}"></span>
              <div class="todos__body">
                <span class="todos__text${t.done ? ' todos__text--done' : ''}">${escapeHtml(t.text)}</span>
                ${t.due ? `<span class="todos__due ${dueClass(t.due, now)}">${formatDue(t.due, now)}</span>` : ''}
              </div>
              <span class="todos__owner">${escapeHtml(t.owner)}</span>
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

export function mountTodos(slot, initial) {
  let items = [...initial];

  const draw = () => { slot.innerHTML = renderTodos(items, new Date()); };

  slot.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    const idx = Number(target.dataset.idx);

    if (action === 'add') {
      const text = window.prompt('What needs doing?');
      if (!text) return;
      const owner = window.prompt(`Whose? (${OWNERS.join(' or ')})`, OWNERS[0]);
      if (!owner) return;
      const due = window.prompt('Due (YYYY-MM-DD, blank for none):', todayString()) ?? '';
      items = [...items, { text, owner, due, done: false }];
    } else if (action === 'edit') {
      const next = window.prompt('Edit text:', items[idx].text);
      if (next === null) return;
      const due = window.prompt('Due (YYYY-MM-DD, blank for none):', items[idx].due ?? '');
      if (due === null) return;
      items = items.map((it, i) => i === idx ? { ...it, text: next, due } : it);
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
function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
