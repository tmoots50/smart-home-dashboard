// Google Calendar API helpers. Mirrors tasks-api.js shape.
//
// We support N calendars per Tim's account (Family, Tim Work, Caroline Work,
// etc.) configured via a single JSON env var instead of one per calendar:
//
//   GOOGLE_CALENDARS_JSON='[{"label":"Family","id":"abc@group.calendar.google.com"},{"label":"Tim (Work)","id":"primary"}]'
//
// JSON because the labels are user-arbitrary (need quoting) and adding a fourth
// section shouldn't require a code change.

export function parseCalendars(env) {
  const raw = env.GOOGLE_CALENDARS_JSON;
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(c => c && typeof c.label === 'string' && typeof c.id === 'string')
      .map(c => ({ ...c, label: canonicalCalendarLabel(c.label) }));
  } catch {
    return [];
  }
}

// Ground truth until Caroline's separate work calendar is integrated: the
// calendar currently configured as "Caroline" is the household Family feed.
// Keep this exact-match alias narrow so a future "Caroline Work" label is not
// silently rewritten.
export function canonicalCalendarLabel(label) {
  return String(label).trim().toLowerCase() === 'caroline' ? 'Family' : String(label).trim();
}

// Fetch events for a single calendar in [timeMin, timeMax].
// `singleEvents=true` expands recurring events into instances.
export async function listEvents(accessToken, calendarId, timeMin, timeMax, { maxResults = 50 } = {}) {
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
  url.search = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(maxResults),
  }).toString();

  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`calendar ${calendarId} ${res.status}: ${detail}`);
  }
  const data = await res.json();
  return data.items || [];
}

// Map Google Calendar event → default dashboard shape. Keep all-day events:
// the default card is now a forward-looking agenda, not a short time window.
export function normalize(events) {
  return events
    .map(e => ({
      id: e.id,
      startsAt: e.start?.dateTime || e.start?.date || '',
      endsAt: e.end?.dateTime || e.end?.date || '',
      title: e.summary || '(no title)',
      sub: e.location || '',
      description: e.description || '',
      allDay: !e.start?.dateTime,
    }))
    .filter(e => e.startsAt);
}

// Map events for the wide "upcoming" window (expanded calendar overlay + the
// Hermes curation job). Unlike normalize(), ALL-DAY events are kept — they're
// exactly the birthdays/trips/flights a long-horizon view exists for.
// Note: Google gives all-day events an EXCLUSIVE end.date (a one-day event on
// Jul 9 ends Jul 10); consumers that render ranges must subtract a day.
export function normalizeUpcoming(events, calendarLabel) {
  return events
    .map(e => {
      const allDay = !e.start?.dateTime;
      const startsAt = e.start?.dateTime || e.start?.date;
      if (!startsAt) return null;
      return {
        id: e.id,
        calendar: calendarLabel,
        title: e.summary || '(no title)',
        sub: e.location || '',
        description: e.description || '',
        startsAt,
        endsAt: e.end?.dateTime || e.end?.date || '',
        allDay,
      };
    })
    .filter(Boolean);
}

// Pick the soonest upcoming event across all sections — widget highlights it.
export function pickNextEventId(sections, now = new Date()) {
  let nextId = null;
  let nextStart = null;
  for (const s of sections) {
    for (const ev of s.events) {
      const start = new Date(ev.startsAt);
      if (start > now && (!nextStart || start < nextStart)) {
        nextStart = start;
        nextId = ev.id;
      }
    }
  }
  return nextId;
}
