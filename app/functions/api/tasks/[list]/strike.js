// POST /api/tasks/{list}/strike  body { text }
//   → { ok: true }                    on single match (task marked complete)
//   → 404 { error: 'no match' }       when no incomplete task matches
//   → 409 { error, candidates: [] }   when multiple match (caller disambiguates)
//
// Substring match is case-insensitive and only against INCOMPLETE tasks (so a
// re-strike of an already-done item is a 404 rather than silently re-marking).

import { getAccessToken } from '../../../_lib/google-auth.js';
import { checkAuth, corsHeaders, json } from '../../../_lib/auth.js';
import { listIdFor, listTasks, completeTask, findStrikeTarget } from '../../../_lib/tasks-api.js';

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
  const text = (body.text || '').toString().trim();
  if (!text) return json({ error: 'text required' }, { status: 400 }, cors);

  let accessToken;
  try {
    accessToken = await getAccessToken(env);
  } catch (err) {
    return json({ error: err.message }, { status: 500 }, cors);
  }

  try {
    const items = await listTasks(accessToken, listId);
    const target = findStrikeTarget(items, text);
    if (target.kind === 'zero') return json({ error: 'no match' }, { status: 404 }, cors);
    if (target.kind === 'multi') return json({ error: 'ambiguous match', candidates: target.candidates }, { status: 409 }, cors);
    await completeTask(accessToken, listId, target.id);
    return json({ ok: true }, {}, cors);
  } catch (err) {
    return json({ error: err.message }, { status: 502 }, cors);
  }
}
