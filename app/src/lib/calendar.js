// Client for the /api/calendar CF Pages Function. Returns the same shape as
// calendar-mock.js so the widget doesn't care which source it's rendering.
//
// Falls back to mock when no token is configured, when the fetch fails, or
// when the endpoint returns no sections — so the dashboard never has a blank
// calendar card during dev / outages.

import { getMockCalendar } from './calendar-mock.js';

const TOKEN = import.meta.env.VITE_DASHBOARD_TOKEN;
const CACHE_KEY = 'calendar:v1';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5min — calendar changes more often than weather/photos

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

export async function fetchCalendar() {
  const res = await fetch('/api/calendar', {
    headers: { authorization: `Bearer ${TOKEN}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`calendar: ${res.status}`);
  const data = await res.json();
  if (!data.sections?.length) throw new Error('calendar: no sections');
  writeCache(data);
  return data;
}

// Same {initial, live} contract as getWeather / getPhotos.
export function getCalendar() {
  const cached = readCache();
  const initial = cached ?? getMockCalendar();
  const live = TOKEN
    ? fetchCalendar().catch(() => initial)
    : Promise.resolve(initial);
  return { initial, live };
}

export const isConfigured = Boolean(TOKEN);
