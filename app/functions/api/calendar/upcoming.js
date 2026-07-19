// GET /api/calendar/upcoming[?days=N | ?timeMin=ISO&timeMax=ISO | ?all=1]
//   → { events: [...] } sorted by start
//
// Wide event window across EVERY calendar in GOOGLE_CALENDARS_JSON, including
// all-day events (birthdays, trips, flights). Consumers:
//   - the dashboard's expanded calendar overlay (?days=7)
//   - the Hermes curation job's Coming-Up selection (default 90)
//   - the month-calendar overlay (?timeMin/?timeMax — arbitrary months)
//   - the Hermes calendar helpers' find/delete/update search (?all=1 — the
//     WHOLE calendar, paginated; see resolveRange). No 90-day horizon there.
// Ranges resolve via resolveRange (days clamps 1..90; explicit ranges clamp
// to ≤62-day spans within now ± 366d; ?all=1 is uncapped −1yr…+3yr, paginated).
// UI/cron windows are edge-cached 5 min; the uncapped agent path is no-store so
// a just-created/-deleted event is immediately findable.
//
// Event shape: { id, calendar, title, sub, startsAt, endsAt, allDay }
// (startsAt/endsAt are ISO datetimes, or YYYY-MM-DD when allDay; all-day
// endsAt is Google's exclusive end date.)

import { getAccessToken } from '../../_lib/google-auth.js';
import { checkAuth, corsHeaders, json } from '../../_lib/auth.js';
import { parseCalendars, listEvents, normalizeUpcoming, resolveRange } from '../../_lib/calendar-api.js';
import { fetchIcsEvents } from '../../_lib/ics-api.js';

const MAX_RESULTS = 250; // per calendar; a household calendar won't exceed this in 90 days
const CACHE_TTL_S = 300;

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

  const calendars = parseCalendars(env);
  if (!calendars.length) {
    return json({ error: 'GOOGLE_CALENDARS_JSON not set or empty.' }, { status: 500 }, cors);
  }

  const url = new URL(request.url);
  const { timeMin, timeMax, maxPages } = resolveRange(url.searchParams, new Date());

  try {
    // Google calendars + read-only ICS feeds (Outlook), merged into one
    // start-sorted stream. Every event carries person + kind so the overlay
    // groups work calendars under their person and tags work events. The ?all=1
    // agent path expands ICS recurrences across the same wide window.
    // Calendars on a NAMED token (work account — revocable by its admin) fail
    // soft; default-token calendars stay loud (see api/calendar.js).
    const [googlePerCal, icsEvents] = await Promise.all([
      Promise.all(calendars.map(async (c) => {
        try {
          const token = c.token ? await getAccessToken(env, c.token) : accessToken;
          return normalizeUpcoming(
            await listEvents(token, c.id, timeMin, timeMax, { maxResults: MAX_RESULTS, maxPages }),
            c.label,
            { person: c.person, kind: c.kind, readOnly: c.readOnly },
          );
        } catch (err) {
          if (!c.token) throw err;
          console.error(`calendar "${c.label}" (token: ${c.token}) failed: ${err.message}`);
          return [];
        }
      })),
      fetchIcsEvents(env, timeMin, timeMax),
    ]);
    const events = [...googlePerCal.flat(), ...icsEvents]
      .sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
    // The uncapped agent path (maxPages > 1) must be fresh — it backs mutating
    // find/delete/update, where a stale 5-min cache would hide a just-created
    // event or resurrect a just-deleted one. UI/cron windows stay edge-cached.
    const cacheControl = maxPages > 1 ? 'no-store' : `public, max-age=${CACHE_TTL_S}`;
    return json({ events }, { headers: { 'cache-control': cacheControl } }, cors);
  } catch (err) {
    return json({ error: err.message }, { status: 502 }, cors);
  }
}

function withCors(res, cors) {
  return new Response(res.body, {
    status: res.status,
    headers: { ...Object.fromEntries(res.headers), ...cors },
  });
}
