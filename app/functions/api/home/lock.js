// POST /api/home/lock  body { action, pin? }
//   action 'lock'   → locks the deadbolt. No PIN (locking your own door is safe).
//   action 'unlock' → requires PIN. Verified server-side (salted SHA-256,
//                     constant-time) + KV-backed lockout. The PIN is the real
//                     secret; the shared bearer token ships in the public bundle.
//
//   → 200 { ok: true, state }
//   → 401 { error: 'wrong pin' }          (records a failed attempt)
//   → 429 { error: 'locked out' }         (too many fails; try later)
//   → 501 { error: 'HA not configured' }
//
// Every attempt is logged with outcome + client IP for auditability.

import { checkAuth, corsHeaders, json } from '../../_lib/auth.js';
import {
  haConfigured, callService, isLockEntity, parseEntities,
  verifyPin, isLockedOut, recordFail, clearFails,
} from '../../_lib/ha.js';

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

  if (action === 'lock') {
    try {
      await callService(env, 'lock', 'lock', lock.id);
      log('lock', ip, 'ok');
      return json({ ok: true, state: 'locked' }, {}, cors);
    } catch (err) {
      return json({ error: err.message }, { status: 502 }, cors);
    }
  }

  if (action !== 'unlock') {
    return json({ error: 'action must be "lock" or "unlock"' }, { status: 400 }, cors);
  }

  // ── unlock: lockout → PIN → actuate ──
  if (!env.HOME_UNLOCK_PIN_HASH) {
    return json({ error: 'unlock PIN not configured' }, { status: 501 }, cors);
  }
  if (await isLockedOut(env, ip)) {
    log('unlock', ip, 'locked-out');
    return json({ error: 'locked out — too many attempts' }, { status: 429 }, cors);
  }

  const pin = (body.pin || '').toString();
  const ok = await verifyPin(env, pin);
  if (!ok) {
    await recordFail(env, ip);
    log('unlock', ip, 'wrong-pin');
    return json({ error: 'wrong pin' }, { status: 401 }, cors);
  }

  try {
    await callService(env, 'lock', 'unlock', lock.id);
    await clearFails(env, ip);
    log('unlock', ip, 'ok');
    return json({ ok: true, state: 'unlocked' }, {}, cors);
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
