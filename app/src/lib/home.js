// Client for the /api/home* CF Pages Functions, which proxy Home Assistant (the
// Functions hold the HA long-lived token + reach HA over Cloudflare Tunnel; the
// dashboard never sees HA credentials). Same {initial, live} + actions contract
// as tasks.js / calendar.js.
//
// Two-flag configuration (Vite env vars):
//   VITE_DASHBOARD_TOKEN  shared bearer token (read + plug toggles)
//   VITE_HOME_LIVE        '1' once HA is stood up and /api/home* are live
//
// Until VITE_HOME_LIVE is set, `actions` is null and the overlay runs on local
// mock state (toggles stick locally, unlock accepts any PIN) — a full UX demo
// before the Pi/HA exist. Flip VITE_HOME_LIVE=1 + set the CF env vars to go live.

import { getMockHome } from './home-mock.js';

const TOKEN = import.meta.env.VITE_DASHBOARD_TOKEN;
const LIVE = import.meta.env.VITE_HOME_LIVE === '1';
const CACHE_KEY = 'home:v1';
const CACHE_TTL_MS = 30 * 1000; // device state goes stale fast; short TTL

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw);
    if (Date.now() - at > CACHE_TTL_MS) return null;
    return data;
  } catch { return null; }
}
function writeCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data })); }
  catch {}
}

async function request(path, opts = {}) {
  if (!TOKEN) throw new Error('VITE_DASHBOARD_TOKEN not set');
  const res = await fetch(path, {
    ...opts,
    cache: 'no-store',
    headers: {
      ...(opts.headers || {}),
      authorization: `Bearer ${TOKEN}`,
      ...(opts.body ? { 'content-type': 'application/json' } : {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const err = new Error(`home ${path}: ${res.status} ${detail}`);
    err.status = res.status;
    // Surface a friendlier reason for the unlock UI (wrong PIN vs locked out).
    try { err.reason = JSON.parse(detail).error; } catch {}
    throw err;
  }
  return res.json();
}

export async function fetchHome() {
  const data = await request('/api/home');
  writeCache(data);
  return data;
}

// Toggle a plug. Low-consequence, authorized by the read token.
export async function setPlug(id, on) {
  return request('/api/home/plug', { method: 'POST', body: JSON.stringify({ id, on }) });
}

// Lock (no PIN) or unlock (PIN required, verified server-side). `pin` is sent in
// the body over HTTPS and never stored client-side.
export async function setLock(action, pin) {
  const body = action === 'unlock' ? { action, pin } : { action };
  return request('/api/home/lock', { method: 'POST', body: JSON.stringify(body) });
}

// Same {initial, live} contract as getTodos / getCalendar.
export function getHome() {
  const cached = readCache();
  const initial = cached ?? getMockHome();
  const live = (TOKEN && LIVE)
    ? fetchHome().catch(() => initial)
    : Promise.resolve(initial);
  return { initial, live };
}

// null until HA is live — the overlay treats null actions as local-mock mode.
export const actions = (TOKEN && LIVE) ? { setPlug, setLock } : null;
export const isConfigured = Boolean(TOKEN && LIVE);
