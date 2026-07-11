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
export function normalize(events) {
  return events
    .map(e => ({
      id: e.id,
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
export function normalizeUpcoming(events, calendarLabel) {
  return events
    .map(e => {
      const allDay = !e.start?.dateTime;
      const startsAt = e.start?.dateTime || e.start?.date;
      if (!startsAt) return null;
      return {
        id: e.id,
        calendar: calendarLabel,
        title: repairMojibake(e.summary || '(no title)'),
        sub: repairMojibake(e.location || ''),
        description: repairMojibake(e.description || ''),
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
