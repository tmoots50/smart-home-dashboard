// Client for the /api/calendar CF Pages Function. Returns the same shape as
// calendar-mock.js so the widget doesn't care which source it's rendering.
//
// Fallback order when there's no fresh live fetch yet (see chooseFallback):
//   fresh cache → last-known REAL cache (serve-stale, up to STALE_MAX_MS) →
//   empty on a configured wall → bundled mock ONLY in tokenless dev.
// The bundled mock must NEVER reach a wall that has a token: a transient fetch
// failure at reload time would otherwise repaint retired placeholder events
// over the real calendar until the next successful poll (the 2026-08 "calendar
// keeps switching to old placeholders" bug). getMonth already followed this
// rule; getCalendar/getUpcoming/getRange now do too, via upcomingSource.

import { getMockCalendar, getMockUpcoming, getMockMonth } from './calendar-mock.js';

const TOKEN = import.meta.env.VITE_DASHBOARD_TOKEN;
const CACHE_KEY = 'calendar:v1';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5min — calendar changes more often than weather/photos
// On a failed fetch, serve the last-known REAL cache this far back rather than
// blanking (mirrors the ICS layer's serve-stale backstop). Slightly-stale real
// events beat an empty wall; past events self-drop from the windowed views.
const STALE_MAX_MS = 24 * 60 * 60 * 1000;
const EMPTY_CALENDAR = { sections: [], nextEventId: null };

// Read a cache entry, classifying it two ways: `fresh` (< ttl → paint it now,
// no waiting) and `stale` (< STALE_MAX_MS → usable only as a fetch-failure
// fallback). Either can be null.
function readCached(key, ttl) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { fresh: null, stale: null };
    const { at, data } = JSON.parse(raw);
    const age = Date.now() - at;
    return { fresh: age <= ttl ? data : null, stale: age <= STALE_MAX_MS ? data : null };
  } catch { return { fresh: null, stale: null }; }
}

function writeCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data })); }
  catch {}
}

// The anti-mock rule in one place. Prefer real data we already have (even if
// stale) over anything synthetic; fall to bundled mock ONLY when there's no
// token at all (local dev). Pure + exported so the rule is unit-tested directly
// — module load captures TOKEN, so callers pass `hasToken` in rather than the
// test trying to flip a const after import.
export function chooseFallback(staleReal, { hasToken, empty, mock }) {
  if (staleReal) return staleReal;
  return hasToken ? empty : mock();
}

// Shared {initial, live} builder for the array-shaped feeds (upcoming / range /
// month). Fresh cache paints immediately; a missing-or-stale cache and every
// fetch failure route through chooseFallback, so mock never reaches a wall with
// a token. `fetcher` writes the cache + canonicalizes on success.
function upcomingSource(key, ttl, fetcher, mock) {
  const { fresh, stale } = readCached(key, ttl);
  const fallback = () => canonicalizeUpcoming(
    chooseFallback(stale, { hasToken: !!TOKEN, empty: [], mock }));
  const initial = fresh ? canonicalizeUpcoming(fresh) : fallback();
  const live = TOKEN ? fetcher().catch(fallback) : Promise.resolve(initial);
  return { initial, live };
}

// Sections and events are now keyed by PERSON server-side (a person's work +
// personal calendars merge into one column). The old 'Caroline'→'Family' alias
// is retired: Caroline is a real, distinct person once her Outlook feed is
// wired. These canonicalizers now just tidy labels and backfill `person` for
// any legacy/mock event that predates the field.
const canonicalLabel = (label) => String(label ?? '').trim();

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
  return (events ?? []).map(event => ({
    ...event,
    calendar: canonicalLabel(event.calendar),
    // Overlay/coming-up group by person; default it to the calendar label so
    // events from before the multi-source split still land in a column.
    person: canonicalLabel(event.person ?? event.calendar),
  }));
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
  const { fresh, stale } = readCached(CACHE_KEY, CACHE_TTL_MS);
  const fallback = () => canonicalizeCalendarData(
    chooseFallback(stale, { hasToken: !!TOKEN, empty: EMPTY_CALENDAR, mock: getMockCalendar }));
  const initial = fresh ? canonicalizeCalendarData(fresh) : fallback();
  const live = TOKEN ? fetchCalendar().catch(fallback) : Promise.resolve(initial);
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
  return upcomingSource(upcomingKey(days), UPCOMING_TTL_MS,
    () => fetchUpcoming(days), () => getMockUpcoming());
}

// ── rolling window: an explicit [timeMin, timeMax) range (the week grid) ──
//
// Same timeMin/timeMax backend path as the month view, but keyed by the ISO
// range so windows cache independently. The week grid fetches one wide range up
// front and slices it client-side per 5-day window, so ‹ › paging never hits
// the network (no flicker). Falls back to mock/empty exactly like getUpcoming.

const RANGE_TTL_MS = 5 * 60 * 1000;
const rangeKey = (timeMin, timeMax) => `calendar:range:${timeMin}:${timeMax}:v1`;

export async function fetchRange(timeMin, timeMax) {
  const res = await fetch(`/api/calendar/upcoming?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`, {
    headers: { authorization: `Bearer ${TOKEN}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`calendar range: ${res.status}`);
  const data = await res.json();
  const events = canonicalizeUpcoming(data.events || []);
  try { localStorage.setItem(rangeKey(timeMin, timeMax), JSON.stringify({ at: Date.now(), data: events })); } catch {}
  return events;
}

export function getRange(timeMin, timeMax) {
  return upcomingSource(rangeKey(timeMin, timeMax), RANGE_TTL_MS,
    () => fetchRange(timeMin, timeMax), () => getMockUpcoming());
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

// Uncached month + real backend: serve EMPTY (or last-known real), never mock —
// flashing fake events read as a double page-load on the wall (2026-07-11
// feedback). Mock stays for tokenless dev so the grid isn't blank. This rule now
// lives in upcomingSource, shared with getUpcoming/getRange (2026-08).
export function getMonth(year, month) {
  return upcomingSource(monthKey(year, month), MONTH_TTL_MS,
    () => fetchMonth(year, month), () => getMockMonth(year, month));
}

export const isConfigured = Boolean(TOKEN);
