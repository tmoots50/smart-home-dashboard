// Home control overlay — the smart-home surface. Opened from the action-bar
// "home" button. Shows the Aqara U100 lock (state + battery, PIN-gated unlock)
// and smart-plug toggle tiles.
//
// `actions` (optional) wires mutations to the backend (lib/home.js → /api/home*).
// When passed, plug toggles + lock/unlock persist and revert the optimistic
// update on failure. When null (HA not live yet), the overlay mutates local
// state only — a full interactive demo with no backend. Mirrors the todos widget.
//
// Security note: unlock requires a PIN. In live mode the PIN is verified
// server-side (never in the bundle) and rate-limited. In local-mock mode any
// 4+ digit PIN "succeeds" so the UX can be felt without a backend.

const PIN_MIN = 4;

const SVG = 'viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
const LOCK_CLOSED = `<svg ${SVG}><rect x="4.5" y="11" width="15" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;
const LOCK_OPEN   = `<svg ${SVG}><rect x="4.5" y="11" width="15" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-1.9"/></svg>`;
const PLUG_SVG    = `<svg ${SVG}><path d="M9 2v6M15 2v6M7 8h10v3a5 5 0 0 1-10 0V8zM12 16v6"/></svg>`;
const CLOSE_SVG   = `<svg ${SVG}><path d="M6 6l12 12M18 6L6 18"/></svg>`;

export function openHomeOverlay(source, actions = null) {
  const host = document.createElement('div');
  host.className = 'home-overlay';
  document.body.appendChild(host);

  let data = clone(source.initial);
  let pinMode = false;     // lock tile showing the PIN pad
  let pin = '';
  let lockError = '';      // shown under the pad after a failed unlock
  let busy = false;        // a lock/unlock request is in flight

  function draw() {
    host.innerHTML = render(data, { pinMode, pin, lockError, busy });
  }

  function close() {
    document.removeEventListener('keydown', onKey);
    host.remove();
  }

  function onKey(e) {
    if (e.key === 'Escape') { if (pinMode) { exitPin(); draw(); } else close(); }
    if (pinMode && /^[0-9]$/.test(e.key)) { pushDigit(e.key); }
    if (pinMode && e.key === 'Backspace') { pin = pin.slice(0, -1); draw(); }
    if (pinMode && e.key === 'Enter') { submitUnlock(); }
  }

  function exitPin() { pinMode = false; pin = ''; lockError = ''; }

  function pushDigit(d) {
    if (pin.length >= 8) return;
    pin += d;
    lockError = '';
    draw();
  }

  // Optimistic plug toggle: flip now, revert if the backend rejects.
  function togglePlug(id) {
    const before = clone(data);
    data.plugs = data.plugs.map(p => p.id === id ? { ...p, on: !p.on } : p);
    draw();
    const next = data.plugs.find(p => p.id === id);
    actions?.setPlug(id, next.on).catch(() => { data = before; draw(); });
  }

  // Lock is safe — no PIN, optimistic.
  function lockDoor() {
    if (busy) return;
    const before = clone(data);
    data.lock = { ...data.lock, state: 'locked' };
    draw();
    actions?.setLock('lock').catch(() => { data = before; draw(); });
  }

  function submitUnlock() {
    if (busy || pin.length < PIN_MIN) return;
    const entered = pin;
    if (!actions) {
      // Local-mock mode: any PIN of valid length opens the door.
      data.lock = { ...data.lock, state: 'unlocked' };
      exitPin();
      draw();
      return;
    }
    busy = true; draw();
    actions.setLock('unlock', entered)
      .then(() => { data.lock = { ...data.lock, state: 'unlocked' }; busy = false; exitPin(); draw(); })
      .catch((err) => {
        busy = false;
        pin = '';
        lockError = friendlyLockError(err);
        draw();
      });
  }

  host.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]');
    if (!t) {
      // Click on the backdrop (outside the panel) closes.
      if (e.target === host && !pinMode) close();
      return;
    }
    const action = t.dataset.action;
    if (action === 'close') return close();
    if (action === 'toggle-plug') return togglePlug(t.dataset.id);
    if (action === 'lock') return lockDoor();
    if (action === 'ask-unlock') { pinMode = true; pin = ''; lockError = ''; return draw(); }
    if (action === 'pin-cancel') { exitPin(); return draw(); }
    if (action === 'pin-digit') return pushDigit(t.dataset.digit);
    if (action === 'pin-back') { pin = pin.slice(0, -1); lockError = ''; return draw(); }
    if (action === 'pin-submit') return submitUnlock();
  });

  document.addEventListener('keydown', onKey);
  draw();
  source.live.then(d => { if (d) { data = clone(d); draw(); } });

  return close;
}

