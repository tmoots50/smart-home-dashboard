// GET /api/calendar/upcoming[?days=N] → { events: [...] } sorted by start
//
// Wide event window across EVERY calendar in GOOGLE_CALENDARS_JSON, including
// all-day events (birthdays, trips, flights). Two consumers:
//   - the dashboard's expanded calendar overlay (?days=7)
//   - the Hermes curation job's Coming-Up selection (default 90)
// `days` clamps to 1..90. Cached at the edge for 5 min like /api/calendar.
//
// Event shape: { id, calendar, title, sub, startsAt, endsAt, allDay }
// (startsAt/endsAt are ISO datetimes, or YYYY-MM-DD when allDay; all-day
// endsAt is Google's exclusive end date.)

import { getAccessToken } from '../../_lib/google-auth.js';
import { checkAuth, corsHeaders, json } from '../../_lib/auth.js';
import { parseCalendars, listEvents, normalizeUpcoming } from '../../_lib/calendar-api.js';

const DAY_MS = 86_400_000;
const DAYS_DEFAULT = 90;
const DAYS_MAX = 90;
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
  const days = clampDays(url.searchParams.get('days'));
  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + days * DAY_MS).toISOString();

  try {
    const perCalendar = await Promise.all(calendars.map(async (c) =>
      normalizeUpcoming(await listEvents(accessToken, c.id, timeMin, timeMax, { maxResults: MAX_RESULTS }), c.label)));
    const events = perCalendar.flat().sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
    return json({ events }, { headers: { 'cache-control': `public, max-age=${CACHE_TTL_S}` } }, cors);
  } catch (err) {
    return json({ error: err.message }, { status: 502 }, cors);
  }
}

function clampDays(raw) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return DAYS_DEFAULT;
  return Math.min(n, DAYS_MAX);
}

function withCors(res, cors) {
  return new Response(res.body, {
    status: res.status,
    headers: { ...Object.fromEntries(res.headers), ...cors },
  });
}
