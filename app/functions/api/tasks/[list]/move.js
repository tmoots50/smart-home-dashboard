// POST /api/tasks/{list}/move  body { id, previousId? }
//   → { ok: true }   on success — task moved to immediately after previousId
//                    (omit previousId to move to top of list)
//   → 400/404/502 with { error } on failure

import { getAccessToken } from '../../../_lib/google-auth.js';
import { checkAuth, corsHeaders, json } from '../../../_lib/auth.js';
import { listIdFor, moveTask } from '../../../_lib/tasks-api.js';

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
    return new Response(authErr.body, {
      status: authErr.status,
      headers: { ...Object.fromEntries(authErr.headers), ...cors },
    });
  }

  const listId = listIdFor(env, params.list);
  if (!listId) return json({ error: `unknown list "${params.list}"` }, { status: 404 }, cors);

  const body = await request.json().catch(() => ({}));
  const id = (body.id || '').toString().trim();
  const previousId = (body.previousId || '').toString().trim() || null;
  if (!id) return json({ error: 'id required' }, { status: 400 }, cors);

  let accessToken;
  try {
    accessToken = await getAccessToken(env);
  } catch (err) {
    return json({ error: err.message }, { status: 500 }, cors);
  }

  try {
    await moveTask(accessToken, listId, id, previousId);
    return json({ ok: true }, {}, cors);
  } catch (err) {
    return json({ error: err.message }, { status: 502 }, cors);
  }
}
