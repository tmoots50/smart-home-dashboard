// Client for the /api/calendar CF Pages Function. Returns the same shape as
// calendar-mock.js so the widget doesn't care which source it's rendering.
//
// Falls back to mock when no token is configured, when the fetch fails, or
// when the endpoint returns no sections — so the dashboard never has a blank
// calendar card during dev / outages.

import { getMockCalendar, getMockUpcoming, getMockMonth } from './calendar-mock.js';

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

const canonicalLabel = (label) => String(label ?? '').trim().toLowerCase() === 'caroline' ? 'Family' : String(label ?? '').trim();

export function canonicalizeCalendarData(data) {
  const grouped = new Map();
  for (const section of data?.sections ?? []) {
    const label = canonicalLabel(section.label);
    grouped.set(label, [...(grouped.get(label) ?? []), ...(section.events ?? [])]);
  }
  return {
    ...data,
    sections: [...grouped].map(([label, events]) => ({
      label,
      events: events.sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt))),
    })),
  };
}

export function canonicalizeUpcoming(events) {
  return (events ?? []).map(event => ({ ...event, calendar: canonicalLabel(event.calendar) }));
}

export async function fetchCalendar() {
  const res = await fetch('/api/calendar', {
    headers: { authorization: `Bearer ${TOKEN}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`calendar: ${res.status}`);
  const data = canonicalizeCalendarData(await res.json());
  if (!data.sections?.length) throw new Error('calendar: no sections');
  writeCache(data);
  return data;
}

// Same {initial, live} contract as getWeather / getPhotos.
export function getCalendar() {
  const cached = readCache();
  const initial = canonicalizeCalendarData(cached ?? getMockCalendar());
  const live = TOKEN
    ? fetchCalendar().catch(() => initial)
    : Promise.resolve(initial);
  return { initial, live };
}

// ── expanded overlay: wide window, all calendars, all-day included ──

const UPCOMING_TTL_MS = 5 * 60 * 1000;
const upcomingKey = (days) => `calendar:upcoming:${days}:v1`;

export async function fetchUpcoming(days = 7) {
  const res = await fetch(`/api/calendar/upcoming?days=${days}`, {
    headers: { authorization: `Bearer ${TOKEN}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`calendar upcoming: ${res.status}`);
  const data = await res.json();
  const events = canonicalizeUpcoming(data.events || []);
  try { localStorage.setItem(upcomingKey(days), JSON.stringify({ at: Date.now(), data: events })); } catch {}
  return events;
}

export function getUpcoming(days = 7) {
  let cached = null;
  try {
    const raw = localStorage.getItem(upcomingKey(days));
    if (raw) {
      const { at, data } = JSON.parse(raw);
      if (Date.now() - at <= UPCOMING_TTL_MS) cached = data;
    }
  } catch { /* fall through to mock */ }
  const initial = canonicalizeUpcoming(cached ?? getMockUpcoming());
  const live = TOKEN
    ? fetchUpcoming(days).catch(() => initial)
    : Promise.resolve(initial);
  return { initial, live };
}

// ── month view: arbitrary month windows via timeMin/timeMax ──

const MONTH_TTL_MS = 5 * 60 * 1000;
const monthKey = (year, month) => `calendar:month:${year}-${String(month + 1).padStart(2, '0')}:v1`;

// `month` is 0-based (Date convention). Window = [first of month, first of
// next month) in LOCAL time, so all-day events land on the right cells.
export async function fetchMonth(year, month) {
  const timeMin = new Date(year, month, 1).toISOString();
  const timeMax = new Date(year, month + 1, 1).toISOString();
  const res = await fetch(`/api/calendar/upcoming?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`, {
    headers: { authorization: `Bearer ${TOKEN}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`calendar month: ${res.status}`);
  const data = await res.json();
  const events = canonicalizeUpcoming(data.events || []);
  try { localStorage.setItem(monthKey(year, month), JSON.stringify({ at: Date.now(), data: events })); } catch {}
  return events;
}

export function getMonth(year, month) {
  let cached = null;
  try {
    const raw = localStorage.getItem(monthKey(year, month));
    if (raw) {
      const { at, data } = JSON.parse(raw);
      if (Date.now() - at <= MONTH_TTL_MS) cached = data;
    }
  } catch { /* fall through to mock */ }
  const initial = canonicalizeUpcoming(cached ?? getMockMonth(year, month));
  const live = TOKEN
    ? fetchMonth(year, month).catch(() => initial)
    : Promise.resolve(initial);
  return { initial, live };
}

export const isConfigured = Boolean(TOKEN);
