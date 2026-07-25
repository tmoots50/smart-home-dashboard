// POST /api/home/lock  body { action }
//   action 'lock'   → locks the deadbolt.
//   action 'unlock' → unlocks the deadbolt. No PIN — the door is only reachable
//                     from the home network (wall tablet / HA over Cloudflare
//                     Tunnel), gated by the shared bearer token like every other
//                     device action.
//
//   → 200 { ok: true, state }
//   → 400 { error: 'action must be "lock" or "unlock"' }
//   → 501 { error: 'HA not configured' }
//
// Every attempt is logged with outcome + client IP for auditability.

import { checkAuth, corsHeaders, json } from '../../_lib/auth.js';
import { haConfigured, callService, parseEntities } from '../../_lib/ha.js';

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

  const { lock } = parseEntities(env);
  if (!lock) return json({ error: 'no lock configured' }, { status: 501 }, cors);

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const body = await request.json().catch(() => ({}));
  const action = (body.action || '').toString();

  if (action !== 'lock' && action !== 'unlock') {
    return json({ error: 'action must be "lock" or "unlock"' }, { status: 400 }, cors);
  }

  const state = action === 'lock' ? 'locked' : 'unlocked';
  try {
    await callService(env, 'lock', action, lock.id);
    log(action, ip, 'ok');
    return json({ ok: true, state }, {}, cors);
  } catch (err) {
    return json({ error: err.message }, { status: 502 }, cors);
  }
}

function log(action, ip, outcome) {
  // Surfaces in `wrangler pages deployment tail` / CF logs. Audit trail for the door.
  console.log(JSON.stringify({ evt: 'home.lock', action, ip, outcome, at: new Date().toISOString() }));
}

function withCors(res, cors) {
  return new Response(res.body, {
    status: res.status,
    headers: { ...Object.fromEntries(res.headers), ...cors },
  });
}
