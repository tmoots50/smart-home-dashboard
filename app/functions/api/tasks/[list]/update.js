// POST /api/tasks/{list}/update  body { id, text } → { ok: true }
//
// Renames a task in place — backs the dashboard's inline edit. Id-only on
// purpose: unlike strike there's no fuzzy-text path, because renaming the
// wrong row is worse than failing.

import { getAccessToken } from '../../../_lib/google-auth.js';
import { checkAuth, corsHeaders, json } from '../../../_lib/auth.js';
import { listIdFor, updateTaskTitle } from '../../../_lib/tasks-api.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const cors = corsHeaders(request, env);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== 'POST') {
    return json({ error: 'method not allowed' }, { status: 405 }, cors);
  }

  const authErr = checkAuth(request, env);
  if (authErr) {
    return new Response(authErr.body, { status: authErr.status, headers: { ...Object.fromEntries(authErr.headers), ...cors } });
  }

  const listId = listIdFor(env, params.list);
  if (!listId) return json({ error: `unknown list "${params.list}"` }, { status: 404 }, cors);

  const body = await request.json().catch(() => ({}));
  const id = (body.id || '').toString().trim();
  const text = (body.text || '').toString().trim();
  if (!id || !text) return json({ error: 'id and text required' }, { status: 400 }, cors);

  let accessToken;
  try {
    accessToken = await getAccessToken(env);
  } catch (err) {
    return json({ error: err.message }, { status: 500 }, cors);
  }

  try {
    await updateTaskTitle(accessToken, listId, id, text);
    return json({ ok: true }, {}, cors);
  } catch (err) {
    const status = err.status === 404 ? 404 : 502;
    return json({ error: status === 404 ? 'no match' : err.message }, { status }, cors);
  }
}
