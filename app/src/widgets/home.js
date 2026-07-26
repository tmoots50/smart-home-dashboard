// Home control overlay — the smart-home surface. Opened from the action-bar
// "home" button. Shows the Aqara U100 lock (one-tap lock/unlock), four scene
// modes that set the lamps in one tap, and a collapsed list of the individual
// plug toggles.
//
// `actions` (optional) wires mutations to the backend (lib/home.js → /api/home*).
// When passed, plug toggles + lock/unlock persist and revert the optimistic
// update on failure. When null (pure demo), the overlay mutates local state only.
//
// The lock is a plain toggle — no PIN. Unlock is treated like any other device
// action: optimistic, and reverted if the backend rejects it.
//
// Scenes only touch LAMP devices (see isLamp); a non-lamp plug added later (a
// coffee maker, say) is never changed by a scene. Targets are matched on the
// device's display name, case-insensitively, so renaming a lamp in Home
// Assistant keeps the scenes working. Reorder/retune MODES freely.

const SVG = 'viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
const LOCK_CLOSED = `<svg ${SVG}><rect x="4.5" y="11" width="15" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;
const LOCK_OPEN   = `<svg ${SVG}><rect x="4.5" y="11" width="15" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-1.9"/></svg>`;
const PLUG_SVG    = `<svg ${SVG}><path d="M9 2v6M15 2v6M7 8h10v3a5 5 0 0 1-10 0V8zM12 16v6"/></svg>`;
const CLOSE_SVG   = `<svg ${SVG}><path d="M6 6l12 12M18 6L6 18"/></svg>`;
const CHEV_SVG    = `<svg ${SVG}><path d="M6 9l6 6 6-6"/></svg>`;

