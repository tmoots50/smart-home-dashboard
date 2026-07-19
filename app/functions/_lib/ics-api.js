// ICS (iCalendar) calendar source — for calendars we can't reach through the
// Google token because they live on another provider. Today that's Caroline's
// Outlook work calendar, published from Outlook Web as an .ics URL and fetched
// here directly (NOT subscribed inside Google — that path lags 8–24h; a direct
// fetch refreshes on our own cadence). ICS sources are READ-ONLY: the publish
// URL is a one-way feed, so create/update/delete must be refused upstream.
//
// Configured via a single JSON env var, mirroring GOOGLE_CALENDARS_JSON:
//
//   ICS_CALENDARS_JSON='[{"label":"Caroline (Work)","url":"https://outlook.office365.com/.../calendar.ics","person":"Caroline","kind":"work"}]'
//
//   label  — source calendar name (used for chips, event-detail, Hermes)
//   url    — the published .ics feed
//   person — which wall column/section it merges into (defaults to label)
//   kind   — 'work' | 'personal' (defaults 'personal'); drives the work tag
//
// Recurrence, EXDATE, RECURRENCE-ID overrides, and Windows-named TZIDs
// (e.g. "Pacific Standard Time") are resolved by ical-expander via the ICS's
// embedded VTIMEZONE blocks. Verified running in the CF Pages (workerd) runtime.

import IcalExpander from 'ical-expander';
import { repairMojibake } from './calendar-api.js';

// Soft TTL: serve cache younger than this without refetching. Outlook's own
// publish cadence is hours, so 15 min never hides anything the feed would show,
// and it keeps the Hermes read path (and the wall's 5-min poll) off Outlook's
// endpoint on every hit.
const ICS_FRESH_MS = 15 * 60 * 1000;
// Hard backstop kept in KV so a persistently-down feed still serves its last
// good copy for a day (serve-stale) instead of blanking Caroline's column.
const ICS_KV_TTL_S = 24 * 60 * 60;
// Bound recurrence expansion. A 4-year ?all=1 window over a dense work calendar
// with several daily/weekly series can generate a lot of instances; this caps
// the work per feed. If it's ever hit we log — never silently truncate.
const ICS_MAX_ITERATIONS = 5000;

export function parseIcsCalendars(env) {
  const raw = env.ICS_CALENDARS_JSON;
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(c => c && typeof c.label === 'string' && typeof c.url === 'string')
      .map(c => ({
        label: String(c.label).trim(),
        url: c.url,
        person: (c.person && String(c.person).trim()) || String(c.label).trim(),
        kind: c.kind === 'work' ? 'work' : 'personal',
        readOnly: true,
      }));
  } catch {
    return [];
  }
}

// Is `label` one of the read-only ICS calendars? Write endpoints use this to
// return a clean 403 ("this calendar is display-only") instead of a confusing
// "unknown calendar" 404 — the calendar exists, it just can't be mutated.
export function icsCalendarFor(env, label) {
  const wanted = String(label ?? '').trim().toLowerCase();
  return parseIcsCalendars(env).find(c => c.label.toLowerCase() === wanted) ?? null;
}

// Fetch the raw ICS text for a feed, through a KV read-through cache when a
// binding is present. Fails soft: a fetch error falls back to the last good
// cached copy (serve-stale) and only throws when there's nothing cached.
async function getIcsText(env, url) {
  const kv = env.ICS_CACHE || null;
  const key = `ics:${url}`;
  let cached = null;
  if (kv) {
    try {
      const raw = await kv.get(key);
      if (raw) cached = JSON.parse(raw);
    } catch { /* corrupt/absent cache entry — treat as miss */ }
  }
  const now = Date.now();
  if (cached && typeof cached.at === 'number' && (now - cached.at) < ICS_FRESH_MS) {
    return cached.text;
  }

  let text;
  try {
    const res = await fetch(url, { headers: { accept: 'text/calendar, text/plain, */*' } });
    if (!res.ok) throw new Error(`ics fetch ${res.status}`);
    text = await res.text();
  } catch (err) {
    if (cached?.text) return cached.text; // serve-stale rather than blank the column
    throw err;
  }

  if (kv) {
    try { await kv.put(key, JSON.stringify({ at: now, text }), { expirationTtl: ICS_KV_TTL_S }); }
    catch { /* cache write is best-effort */ }
  }
  return text;
}

// Expand an ICS document into normalized events within [timeMin, timeMax].
// Output shape matches normalizeUpcoming() so the two sources merge seamlessly.
export function expandIcs(icsText, timeMin, timeMax, { label, person, kind, readOnly = true } = {}) {
  const expander = new IcalExpander({ ics: icsText, maxIterations: ICS_MAX_ITERATIONS });
  const { events, occurrences } = expander.between(new Date(timeMin), new Date(timeMax));

  const single = events.map(e => shape(e.uid, e.summary, e.location, e.description, e.startDate, e.endDate, false));
  const repeat = occurrences.map(o =>
    shape(o.item.uid, o.item.summary, o.item.location, o.item.description, o.startDate, o.endDate, true));

  return [...single, ...repeat]
    .filter(Boolean)
    .map(ev => ({ ...ev, calendar: label, person: person || label, kind: kind === 'work' ? 'work' : 'personal', readOnly }));

  // ICAL.Time → our shape. All-day events (startDate.isDate) render as bare
  // YYYY-MM-DD with an EXCLUSIVE end (matching Google's all-day convention, so
  // downstream range math is identical for both sources); timed events render
  // as absolute ISO instants (TZID already resolved via VTIMEZONE).
  function shape(uid, summary, location, description, startDate, endDate, recurring) {
    if (!startDate) return null;
    const allDay = !!startDate.isDate;
    const startsAt = allDay ? startDate.toString() : startDate.toJSDate().toISOString();
    if (!startsAt) return null;
    const endsAt = endDate ? (allDay ? endDate.toString() : endDate.toJSDate().toISOString()) : '';
    return {
      // Recurring instances share a UID — qualify with the start so each row
      // has a stable, unique id for render keys and event-detail.
      id: recurring ? `${uid}::${startsAt}` : String(uid || startsAt),
      title: repairMojibake(summary || '(no title)'),
      sub: repairMojibake(location || ''),
      description: repairMojibake(description || ''),
      startsAt,
      endsAt,
      allDay,
      recurring,
    };
  }
}

// Fetch + expand every configured ICS calendar for the window. Fails soft PER
// calendar: one dead feed yields [] (logged) and never breaks the endpoint or
// starves the Google calendars. Returns the flat, normalized event list.
export async function fetchIcsEvents(env, timeMin, timeMax) {
  const calendars = parseIcsCalendars(env);
  if (!calendars.length) return [];
  const perCalendar = await Promise.all(calendars.map(async (c) => {
    try {
      const text = await getIcsText(env, c.url);
      const evs = expandIcs(text, timeMin, timeMax, c);
      if (evs.length >= ICS_MAX_ITERATIONS) {
        console.warn(`ics ${c.label}: hit ${ICS_MAX_ITERATIONS}-instance cap — window may be truncated`);
      }
      return evs;
    } catch (err) {
      console.warn(`ics ${c.label}: ${err?.message || err} — skipping (column will be empty)`);
      return [];
    }
  }));
  return perCalendar.flat();
}
