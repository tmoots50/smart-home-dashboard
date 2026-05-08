// v1 edit UX uses window.prompt/confirm.
//
// `actions` (optional) wires mutations through to a backend (the iNote bridge).
// When passed, toggle/add/delete persist via actions.{strike,append} and revert
// the optimistic update on failure. When omitted, behaves as a pure-local widget.

const OWNERS = ['Tim', 'Caroline'];
const DAY_MS = 86_400_000;
const DATE_FMT = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const PAGE_SIZE = 5;

export function renderTodos(todos, visibleCount = PAGE_SIZE, now = new Date()) {
  const visible = todos.slice(0, visibleCount);
  const remaining = todos.length - visible.length;
  return `
    <div class="todos">
      <div class="card__header">
        <h2 class="card__title">Todo</h2>
        <span class="card__header-actions">
          <button class="btn btn--add" data-action="add" aria-label="Add todo">+</button>
        </span>
      </div>
      ${!todos.length ? '<p class="muted">Nothing on the list.</p>' : `
        <ul class="todos__list">
          ${visible.map((t, i) => `
            <li class="todos__item" data-action="toggle" data-idx="${i}">
              <span class="todos__check${t.done ? ' todos__check--done' : ''}" data-action="toggle" data-idx="${i}"></span>
              <div class="todos__body">
                <span class="todos__text${t.done ? ' todos__text--done' : ''}">${escapeHtml(t.text)}</span>
                ${(t.due || t.owner) ? `<span class="todos__meta">
                  ${t.due ? `<span class="todos__due ${dueClass(t.due, now)}">${formatDue(t.due, now)}</span>` : ''}
                  ${t.owner ? `<span class="todos__owner">${escapeHtml(t.owner)}</span>` : ''}
                </span>` : ''}
              </div>
              <span class="card__row-actions">
                <button class="btn btn--icon" data-action="edit" data-idx="${i}" aria-label="Edit">✎</button>
                <button class="btn btn--icon" data-action="delete" data-idx="${i}" aria-label="Delete">✕</button>
              </span>
            </li>
          `).join('')}
        </ul>
        ${remaining > 0 ? `
          <div class="todos__more">
            <button class="btn btn--text" data-action="more">See more (${remaining})</button>
          </div>
        ` : ''}
      `}
    </div>
  `;
}

export function mountTodos(slot, initial, actions = null) {
  let items = [...initial];
  let visibleCount = PAGE_SIZE;

  const draw = () => { slot.innerHTML = renderTodos(items, visibleCount, new Date()); };

  slot.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    const idx = Number(target.dataset.idx);

    if (action === 'more') {
      visibleCount += PAGE_SIZE;
      draw();
      return;
    }

    if (action === 'add') {
      const text = window.prompt('What needs doing?');
      if (!text) return;
      // When wired to the bridge, owner/due aren't structured fields in Apple
      // Notes — skip those prompts. Fall back to the richer prompts for local-only.
      if (actions) {
        items = [...items, { text, done: false }];
        draw();
        actions.append(text).catch(() => {
          items = items.filter(x => x.text !== text);
          draw();
        });
      } else {
        const owner = window.prompt(`Whose? (${OWNERS.join(' or ')})`, OWNERS[0]);
        if (!owner) return;
        const due = window.prompt('Due (YYYY-MM-DD, blank for none):', todayString()) ?? '';
        items = [...items, { text, owner, due, done: false }];
        draw();
      }
    } else if (action === 'edit') {
      // Apple Notes has no clean "edit one line" — skip persistence here.
      const next = window.prompt('Edit text:', items[idx].text);
      if (next === null) return;
      const due = window.prompt('Due (YYYY-MM-DD, blank for none):', items[idx].due ?? '');
      if (due === null) return;
      items = items.map((it, i) => i === idx ? { ...it, text: next, due } : it);
      draw();
    } else if (action === 'delete') {
      if (!window.confirm(`Delete "${items[idx].text}"?`)) return;
      const removed = items[idx];
      items = items.filter((_, i) => i !== idx);
      draw();
      // With the bridge: "delete" means strike — Apple Notes keeps the line, just
      // marks it done. Matches family-copilot semantics.
      actions?.strike(removed.text).catch(() => {
        items.splice(idx, 0, removed);
        draw();
      });
    } else if (action === 'toggle') {
      const it = items[idx];
      // The bridge has no "unstrike" endpoint — uncheck is local-only for now.
      if (actions && it.done) return;
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