// Scene icons.
const SUN_SVG    = `<svg ${SVG}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>`;
const DUSK_SVG   = `<svg ${SVG}><path d="M3 18h18M6.5 18a5.5 5.5 0 0 1 11 0M12 3v3M4 9l1.5 1.5M20 9l-1.5 1.5"/></svg>`;
const MOON_SVG   = `<svg ${SVG}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;
// Baby face (Lucide "baby"). The eye dots are near-zero `h.01` strokes that
// render as dots thanks to the shared stroke-linecap="round" — reads clearly as
// a baby at 24px, where the old bottle glyph looked like a thermometer.
const BABY_SVG = `<svg ${SVG}><path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/></svg>`;

const isLamp  = (p) => /lamp|light/i.test(p.id) || /lamp|light/i.test(p.name);
const nameHas = (p, kw) => new RegExp(kw, 'i').test(p.name);

// Each scene returns the desired `on` state for a given lamp.
const MODES = [
  { id: 'morning', label: 'Morning', icon: SUN_SVG,    want: () => true },
  { id: 'evening', label: 'Evening', icon: DUSK_SVG,   want: (p) => !nameHas(p, 'den') }, // all lamps on except Den
  { id: 'baby',    label: 'Baby',    icon: BABY_SVG,   want: (p) => nameHas(p, 'left') }, // only Left lamp on
  { id: 'night',   label: 'Night',   icon: MOON_SVG,   want: () => false },
];

export function openHomeOverlay(source, actions = null) {
  const host = document.createElement('div');
  host.className = 'home-overlay';
  document.body.appendChild(host);

  let data = clone(source.initial);
  const ui = { plugsOpen: false };  // the individual-toggle list starts collapsed

  function draw() {
    host.innerHTML = render(data, ui);
  }

  function close() {
    document.removeEventListener('keydown', onKey);
    host.remove();
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  // Optimistic plug toggle: flip now, revert if the backend rejects.
  function togglePlug(id) {
    const before = clone(data);
    data.plugs = data.plugs.map(p => p.id === id ? { ...p, on: !p.on } : p);
    draw();
    const next = data.plugs.find(p => p.id === id);
    actions?.setPlug(id, next.on).catch(() => { data = before; draw(); });
  }

  // Lock/unlock: one-tap, optimistic, revert on failure. No PIN.
  function setLock(next) {
    const before = clone(data);
    data.lock = { ...data.lock, state: next };
    draw();
    actions?.setLock(next === 'locked' ? 'lock' : 'unlock')
      .catch(() => { data = before; draw(); });
  }

  // Apply a scene: set every lamp to its wanted state in one shot, optimistic.
  // Non-lamp plugs are left alone. Reverts the whole set if any call fails.
  function applyMode(mode) {
    if (!mode) return;
    const before = clone(data);
    const changed = [];
    data.plugs = data.plugs.map(p => {
      if (!isLamp(p)) return p;
      const want = mode.want(p);
      if (want !== p.on) changed.push({ id: p.id, on: want });
      return { ...p, on: want };
    });
    draw();
    if (actions && changed.length) {
      Promise.all(changed.map(c => actions.setPlug(c.id, c.on)))
        .catch(() => { data = before; draw(); });
    }
  }

  host.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]');
    if (!t) {
      // Click on the backdrop (outside the panel) closes.
      if (e.target === host) close();
      return;
    }
    const action = t.dataset.action;
    if (action === 'close') return close();
    if (action === 'toggle-plug') return togglePlug(t.dataset.id);
    if (action === 'toggle-plugs') { ui.plugsOpen = !ui.plugsOpen; return draw(); }
    if (action === 'mode') return applyMode(MODES.find(m => m.id === t.dataset.mode));
    if (action === 'lock') return setLock('locked');
    if (action === 'unlock') return setLock('unlocked');
  });

  document.addEventListener('keydown', onKey);
  draw();
  source.live.then(d => { if (d) { data = clone(d); draw(); } });

  return close;
}

// ───── pure render ─────

export function render(data, ui = {}) {
  const { plugsOpen = false } = ui;
  return `
    <div class="home-panel" role="dialog" aria-label="Home controls">
      <div class="home__header">
        <h2 class="home__title">Home</h2>
        <button class="home__close" data-action="close" aria-label="Close">${CLOSE_SVG}</button>
      </div>
      ${renderLock(data.lock)}
      ${renderModes()}
      ${renderDevices(data.plugs, plugsOpen)}
    </div>
  `;
}

function renderLock(lock) {
  const locked = lock.state === 'locked';
  const jammed = lock.state === 'jammed';
  const unlocked = lock.state === 'unlocked';
  const stateLabel = jammed ? 'Jammed' : locked ? 'Locked' : unlocked ? 'Unlocked' : 'Unknown';
  const icon = locked || jammed ? LOCK_CLOSED : LOCK_OPEN;

  return `
    <div class="home-tile home-tile--lock ${locked ? 'is-locked' : unlocked ? 'is-unlocked' : ''} ${jammed ? 'is-jammed' : ''}">
      <div class="home-tile__lead">
        <span class="home-tile__icon">${icon}</span>
        <div class="home-tile__labels">
          <span class="home-tile__name">${escapeHtml(lock.name)}</span>
          <span class="home-tile__state">${stateLabel}${battery(lock.battery)}</span>
        </div>
      </div>
      <div class="home-tile__control">
        <span class="home-lock-toggle" role="group" aria-label="Lock ${escapeHtml(lock.name)}">
          <button class="home-lock-btn" data-action="lock" aria-label="Lock" aria-pressed="${locked || jammed}">
            ${LOCK_CLOSED}
          </button>
          <button class="home-lock-btn" data-action="unlock" aria-label="Unlock" aria-pressed="${unlocked}">
            ${LOCK_OPEN}
          </button>
        </span>
      </div>
    </div>
  `;
}

function renderModes() {
  return `
    <div class="home__modes">
      ${MODES.map(m => `
        <button class="home-mode home-mode--${m.id}" data-action="mode" data-mode="${m.id}">
          <span class="home-mode__icon">${m.icon}</span>
          <span class="home-mode__label">${escapeHtml(m.label)}</span>
        </button>
      `).join('')}
    </div>
  `;
}

function renderDevices(plugs, open) {
  return `
    <div class="home__devices ${open ? 'is-open' : ''}">
      <button class="home__devices-toggle" data-action="toggle-plugs" aria-expanded="${open}">
        <span class="home__devices-title">Devices</span>
        <span class="home__devices-count">${plugs.length}</span>
        <span class="home__devices-chev">${CHEV_SVG}</span>
      </button>
      ${open ? `<div class="home__plugs">${plugs.map(renderPlug).join('')}</div>` : ''}
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

function clone(x) { return JSON.parse(JSON.stringify(x)); }

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
