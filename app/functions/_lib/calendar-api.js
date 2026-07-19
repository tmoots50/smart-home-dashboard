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
//
// `maxPages` follows Google's `nextPageToken` to return EVERY event in range,
// not just the first `maxResults`. Default 1 preserves the single-page behavior
// the wall UI relies on (90-day / month windows never exceed one page); the
// uncapped `?all=1` path raises it so a multi-year window isn't silently
// truncated at 250. Pages are fetched sequentially (Google requires the prior
// page's token), but the endpoint fans out across calendars in parallel.
export async function listEvents(accessToken, calendarId, timeMin, timeMax, { maxResults = 50, maxPages = 1 } = {}) {
  const endpoint = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  const items = [];
  let pageToken = null;
  let pages = 0;
  do {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: String(maxResults),
    });
    if (pageToken) params.set('pageToken', pageToken);
    const url = new URL(endpoint);
    url.search = params.toString();

    const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`calendar ${calendarId} ${res.status}: ${detail}`);
    }
    const data = await res.json();
    if (Array.isArray(data.items)) items.push(...data.items);
    pageToken = data.nextPageToken || null;
    pages += 1;
  } while (pageToken && pages < maxPages);
  return items;
}

// Some upstream events were created by tools that stored UTF-8 bytes decoded
// as Latin-1/cp1252 ("Aidanâ€™s" for "Aidan's"). The wire path through here is
// UTF-8-clean — the damage lives in the stored event text — so repair at
// normalize time. Conservative triggers: a UTF-8 lead-byte char followed by a
// C1 control (never legitimate text) or a cp1252 mojibake continuation char.
// Anything unmappable or that fails strict UTF-8 decoding returns the original,
// so genuine accented text ("château", "Café ☕") passes through untouched.
const CP1252_REVERSE = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85,
  '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8A,
  '‹': 0x8B, 'Œ': 0x8C, 'Ž': 0x8E, '‘': 0x91, '’': 0x92,
  '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97,
  '˜': 0x98, '™': 0x99, 'š': 0x9A, '›': 0x9B, 'œ': 0x9C,
  'ž': 0x9E, 'Ÿ': 0x9F,
};
const MOJIBAKE_PAIR = new RegExp(
  `[\\u00C2-\\u00F4](?:[\\u0080-\\u00BF]|[${Object.keys(CP1252_REVERSE).join('')}])`,
);

export function repairMojibake(s) {
  if (typeof s !== 'string' || !s) return s;
  if (!/[\u0080-\u009F]/.test(s) && !MOJIBAKE_PAIR.test(s)) return s;
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code <= 0xFF) bytes[i] = code;
    else if (CP1252_REVERSE[s[i]] != null) bytes[i] = CP1252_REVERSE[s[i]];
    else return s; // genuine non-Latin text — not mojibake
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return s;
  }
}

// Map Google Calendar event → default dashboard shape. Keep all-day events:
// the default card is now a forward-looking agenda, not a short time window.
//
// `opts` tags each event with its source: `calendar` (the source label, for
// event-detail + edit routing), `person` (the wall column it merges into —
// defaults to calendar), `kind` ('work'|'personal', drives the work tag), and
// `readOnly`. Defaults keep the pre-multi-source callers unchanged.
export function normalize(events, { calendar = '', person, kind = 'personal', readOnly = false } = {}) {
  return events
    .map(e => ({
      id: e.id,
      calendar,
      person: person || calendar,
      kind: kind === 'work' ? 'work' : 'personal',
      readOnly,
      startsAt: e.start?.dateTime || e.start?.date || '',
      endsAt: e.end?.dateTime || e.end?.date || '',
      title: repairMojibake(e.summary || '(no title)'),
      sub: repairMojibake(e.location || ''),
      description: repairMojibake(e.description || ''),
      allDay: !e.start?.dateTime,
    }))
    .filter(e => e.startsAt);
}

// Map events for the wide "upcoming" window (expanded calendar overlay + the
// Hermes curation job). Unlike normalize(), ALL-DAY events are kept — they're
// exactly the birthdays/trips/flights a long-horizon view exists for.
// Note: Google gives all-day events an EXCLUSIVE end.date (a one-day event on
// Jul 9 ends Jul 10); consumers that render ranges must subtract a day.
export function normalizeUpcoming(events, calendarLabel, { person, kind = 'personal', readOnly = false } = {}) {
  return events
    .map(e => {
      const allDay = !e.start?.dateTime;
      const startsAt = e.start?.dateTime || e.start?.date;
      if (!startsAt) return null;
      return {
        id: e.id,
        calendar: calendarLabel,
        // Wall column / overlay section this event merges into. Work calendars
        // (e.g. "Tim (Work)") set person "Tim" so they land in Tim's column;
        // defaults to the calendar label when unsplit.
        person: person || calendarLabel,
        kind: kind === 'work' ? 'work' : 'personal',
        readOnly,
        title: repairMojibake(e.summary || '(no title)'),
        sub: repairMojibake(e.location || ''),
        description: repairMojibake(e.description || ''),
        startsAt,
        endsAt: e.end?.dateTime || e.end?.date || '',
        allDay,
        // Instance of a repeating series (weekly watering, monthly meds…) —
        // the Coming-Up widget uses this to tag/order recurring items.
        recurring: Boolean(e.recurringEventId || e.recurrence),
      };
    })
    .filter(Boolean);
}

