// GET /api/calendar/upcoming[?days=N | ?timeMin=ISO&timeMax=ISO]
//   → { events: [...] } sorted by start
//
// Wide event window across EVERY calendar in GOOGLE_CALENDARS_JSON, including
// all-day events (birthdays, trips, flights). Three consumers:
//   - the dashboard's expanded calendar overlay (?days=7)
//   - the Hermes curation job's Coming-Up selection (default 90)
//   - the month-calendar overlay (?timeMin/?timeMax — arbitrary months)
// Ranges resolve via resolveRange (days clamps 1..90; explicit ranges clamp
// to ≤62-day spans within now ± 366d). Cached at the edge for 5 min.
//
// Event shape: { id, calendar, title, sub, startsAt, endsAt, allDay }
// (startsAt/endsAt are ISO datetimes, or YYYY-MM-DD when allDay; all-day
// endsAt is Google's exclusive end date.)

import { getAccessToken } from '../../_lib/google-auth.js';
import { checkAuth, corsHeaders, json } from '../../_lib/auth.js';
import { parseCalendars, listEvents, normalizeUpcoming, resolveRange } from '../../_lib/calendar-api.js';

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
  const { timeMin, timeMax } = resolveRange(url.searchParams, new Date());

  try {
    const perCalendar = await Promise.all(calendars.map(async (c) =>
      normalizeUpcoming(await listEvents(accessToken, c.id, timeMin, timeMax, { maxResults: MAX_RESULTS }), c.label)));
    const events = perCalendar.flat().sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
    return json({ events }, { headers: { 'cache-control': `public, max-age=${CACHE_TTL_S}` } }, cors);
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
