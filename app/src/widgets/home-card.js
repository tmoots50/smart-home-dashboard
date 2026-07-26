// Inline Home card (sits under Groceries) — the always-visible face of the
// smart home. Lock status at a glance, one-tap plug toggles, and an inline
// "add device" flow that grows the registry as new smart stuff arrives.
// The full overlay (scene modes, bigger tiles) stays behind the lock row / the
// action-bar ⌂ button; this card is the ambient summary.

import { openHomeOverlay } from './home.js';
import { showToast } from './toast.js';

const REFRESH_MS = 60 * 1000;
const UNDO_MS = 5000;

const SVG = 'viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
const LOCK_CLOSED = `<svg ${SVG}><rect x="4.5" y="11" width="15" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;
const LOCK_OPEN = `<svg ${SVG}><rect x="4.5" y="11" width="15" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-1.9"/></svg>`;

export function renderHomeCard(data, state = {}) {
  const { adding = false, draftName = '', draftId = '', askEntityId = false } = state;
  return `
    <div class="home-card">
      <div class="card__header">
        <h2 class="card__title">Home</h2>
        <span class="card__header-actions">
          <button class="btn btn--add" data-action="add-device" aria-label="Add device">+</button>
        </span>
      </div>
      ${data.lock ? renderLockRow(data.lock) : ''}
      ${adding ? renderAddForm(draftName, draftId, askEntityId) : ''}
      <ul class="home-card__list">
        ${(data.plugs ?? []).map(renderPlugRow).join('')}
      </ul>
      ${!(data.plugs ?? []).length && !adding ? '<p class="muted">No devices yet — tap + to add one.</p>' : ''}
    </div>
  `;
}

function renderLockRow(lock) {
  const locked = lock.state === 'locked';
  const jammed = lock.state === 'jammed';
  const unlocked = lock.state === 'unlocked';
  const battery = lock.battery == null ? '' : `${lock.battery}%`;
  return `
    <div class="home-card__lock-row ${locked ? 'is-locked' : unlocked ? 'is-unlocked' : ''} ${jammed ? 'is-jammed' : ''}">
      <span class="home-card__lock-info">
        <span class="home-card__lock-name">${escapeHtml(lock.name)}</span>
        ${battery ? `<span class="home-card__lock-battery">${battery}</span>` : ''}
      </span>
      <span class="home-card__lock-toggle" role="group" aria-label="Lock ${escapeHtml(lock.name)}">
        <button class="home-card__lock-btn" data-action="set-lock" data-lock-action="lock"
                aria-label="Lock" aria-pressed="${locked || jammed}">
          ${LOCK_CLOSED}
        </button>
        <button class="home-card__lock-btn" data-action="set-lock" data-lock-action="unlock"
                aria-label="Unlock" aria-pressed="${unlocked}">
          ${LOCK_OPEN}
        </button>
      </span>
    </div>
  `;
}

function renderPlugRow(plug) {
  return `
    <li class="home-card__row ${plug.on ? 'is-on' : 'is-off'}">
      <button class="home-card__toggle" data-action="toggle-plug" data-id="${escapeHtml(plug.id)}"
        role="switch" aria-checked="${plug.on}">
        <span class="home-card__name">${escapeHtml(plug.name)}</span>
        <span class="home-tile__switch"><span class="home-tile__knob"></span></span>
      </button>
      ${plug.custom ? `<button class="btn btn--icon home-card__remove" data-action="remove-device" data-id="${escapeHtml(plug.id)}" aria-label="Remove device">✕</button>` : ''}
    </li>
  `;
}

function renderAddForm(draftName, draftId, askEntityId) {
  return `
    <div class="list-input home-card__add" data-input="device">
      <span class="home-card__add-fields">
        <input class="list-input__field" data-field="name" type="text" value="${escapeHtml(draftName)}"
               placeholder="Device name…" enterkeyhint="${askEntityId ? 'next' : 'done'}" autocomplete="off" />
        ${askEntityId ? `
          <input class="list-input__field list-input__field--mono" data-field="id" type="text" value="${escapeHtml(draftId)}"
                 placeholder="switch.entity_id (from Home Assistant)" enterkeyhint="done" autocomplete="off" />
        ` : ''}
      </span>
      <span class="card__row-actions list-input__actions">
        <button class="btn btn--icon list-input__ok" data-action="device-commit" aria-label="Save">✓</button>
        <button class="btn btn--icon" data-action="device-cancel" aria-label="Cancel">✕</button>
      </span>
    </div>
  `;
}

