// Client for /api/mabel — the CF Pages Function that proxies huckleberry-mcp's
// read-only dashboard endpoint. Returns the same shape the widget already
// expects from the mock: { childName, birthDate, events: [{ type, at }] }.
//
// Configuration (Vite env var):
//   VITE_DASHBOARD_TOKEN  shared bearer between dashboard and CF Function
//
// Falls back to mock data when unset or when fetch fails — so the widget
// always renders something on the wall.

import { getMockMabel } from './mabel-mock.js';

const TOKEN = import.meta.env.VITE_DASHBOARD_TOKEN;
const CACHE_KEY = 'mabel:v1';
const CACHE_TTL_MS = 5 * 60 * 1000;

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

export async function fetchMabel() {
  if (!TOKEN) throw new Error('VITE_DASHBOARD_TOKEN not set');
  const res = await fetch('/api/mabel', {
    headers: { authorization: `Bearer ${TOKEN}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`mabel: ${res.status}`);
  const data = await res.json();
  writeCache(data);
  return data;
}

// Same { initial, live } contract as getWeather / getPhotos / getTodos.
export function getMabel() {
  const cached = readCache();
  const initial = cached ?? getMockMabel();
  const live = TOKEN
    ? fetchMabel().catch(() => initial)
    : Promise.resolve(initial);
  return { initial, live };
}

export const isConfigured = Boolean(TOKEN);
