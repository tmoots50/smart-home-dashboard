// The dashboard-managed device registry ("add smart stuff I buy" from the wall).
//
// GET    /api/home/devices                → { devices: [{ id, name }] }
// POST   /api/home/devices  { id, name }  → { devices } (after add)
// DELETE /api/home/devices  { id }        → { devices } (after remove)
//
// Backed by the HOME_DEVICES KV binding. Registry entries are merged into
// /api/home reads and the plug allowlist, constrained to switch.*/light.*
// entity ids (validateDevice) — the registry can never grow a lock or alarm.
// Works even before HA is configured, so devices can be staged ahead of the
// HA standup (they read as "off" until HA answers for them).

import { checkAuth, corsHeaders, json } from '../../_lib/auth.js';
import { validateDevice, listDevices, addDevice, removeDevice } from '../../_lib/ha.js';

export async function onRequest(context) {
  const { request, env } = context;
  const cors = corsHeaders(request, env);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  const authErr = checkAuth(request, env);
  if (authErr) return withCors(authErr, cors);

  if (!env.HOME_DEVICES) {
    return json({ error: 'HOME_DEVICES KV unbound' }, { status: 501 }, cors);
  }

  try {
    if (request.method === 'GET') {
      return json({ devices: await listDevices(env) }, {}, cors);
    }
    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const checked = validateDevice(body);
      if (!checked.ok) return json({ error: checked.error }, { status: 400 }, cors);
      return json({ devices: await addDevice(env, checked.value) }, {}, cors);
    }
    if (request.method === 'DELETE') {
      const body = await request.json().catch(() => ({}));
      const id = (body.id || '').toString().trim();
      if (!id) return json({ error: 'id required' }, { status: 400 }, cors);
      return json({ devices: await removeDevice(env, id) }, {}, cors);
    }
    return json({ error: 'method not allowed' }, { status: 405 }, cors);
  } catch (err) {
    return json({ error: err.message }, { status: err.status || 502 }, cors);
  }
}

function withCors(res, cors) {
  return new Response(res.body, {
    status: res.status,
    headers: { ...Object.fromEntries(res.headers), ...cors },
  });
}