// `getHomeFn` is lib/home.getHome — called on mount, after the overlay closes,
// and on a slow interval so the card tracks reality without a reload.
export function mountHomeCard(slot, getHomeFn, actions, deviceActions, { askEntityId = false } = {}) {
  let data = { lock: null, plugs: [] };
  const state = { adding: false, draftName: '', draftId: '', askEntityId };

  const draw = () => {
    slot.innerHTML = renderHomeCard(data, state);
    const field = slot.querySelector('.list-input__field[data-field="name"]');
    if (field && state.focusName !== false) field.focus();
  };

  const refresh = () => {
    const { initial, live } = getHomeFn();
    data = initial;
    draw();
    live.then(next => { if (next) { data = next; draw(); } });
  };

  function commitAdd() {
    const name = slot.querySelector('[data-field="name"]')?.value.trim() ?? '';
    const idField = slot.querySelector('[data-field="id"]')?.value.trim() ?? '';
    if (!name) { state.adding = false; draw(); return; }
    const id = state.askEntityId ? idField : `switch.${slugify(name)}`;
    if (state.askEntityId && !/^(switch|light)\.[a-z0-9_]+$/.test(id)) {
      showToast('Entity id must look like switch.name_here', { duration: 3500 });
      return;
    }
    const device = { id, name };
    state.adding = false;
    state.draftName = '';
    state.draftId = '';
    data = { ...data, plugs: [...data.plugs, { ...device, on: false, custom: true }] };
    draw();
    deviceActions?.add(device).catch((err) => {
      data = { ...data, plugs: data.plugs.filter(p => p.id !== device.id) };
      draw();
      showToast(err?.reason || `Couldn't add "${name}"`, { duration: 3500 });
    });
  }

  slot.addEventListener('keydown', (e) => {
    if (!e.target.classList?.contains('list-input__field')) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      // Enter in the name field jumps to the id field when one exists.
      const idField = slot.querySelector('[data-field="id"]');
      if (e.target.dataset.field === 'name' && idField) idField.focus();
      else commitAdd();
    } else if (e.key === 'Escape') {
      state.adding = false;
      state.draftName = '';
      state.draftId = '';
      draw();
    }
  });

  slot.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const action = t.dataset.action;

    if (action === 'open-overlay') {
      openHomeOverlay(getHomeFn(), actions);
      return;
    }
    if (action === 'add-device') {
      state.adding = !state.adding;
      state.draftName = '';
      state.draftId = '';
      draw();
      return;
    }
    if (action === 'device-commit') { commitAdd(); return; }
    if (action === 'device-cancel') {
      state.adding = false;
      draw();
      return;
    }
    if (action === 'set-lock') {
      const lockAction = t.dataset.lockAction;
      const before = data;
      data = { ...data, lock: { ...data.lock, state: lockAction === 'lock' ? 'locked' : 'unlocked' } };
      draw();
      actions?.setLock(lockAction).catch(() => { data = before; draw(); });
      return;
    }
    if (action === 'toggle-plug') {
      const id = t.dataset.id;
      const before = data;
      const next = data.plugs.find(p => p.id === id);
      if (!next) return;
      data = { ...data, plugs: data.plugs.map(p => (p.id === id ? { ...p, on: !p.on } : p)) };
      draw();
      actions?.setPlug(id, !next.on).catch(() => { data = before; draw(); });
      return;
    }
    if (action === 'remove-device') {
      const id = t.dataset.id;
      const removed = data.plugs.find(p => p.id === id);
      if (!removed) return;
      data = { ...data, plugs: data.plugs.filter(p => p.id !== id) };
      draw();
      showToast(`Removed "${removed.name}"`, {
        actionLabel: 'Undo',
        duration: UNDO_MS,
        onAction: () => { data = { ...data, plugs: [...data.plugs, removed] }; draw(); },
        onExpire: () => {
          deviceActions?.remove(id).catch(() => {
            data = { ...data, plugs: [...data.plugs, removed] };
            draw();
            showToast("Couldn't sync — restored", { duration: 3500 });
          });
        },
      });
    }
  });

  refresh();
  const timer = setInterval(refresh, REFRESH_MS);
  return () => clearInterval(timer);
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'device';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
