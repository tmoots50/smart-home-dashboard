// GET /api/calendar          → { sections: [{ label, events: [{id, startsAt, title, sub}] }], nextEventId }
// GET /api/calendar?_lists=1 → { calendars: [{ id, summary, primary }] } (one-time discovery)
//
// Window: now-1h to now+24h. Widget filters to whatever sub-window it cares
// about (today's "next 3 hours" view; eventually maybe a full-day list).
//
// Configuration via GOOGLE_CALENDARS_JSON env var — see calendar-api.js header.

import { getAccessToken } from '../_lib/google-auth.js';
import { checkAuth, corsHeaders, json } from '../_lib/auth.js';
import { parseCalendars, listEvents, normalize, pickNextEventId } from '../_lib/calendar-api.js';

const HOUR_MS = 3_600_000;
const WINDOW_BACK_MS = 1 * HOUR_MS;
const WINDOW_FORWARD_MS = 24 * HOUR_MS;

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
  const timeMin = new Date(now.getTime() - WINDOW_BACK_MS).toISOString();
  const timeMax = new Date(now.getTime() + WINDOW_FORWARD_MS).toISOString();

  try {
    const sections = await Promise.all(calendars.map(async (c) => ({
      label: c.label,
      events: normalize(await listEvents(accessToken, c.id, timeMin, timeMax)),
    })));
    return json({ sections, nextEventId: pickNextEventId(sections, now) }, {}, cors);
  } catch (err) {
    return json({ error: err.message }, { status: 502 }, cors);
  }
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
