// POST /api/home/plug  body { id, on }  → { ok: true, id, on }
//
// Toggles an allowlisted smart plug. Low-consequence, authorized by the shared
// bearer token (same as read). Rejects any entity id not in HA_ENTITIES_JSON.

import { checkAuth, corsHeaders, json } from '../../_lib/auth.js';
import { haConfigured, allowedPlug, callService } from '../../_lib/ha.js';

export async function onRequest(context) {
  const { request, env } = context;
  const cors = corsHeaders(request, env);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== 'POST') {
    return json({ error: 'method not allowed' }, { status: 405 }, cors);
  }

  const authErr = checkAuth(request, env);
  if (authErr) return withCors(authErr, cors);

  if (!haConfigured(env)) {
    return json({ error: 'HA not configured' }, { status: 501 }, cors);
  }

  const body = await request.json().catch(() => ({}));
  const id = (body.id || '').toString();
  const on = Boolean(body.on);

  if (!allowedPlug(env, id)) {
    return json({ error: 'unknown or non-allowlisted plug' }, { status: 403 }, cors);
  }

  try {
    await callService(env, 'switch', on ? 'turn_on' : 'turn_off', id);
    return json({ ok: true, id, on }, {}, cors);
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
