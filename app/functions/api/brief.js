// GET  /api/brief → { generatedAt, date, headline, bodyTitle?, body, sections, closer }  (bearer)
// POST /api/brief → validate + clamp + store to KV, return the blob  (bearer)
//
// The Morning Brief blob: one tiny mutable doc written daily (~7:30a) by the
// Hermes morning-briefing job, read by the daybrief widget. Mirrors
// /api/curated in every way — same auth, same KV namespace (separate key:
// a second namespace binding buys nothing for a second one-value doc), same
// short edge cache to match KV's eventual consistency.

import { checkAuth, corsHeaders, json } from '../_lib/auth.js';
import { normalizeBrief } from '../_lib/brief-api.js';

const KV_KEY = 'brief:latest';
const EMPTY = { generatedAt: null, date: null, headline: '', body: [], sections: [], closer: null };
const CACHE_TTL_S = 60;

export async function onRequest(context) {
  const { request, env } = context;
  const cors = corsHeaders(request, env);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const authErr = checkAuth(request, env);
  if (authErr) return withCors(authErr, cors);

  if (!env.CURATED) {
    return json({ error: 'server misconfigured: CURATED KV unbound' }, { status: 500 }, cors);
  }

  if (request.method === 'GET') {
    const raw = await env.CURATED.get(KV_KEY);
    return withCors(new Response(raw || JSON.stringify(EMPTY), {
      headers: {
        'content-type': 'application/json',
        'cache-control': `public, max-age=${CACHE_TTL_S}`,
      },
    }), cors);
  }

  if (request.method === 'POST') {
    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: 'invalid JSON' }, { status: 400 }, cors);
    }

    const result = normalizeBrief(payload, new Date().toISOString());
    if (!result.ok) return json({ error: result.error }, { status: 400 }, cors);

    await env.CURATED.put(KV_KEY, JSON.stringify(result.value));
    return json(result.value, { status: 200 }, cors);
  }

  return json({ error: 'method not allowed' }, { status: 405 }, cors);
}

function withCors(res, cors) {
  return new Response(res.body, {
    status: res.status,
    headers: { ...Object.fromEntries(res.headers), ...cors },
  });
}
