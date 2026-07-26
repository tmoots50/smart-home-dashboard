// Client for /api/brief — the Morning Brief blob Hermes posts daily ~7:30a.
// Returns {initial, live} like every lib adapter.
//
// Trust model matches lib/curated.js getComingUp, NOT getPicks: when a blob
// exists it is the truth; when there's no blob for today (or the fetch
// fails with no cache) the answer is null and the card hides. We never
// substitute a mock in production — a fabricated "briefing" on the wall is
// actively worse than no card. The mock serves dev only (no token set).

import { getMockDaybrief } from './daybrief-mock.js';

const TOKEN = import.meta.env.VITE_DASHBOARD_TOKEN;
const CACHE_KEY = 'daybrief:v1';
const CACHE_TTL_MS = 30 * 60 * 1000;

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

export async function fetchDaybrief() {
  const res = await fetch('/api/brief', {
    headers: { authorization: `Bearer ${TOKEN}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`brief: ${res.status}`);
  const data = await res.json();
  if (!data.date) return null; // Hermes hasn't posted yet — hide, don't invent
  writeCache(data);
  return data;
}

export function getDaybrief() {
  if (!TOKEN) {
    const mock = getMockDaybrief();
    return { initial: mock, live: Promise.resolve(mock) };
  }
  const initial = readCache(); // may be null → card stays hidden until live lands
  const live = fetchDaybrief().catch(() => initial);
  return { initial, live };
}

export const isConfigured = Boolean(TOKEN);
