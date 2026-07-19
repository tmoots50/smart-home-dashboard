// GET /api/calendar          → { sections: [{ label, events: [{id, startsAt, title, sub}] }], nextEventId }
// GET /api/calendar?_lists=1 → { calendars: [{ id, summary, primary }] } (one-time discovery)
//
// Window: now to 90 days. The default card renders five events per connected
// calendar (10 total with the currently linked Family + Tim calendars).
//
// Configuration via GOOGLE_CALENDARS_JSON env var — see calendar-api.js header.

import { getAccessToken } from '../_lib/google-auth.js';
import { checkAuth, corsHeaders, json } from '../_lib/auth.js';
import { parseCalendars, listEvents, normalize, pickNextEventId } from '../_lib/calendar-api.js';
import { fetchIcsEvents } from '../_lib/ics-api.js';

const DAY_MS = 86_400_000;
const WINDOW_FORWARD_MS = 90 * DAY_MS;
const MAX_RESULTS_PER_CALENDAR = 10;

export async function onRequest(context) {
  const { request, env } = context;
  const cors = corsHeaders(request, env);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== 'GET') {
    return json({ error: 'method not allowed' }, { status: 405 }, cors);
  }

  const authErr = checkAuth(request, env);
  if (authErr) return withCors(authErr, cors);

  let accessToken;
  try {
    accessToken = await getAccessToken(env);
  } catch (err) {
    return json({ error: err.message }, { status: 500 }, cors);
  }

  const url = new URL(request.url);

  // Discovery: list every calendar Tim has access to. One-time use to populate
  // GOOGLE_CALENDARS_JSON.
  if (url.searchParams.has('_lists')) {
    return discoverCalendars(accessToken, cors);
  }

  const calendars = parseCalendars(env);
  if (!calendars.length) {
    return json({
      error: 'GOOGLE_CALENDARS_JSON not set or empty. Hit /api/calendar?_lists=1 to discover IDs.',
    }, { status: 500 }, cors);
  }

  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + WINDOW_FORWARD_MS).toISOString();

  try {
    // Google calendars (via the shared token) + ICS feeds (Outlook, read-only)
    // fetched together, then merged into per-PERSON sections so a person's work
    // and personal calendars share one wall column. ICS fails soft internally.
    const [googlePerCal, icsEvents] = await Promise.all([
      Promise.all(calendars.map(async (c) =>
        normalize(
          await listEvents(accessToken, c.id, timeMin, timeMax, { maxResults: MAX_RESULTS_PER_CALENDAR }),
          { calendar: c.label, person: c.person, kind: c.kind },
        ))),
      fetchIcsEvents(env, timeMin, timeMax),
    ]);
    const sections = mergeSections([...googlePerCal.flat(), ...icsEvents]);
    return json({ sections, nextEventId: pickNextEventId(sections, now) }, {}, cors);
  } catch (err) {
    return json({ error: err.message }, { status: 502 }, cors);
  }
}

// Group every event by the person column it belongs to (work + personal
// calendars for one person collapse into a single section), chronological,
// capped per column. Section `label` is the person — matches the card's COLUMNS.
function mergeSections(events) {
  const byPerson = new Map();
  for (const ev of events) {
    const key = ev.person || ev.calendar || 'Other';
    if (!byPerson.has(key)) byPerson.set(key, []);
    byPerson.get(key).push(ev);
  }
  return [...byPerson].map(([label, evs]) => ({
    label,
    events: evs.sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt))).slice(0, MAX_RESULTS_PER_CALENDAR),
  }));
}

async function discoverCalendars(accessToken, cors) {
  const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return json({ error: `calendarList ${res.status}`, detail }, { status: 502 }, cors);
  }
  const data = await res.json();
  const calendars = (data.items || []).map(c => ({
    id: c.id,
    summary: c.summary,
    primary: !!c.primary,
    accessRole: c.accessRole,
  }));
  return json({ calendars }, {}, cors);
}

function withCors(res, cors) {
  return new Response(res.body, {
    status: res.status,
    headers: { ...Object.fromEntries(res.headers), ...cors },
  });
}
