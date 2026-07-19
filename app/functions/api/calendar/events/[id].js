// DELETE /api/calendar/events/[id]?calendar=LABEL  → 204 on success
// PATCH  /api/calendar/events/[id]?calendar=LABEL  → { ok: true }
//   Body (PATCH): { summary?, start?, end?, allDay?, description?, location? }
//
// `calendar` query param is the label from GOOGLE_CALENDARS_JSON ("Tim" or "Family").

import { getAccessToken } from '../../../_lib/google-auth.js';
import { checkAuth, corsHeaders, json } from '../../../_lib/auth.js';
import { calendarIdFor, deleteEvent, updateEvent } from '../../../_lib/calendar-api.js';
import { icsCalendarFor } from '../../../_lib/ics-api.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const cors = corsHeaders(request, env);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'DELETE' && request.method !== 'PATCH') {
    return json({ error: 'method not allowed' }, { status: 405 }, cors);
  }

  const authErr = checkAuth(request, env);
  if (authErr) return withCors(authErr, cors);

  const url = new URL(request.url);
  const calendarLabel = url.searchParams.get('calendar');
  if (!calendarLabel) return json({ error: 'calendar query param required' }, { status: 400 }, cors);

  // Read-only ICS feeds (e.g. Caroline's Outlook) can't be mutated — 403, not 404.
  if (icsCalendarFor(env, calendarLabel)) {
    return json({ error: `"${calendarLabel}" is a display-only calendar and cannot be edited.` }, { status: 403 }, cors);
  }

  const calendarId = calendarIdFor(env, calendarLabel);
  if (!calendarId) return json({ error: `unknown calendar "${calendarLabel}"` }, { status: 404 }, cors);

  const eventId = params.id;

  let accessToken;
  try { accessToken = await getAccessToken(env); } catch (err) { return json({ error: err.message }, { status: 500 }, cors); }

  if (request.method === 'DELETE') {
    try {
      await deleteEvent(accessToken, calendarId, eventId);
      return new Response(null, { status: 204, headers: cors });
    } catch (err) {
      return json({ error: err.message }, { status: 502 }, cors);
    }
  }

  // PATCH
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid JSON body' }, { status: 400 }, cors); }

  try {
    await updateEvent(accessToken, calendarId, eventId, body);
    return json({ ok: true }, {}, cors);
  } catch (err) {
    return json({ error: err.message }, { status: 502 }, cors);
  }
}

function withCors(res, cors) {
  return new Response(res.body, { status: res.status, headers: { ...Object.fromEntries(res.headers), ...cors } });
}
