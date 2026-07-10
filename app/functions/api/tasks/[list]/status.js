// POST /api/tasks/{list}/status  body { id, done }
// Reversible completion state for taps on the wall checklist.

import { getAccessToken } from '../../../_lib/google-auth.js';
import { checkAuth, corsHeaders, json } from '../../../_lib/auth.js';
import { listIdFor, setTaskCompleted } from '../../../_lib/tasks-api.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const cors = corsHeaders(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, { status: 405 }, cors);

  const authErr = checkAuth(request, env);
  if (authErr) return new Response(authErr.body, {
    status: authErr.status,
    headers: { ...Object.fromEntries(authErr.headers), ...cors },
  });

  const listId = listIdFor(env, params.list);
  if (!listId) return json({ error: `unknown list "${params.list}"` }, { status: 404 }, cors);
  const body = await request.json().catch(() => ({}));
  const id = String(body.id || '').trim();
  if (!id || typeof body.done !== 'boolean') {
    return json({ error: 'id and boolean done required' }, { status: 400 }, cors);
  }

  try {
    const accessToken = await getAccessToken(env);
    await setTaskCompleted(accessToken, listId, id, body.done);
    return json({ ok: true, done: body.done }, {}, cors);
  } catch (err) {
    return json({ error: err.message }, { status: err.status === 404 ? 404 : 502 }, cors);
  }
}
