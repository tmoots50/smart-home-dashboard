// Client for the /api/headlines CF Pages Function. Mirrors lib/calendar.js:
// returns {initial, live} with mock fallback + localStorage cache so the card
// is never blank during dev or short outages.

import { getMockHeadlines } from './headlines-mock.js';

const TOKEN = import.meta.env.VITE_DASHBOARD_TOKEN;
const CACHE_KEY = 'headlines:v1';
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

export async function fetchHeadlines() {
  const res = await fetch('/api/headlines', {
    headers: { authorization: `Bearer ${TOKEN}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`headlines: ${res.status}`);
  const data = await res.json();
  if (!data.items?.length) throw new Error('headlines: empty');
  writeCache(data.items);
  return data.items;
}

export function getHeadlines() {
  const cached = readCache();
  const initial = cached ?? getMockHeadlines();
  const live = TOKEN
    ? fetchHeadlines().catch(() => initial)
    : Promise.resolve(initial);
  return { initial, live };
}

export const isConfigured = Boolean(TOKEN);
