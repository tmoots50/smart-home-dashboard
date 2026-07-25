// Client for the /api/home* CF Pages Functions, which proxy Home Assistant (the
// Functions hold the HA long-lived token + reach HA over Cloudflare Tunnel; the
// dashboard never sees HA credentials). Same {initial, live} + actions contract
// as tasks.js / calendar.js.
//
// Two-flag configuration (Vite env vars):
//   VITE_DASHBOARD_TOKEN  shared bearer token (read + plug toggles)
//   VITE_HOME_LIVE        '1' once HA is stood up and /api/home* are live
//
// Until VITE_HOME_LIVE is set the widgets run against a PERSISTED mock: toggle
// and lock state stick in localStorage (a demo lamp that resets itself reads as
// broken). `actions` is therefore never null — mock mode just routes them to
// localStorage instead of the API.
//
// The device registry ("add smart stuff I buy") is real even before HA lives:
// with a token, adds go to the HOME_DEVICES KV via /api/home/devices, so staged
// devices survive and appear on every screen at HA go-live. With no token
// (pure local dev) the registry falls back to localStorage.

import { getMockHome } from './home-mock.js';

const TOKEN = import.meta.env.VITE_DASHBOARD_TOKEN;
const LIVE = import.meta.env.VITE_HOME_LIVE === '1';
const LIVE_MODE = Boolean(TOKEN && LIVE);

const CACHE_KEY = 'home:v1';
const CACHE_TTL_MS = 30 * 1000; // device state goes stale fast; short TTL
const MOCK_STATE_KEY = 'home:mock-state:v1';
const LOCAL_DEVICES_KEY = 'home:devices:v1';

function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function readCache() {
  const raw = readJson(CACHE_KEY);
  if (!raw) return null;
  if (Date.now() - raw.at > CACHE_TTL_MS) return null;
  return raw.data;
}
function writeCache(data) {
  writeJson(CACHE_KEY, { at: Date.now(), data });
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

// Lock or unlock the deadbolt. No PIN — the door is reachable only from the home
// network (wall tablet / HA over Cloudflare Tunnel), so unlock is a plain action.
export async function setLock(action) {
  return request('/api/home/lock', { method: 'POST', body: JSON.stringify({ action }) });
}

// ───── mock layer (persisted demo state until HA is live) ─────

function mockState() {
  return readJson(MOCK_STATE_KEY) ?? { lock: null, plugs: {} };
}

function localDevices() {
  const arr = readJson(LOCAL_DEVICES_KEY);
  return Array.isArray(arr) ? arr : [];
}

// Base mock + persisted toggles + registered devices, in one frame.
function mockHome(registry = localDevices()) {
  const base = getMockHome();
  const state = mockState();
  return {
    lock: { ...base.lock, state: state.lock ?? base.lock.state },
    plugs: [
      ...base.plugs.map(p => ({ ...p, on: state.plugs[p.id] ?? p.on, custom: false })),
      ...registry
        .filter(d => !base.plugs.some(p => p.id === d.id))
        .map(d => ({ ...d, on: state.plugs[d.id] ?? false, custom: true })),
    ],
  };
}

const mockActions = {
  async setPlug(id, on) {
    const state = mockState();
    writeJson(MOCK_STATE_KEY, { ...state, plugs: { ...state.plugs, [id]: on } });
    return { ok: true, id, on };
  },
  async setLock(action) {
    writeJson(MOCK_STATE_KEY, { ...mockState(), lock: action === 'unlock' ? 'unlocked' : 'locked' });
    return { state: action === 'unlock' ? 'unlocked' : 'locked' };
  },
};

// Pull the shared KV registry into the mock frame (pre-HA, with a token the
// registry already lives server-side so every screen sees the same devices).
async function mockLive(initial) {
  if (!TOKEN) return initial;
  try {
    const { devices } = await request('/api/home/devices');
    writeJson(LOCAL_DEVICES_KEY, devices);
    return mockHome(devices);
  } catch {
    return initial;
  }
}

// ───── public surface ─────

// Same {initial, live} contract as getTodos / getCalendar.
export function getHome() {
  if (LIVE_MODE) {
    const cached = readCache();
    const initial = cached ?? mockHome();
    return { initial, live: fetchHome().catch(() => initial) };
  }
  const initial = mockHome();
  return { initial, live: mockLive(initial) };
}

// Never null — mock mode routes to persisted local state (see header).
export const actions = LIVE_MODE ? { setPlug, setLock } : mockActions;

// Registry mutations. With a token they hit the shared KV registry; otherwise
// they stay in this browser's localStorage.
export const deviceActions = {
  async add(device) {
    if (TOKEN) {
      const { devices } = await request('/api/home/devices', { method: 'POST', body: JSON.stringify(device) });
      writeJson(LOCAL_DEVICES_KEY, devices);
      return devices;
    }
    const devices = [...localDevices(), device];
    writeJson(LOCAL_DEVICES_KEY, devices);
    return devices;
  },
  async remove(id) {
    if (TOKEN) {
      const { devices } = await request('/api/home/devices', { method: 'DELETE', body: JSON.stringify({ id }) });
      writeJson(LOCAL_DEVICES_KEY, devices);
      return devices;
    }
    const devices = localDevices().filter(d => d.id !== id);
    writeJson(LOCAL_DEVICES_KEY, devices);
    return devices;
  },
};

export const isConfigured = LIVE_MODE;