// ───── pure render ─────

export function render(data, ui = {}) {
  const { pinMode = false, pin = '', lockError = '', busy = false } = ui;
  return `
    <div class="home-panel" role="dialog" aria-label="Home controls">
      <div class="home__header">
        <h2 class="home__title">Home</h2>
        <button class="home__close" data-action="close" aria-label="Close">${CLOSE_SVG}</button>
      </div>
      ${renderLock(data.lock, { pinMode, pin, lockError, busy })}
      <div class="home__plugs">
        ${data.plugs.map(renderPlug).join('')}
      </div>
    </div>
  `;
}

function renderLock(lock, { pinMode, pin, lockError, busy }) {
  const locked = lock.state === 'locked';
  const jammed = lock.state === 'jammed';
  const stateLabel = jammed ? 'Jammed' : locked ? 'Locked' : lock.state === 'unlocked' ? 'Unlocked' : 'Unknown';
  const icon = locked || jammed ? LOCK_CLOSED : LOCK_OPEN;

  return `
    <div class="home-tile home-tile--lock ${locked ? 'is-locked' : 'is-unlocked'} ${jammed ? 'is-jammed' : ''}">
      <div class="home-tile__lead">
        <span class="home-tile__icon">${icon}</span>
        <div class="home-tile__labels">
          <span class="home-tile__name">${escapeHtml(lock.name)}</span>
          <span class="home-tile__state">${stateLabel}${battery(lock.battery)}</span>
        </div>
      </div>
      ${pinMode ? renderPinpad(pin, lockError, busy) : `
        <div class="home-tile__control">
          ${locked
            ? `<button class="home-btn home-btn--unlock" data-action="ask-unlock">Unlock</button>`
            : `<button class="home-btn home-btn--lock" data-action="lock" ${busy ? 'disabled' : ''}>Lock</button>`}
        </div>
      `}
    </div>
  `;
}

function renderPinpad(pin, lockError, busy) {
  const dots = Array.from({ length: 6 }, (_, i) =>
    `<span class="pinpad__dot ${i < pin.length ? 'is-filled' : ''}"></span>`).join('');
  const keys = ['1','2','3','4','5','6','7','8','9'].map(d =>
    `<button class="pinpad__key" data-action="pin-digit" data-digit="${d}">${d}</button>`).join('');
  return `
    <div class="pinpad ${lockError ? 'has-error' : ''}">
      <div class="pinpad__prompt">${lockError ? escapeHtml(lockError) : 'Enter PIN to unlock'}</div>
      <div class="pinpad__dots">${dots}</div>
      <div class="pinpad__keys">
        ${keys}
        <button class="pinpad__key pinpad__key--text" data-action="pin-cancel">Cancel</button>
        <button class="pinpad__key" data-action="pin-digit" data-digit="0">0</button>
        <button class="pinpad__key pinpad__key--text" data-action="pin-back" aria-label="Delete">⌫</button>
      </div>
      <button class="home-btn home-btn--unlock pinpad__submit" data-action="pin-submit"
        ${pin.length < PIN_MIN || busy ? 'disabled' : ''}>${busy ? 'Unlocking…' : 'Unlock'}</button>
    </div>
  `;
}

function renderPlug(plug) {
  return `
    <button class="home-tile home-tile--plug ${plug.on ? 'is-on' : 'is-off'}"
      data-action="toggle-plug" data-id="${escapeHtml(plug.id)}"
      role="switch" aria-checked="${plug.on}">
      <span class="home-tile__icon">${PLUG_SVG}</span>
      <span class="home-tile__name">${escapeHtml(plug.name)}</span>
      <span class="home-tile__switch"><span class="home-tile__knob"></span></span>
    </button>
  `;
}

function battery(pct) {
  if (pct == null) return '';
  const low = pct <= 20 ? ' home-tile__battery--low' : '';
  return ` · <span class="home-tile__battery${low}">${pct}%</span>`;
}

function friendlyLockError(err) {
  const r = (err && err.reason) || '';
  if (/locked out|too many|rate/i.test(r)) return 'Too many tries — locked out. Wait and retry.';
  if (/pin|unauthor|invalid/i.test(r)) return 'Wrong PIN.';
  return 'Unlock failed. Try again.';
}

function clone(x) { return JSON.parse(JSON.stringify(x)); }

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
