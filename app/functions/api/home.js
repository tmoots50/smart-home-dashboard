// GET /api/home → { lock: {id,name,state,battery}, plugs: [{id,name,on}] }
//
// Reads the allowlisted Home Assistant entities (HA_ENTITIES_JSON) via the HA
// REST API. Returns 501 until HA is configured, so the client falls back to mock.

import { checkAuth, corsHeaders, json } from '../_lib/auth.js';
import { haConfigured, readHome } from '../_lib/ha.js';

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

  if (!haConfigured(env)) {
    return json({ error: 'HA not configured' }, { status: 501 }, cors);
  }

  try {
    return json(await readHome(env), {}, cors);
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
