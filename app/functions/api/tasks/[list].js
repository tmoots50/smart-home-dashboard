// GET  /api/tasks/{list}        → { items: [{ id, text, done }] }
// POST /api/tasks/{list}        body { text } → { ok: true }
//
// {list} is one of: todos, groceries — each maps to a Google Tasks list ID
// configured via GOOGLE_TASKS_LIST_{TODOS|GROCERIES}_ID env vars.
//
// Special: GET /api/tasks/_lists → { lists: [{ id, title }] } for one-time
// discovery of the IDs to put in env vars.

import { getAccessToken } from '../../_lib/google-auth.js';
import { checkAuth, corsHeaders, json } from '../../_lib/auth.js';
import { listIdFor, listTasks, insertTask, normalize } from '../../_lib/tasks-api.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const cors = corsHeaders(request, env);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  const authErr = checkAuth(request, env);
  if (authErr) return withCors(authErr, cors);

  let accessToken;
  try {
    accessToken = await getAccessToken(env);
  } catch (err) {
    return json({ error: err.message }, { status: 500 }, cors);
  }

  // Discovery: list all Google Tasks lists in Tim's account.
  if (params.list === '_lists') {
    if (request.method !== 'GET') return json({ error: 'method not allowed' }, { status: 405 }, cors);
    return discoverLists(accessToken, cors);
  }

  const listId = listIdFor(env, params.list);
  // TEMP diagnostic: ?diag=1 — full trace of the Google Tasks call
  if (new URL(request.url).searchParams.get('diag') === '1') {
    const hex = listId ? [...new TextEncoder().encode(listId)].map(b => b.toString(16).padStart(2, '0')).join('') : null;
    const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`);
    const tokenInfo = await tokenInfoRes.json().catch(() => ({}));
    const url = `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks?showCompleted=true&showDeleted=false&showHidden=false&maxResults=100`;
    const upstream = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
    const upstreamBody = await upstream.text();
    return json({
      list: params.list, listId, len: listId?.length, hex,
      accessTokenPrefix: accessToken?.slice(0, 12),
      tokenScope: tokenInfo.scope, tokenAud: tokenInfo.aud, tokenEmail: tokenInfo.email,
      url, upstreamStatus: upstream.status, upstreamBody: upstreamBody.slice(0, 600),
    }, {}, cors);
  }
  if (!listId) {
    return json({
      error: `unknown list "${params.list}". Configure ${params.list === 'todos' ? 'GOOGLE_TASKS_LIST_TODOS_ID' : params.list === 'groceries' ? 'GOOGLE_TASKS_LIST_GROCERIES_ID' : 'env var'}.`,
    }, { status: 404 }, cors);
  }

  try {
    if (request.method === 'GET') {
      const items = await listTasks(accessToken, listId);
      return json({ items: normalize(items) }, {}, cors);
    }
    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const text = (body.text || '').toString().trim();
      if (!text) return json({ error: 'text required' }, { status: 400 }, cors);
      await insertTask(accessToken, listId, text);
      return json({ ok: true }, {}, cors);
    }
    return json({ error: 'method not allowed' }, { status: 405 }, cors);
  } catch (err) {
    return json({ error: err.message }, { status: 502 }, cors);
  }
}

async function discoverLists(accessToken, cors) {
  const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return json({ error: `tasklists ${res.status}`, detail }, { status: 502 }, cors);
  }
  const data = await res.json();
  return json({ lists: (data.items || []).map(l => ({ id: l.id, title: l.title })) }, {}, cors);
}

function withCors(res, cors) {
  // Re-build the response with CORS headers merged in. (Response headers are
  // immutable on a built Response in Workers, so we clone.)
  return new Response(res.body, {
    status: res.status,
    headers: { ...Object.fromEntries(res.headers), ...cors },
  });
}
