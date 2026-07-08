// Singleton toast pinned bottom-center. Enables the commit-on-expiry pattern
// that replaced window.confirm(): apply a mutation optimistically, hand the
// API call to `onExpire`, and give the user an Undo window during which the
// call simply never happens. Exactly one of onAction/onExpire runs per toast.
//
// Replacing a live toast settles the old one as expired first — a burst of
// strikes must commit every prior action, not cancel it.

const DEFAULT_MS = 5000;

let host = null;
let current = null; // { el, timer, onAction, onExpire }

export function showToast(message, opts = {}) {
  const { actionLabel, onAction, onExpire, duration = DEFAULT_MS } = opts;
  if (!host) {
    host = document.createElement('div');
    host.className = 'toast-host';
    document.body.appendChild(host);
  }
  settle('expire');

  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `
    <span class="toast__msg"></span>
    ${actionLabel ? '<button class="toast__action"></button>' : ''}
  `;
  el.querySelector('.toast__msg').textContent = message;
  const btn = el.querySelector('.toast__action');
  if (btn) {
    btn.textContent = actionLabel;
    btn.addEventListener('click', () => settle('action'));
  }
  host.appendChild(el);

  const timer = setTimeout(() => settle('expire'), duration);
  current = { el, timer, onAction, onExpire };
  return { dismiss: () => settle('expire') };
}

function settle(outcome) {
  if (!current) return;
  const { el, timer, onAction, onExpire } = current;
  current = null;
  clearTimeout(timer);
  el.remove();
  if (outcome === 'action') onAction?.();
  else onExpire?.();
}

// Test hook: settle anything pending and drop the host.
export function _resetToasts() {
  settle('expire');
  host?.remove();
  host = null;
}