// Resolve the fetch window (+ page budget) for /api/calendar/upcoming.
//
// Priority:
//   1. ?all=1  → UNCAPPED window for machine consumers (Hermes calendar
//      helpers). The wall UI caps its views for readability; an agent asked to
//      find/cancel/reschedule "the dentist in 6 months" must see the WHOLE
//      calendar. Bounded (not literally infinite) only because singleEvents=true
//      expands recurring events into unbounded future instances — the window
//      below (−1yr … +3yr) covers every event a household realistically books,
//      and maxPages paginates so nothing IN range is dropped.
//   2. explicit timeMin/timeMax (month-calendar view) → ≤62-day span inside
//      now ± 366 days.
//   3. legacy forward-looking `days` window (1..90 from now) — overlay + any
//      caller that omits both of the above.
// Every return carries maxPages so the endpoint knows how deep to paginate.
const RANGE_DAY_MS = 86_400_000;
const RANGE_SPAN_MAX_MS = 62 * RANGE_DAY_MS;
const RANGE_WINDOW_MS = 366 * RANGE_DAY_MS;
const RANGE_DAYS_DEFAULT = 90;
const RANGE_DAYS_MAX = 90;
const RANGE_ALL_BACK_MS = 366 * RANGE_DAY_MS;   // 1 year of history
const RANGE_ALL_FWD_MS = 1095 * RANGE_DAY_MS;   // 3 years ahead
const RANGE_ALL_MAX_PAGES = 12;                 // 12 × maxResults safety backstop (well above real volume)

export function resolveRange(searchParams, now = new Date()) {
  const all = searchParams.get('all');
  if (all === '1' || all === 'true') {
    return {
      timeMin: new Date(+now - RANGE_ALL_BACK_MS).toISOString(),
      timeMax: new Date(+now + RANGE_ALL_FWD_MS).toISOString(),
      maxPages: RANGE_ALL_MAX_PAGES,
    };
  }
  const min = searchParams.get('timeMin') ? new Date(searchParams.get('timeMin')) : null;
  const max = searchParams.get('timeMax') ? new Date(searchParams.get('timeMax')) : null;
  if (min && max && !Number.isNaN(+min) && !Number.isNaN(+max) && +max > +min
      && (+max - +min) <= RANGE_SPAN_MAX_MS
      && Math.abs(+min - +now) <= RANGE_WINDOW_MS
      && Math.abs(+max - +now) <= RANGE_WINDOW_MS) {
    return { timeMin: min.toISOString(), timeMax: max.toISOString(), maxPages: 1 };
  }
  const n = parseInt(searchParams.get('days'), 10);
  const days = !Number.isFinite(n) || n < 1 ? RANGE_DAYS_DEFAULT : Math.min(n, RANGE_DAYS_MAX);
  return { timeMin: now.toISOString(), timeMax: new Date(+now + days * RANGE_DAY_MS).toISOString(), maxPages: 1 };
}

// Look up calendarId from a human label (case-insensitive, after canonicalization).
// Returns null when no match exists — caller should 404.
export function calendarIdFor(env, label) {
  const calendars = parseCalendars(env);
  const normalLabel = String(label).trim().toLowerCase();
  const match = calendars.find(c => c.label.toLowerCase() === normalLabel);
  return match ? match.id : null;
}

const GCAL_BASE = 'https://www.googleapis.com/calendar/v3/calendars';

// Create a new event. `start`/`end` are ISO 8601 datetimes or YYYY-MM-DD for all-day.
export async function createEvent(accessToken, calendarId, { summary, start, end, allDay = false, description = '', location = '' }) {
  const body = {
    summary,
    ...(description && { description }),
    ...(location && { location }),
    start: allDay ? { date: start } : { dateTime: start },
    end: allDay ? { date: end } : { dateTime: end },
  };
  const res = await fetch(
    `${GCAL_BASE}/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`calendar insert ${res.status}: ${detail}`);
  }
  return res.json();
}

// Delete an event. Google returns 204; 410 means already gone — both are OK.
export async function deleteEvent(accessToken, calendarId, eventId) {
  const res = await fetch(
    `${GCAL_BASE}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: { authorization: `Bearer ${accessToken}` },
    },
  );
  if (!res.ok && res.status !== 410) {
    const detail = await res.text().catch(() => '');
    throw new Error(`calendar delete ${res.status}: ${detail}`);
  }
}

// Patch (partial update) an event. Only supply the fields you want to change.
export async function updateEvent(accessToken, calendarId, eventId, patch) {
  const body = {};
  if (patch.summary != null) body.summary = patch.summary;
  if (patch.description != null) body.description = patch.description;
  if (patch.location != null) body.location = patch.location;
  if (patch.start != null) body.start = patch.allDay ? { date: patch.start } : { dateTime: patch.start };
  if (patch.end != null) body.end = patch.allDay ? { date: patch.end } : { dateTime: patch.end };

  const res = await fetch(
    `${GCAL_BASE}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`calendar patch ${res.status}: ${detail}`);
  }
  return res.json();
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
