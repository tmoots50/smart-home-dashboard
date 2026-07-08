// GET  /api/curated → { generatedAt, comingUp, picks }   (bearer)
// POST /api/curated → validate + clamp + store to CURATED KV, return the blob (bearer)
//
// One tiny mutable doc = "what the dashboard should show right now". Written once
// a morning by the Hermes curation job, read by the pick (+ future coming-up)
// widget. KV is the right store: a single small value, no history needed. It's
// eventually-consistent (~≤60s to propagate globally), so the edge cache is kept
// deliberately short to match — a fresh curation shows within about a minute.

import { checkAuth, corsHeaders, json } from '../_lib/auth.js';
import { normalizeCurated } from '../_lib/curated-api.js';

const KV_KEY = 'latest';
const EMPTY = { generatedAt: null, comingUp: [], picks: [] };
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

    const result = normalizeCurated(payload, new Date().toISOString());
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
