// POST /api/calendar/events
// Body: { calendar, summary, start, end?, allDay?, description?, location? }
//   calendar — label from GOOGLE_CALENDARS_JSON (e.g. "Tim" or "Family")
//   start/end — ISO 8601 datetime, or YYYY-MM-DD when allDay=true
//   end defaults to start+1h (timed) or start+1 day (all-day)
// → { ok: true, id: "googleEventId" }

import { getAccessToken } from '../../_lib/google-auth.js';
import { checkAuth, corsHeaders, json } from '../../_lib/auth.js';
import { googleCalendarFor, createEvent } from '../../_lib/calendar-api.js';
import { icsCalendarFor } from '../../_lib/ics-api.js';

export async function onRequest(context) {
  const { request, env } = context;
  const cors = corsHeaders(request, env);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, { status: 405 }, cors);

  const authErr = checkAuth(request, env);
  if (authErr) return withCors(authErr, cors);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid JSON body' }, { status: 400 }, cors); }

  const { calendar, summary, start, end, allDay = false, description = '', location = '', recurrence } = body;
  if (!calendar || typeof calendar !== 'string') return json({ error: 'calendar required' }, { status: 400 }, cors);
  if (!summary || typeof summary !== 'string') return json({ error: 'summary required' }, { status: 400 }, cors);
  if (!start || typeof start !== 'string') return json({ error: 'start required' }, { status: 400 }, cors);
  // Optional recurrence: array of RRULE strings passed through verbatim to Google.
  if (recurrence != null && !Array.isArray(recurrence)) return json({ error: 'recurrence must be an array of RRULE strings' }, { status: 400 }, cors);

  // Read-only calendars are display-only: ICS feeds (a publish URL is one-way)
  // and Google calendars flagged readOnly (e.g. Tim's work cal — its token is
  // calendar.readonly-scoped). Refuse mutations with a clear 403 rather than a
  // puzzling 404 (the calendar exists; it just can't be written).
  const gcal = googleCalendarFor(env, calendar);
  if (icsCalendarFor(env, calendar) || gcal?.readOnly) {
    return json({ error: `"${calendar}" is a display-only calendar and cannot be edited.` }, { status: 403 }, cors);
  }

  if (!gcal) return json({ error: `unknown calendar "${calendar}"` }, { status: 404 }, cors);

  let resolvedEnd = end;
  if (!resolvedEnd) {
    if (allDay) {
      const d = new Date(start + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + 1);
      resolvedEnd = d.toISOString().slice(0, 10);
    } else {
      const d = new Date(start);
      if (Number.isNaN(+d)) return json({ error: 'invalid start datetime' }, { status: 400 }, cors);
      resolvedEnd = new Date(+d + 3_600_000).toISOString();
    }
  }

  let accessToken;
  try { accessToken = await getAccessToken(env, gcal.token); } catch (err) { return json({ error: err.message }, { status: 500 }, cors); }

  try {
    const ev = await createEvent(accessToken, gcal.id, { summary, start, end: resolvedEnd, allDay, description, location, recurrence });
    return json({ ok: true, id: ev.id }, {}, cors);
  } catch (err) {
    return json({ error: err.message }, { status: 502 }, cors);
  }
}

function withCors(res, cors) {
  return new Response(res.body, { status: res.status, headers: { ...Object.fromEntries(res.headers), ...cors } });
}
