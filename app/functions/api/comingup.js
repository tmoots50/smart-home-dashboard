// GET  /api/comingup → { updatedAt, overrides }                    (bearer)
// POST /api/comingup → validate + store to CURATED KV, return blob (bearer)
//
// Hermes's hand on the Coming-Up ordering. The card's baseline order comes
// from the deterministic rules engine (app/src/lib/comingup.js); when Tim
// tells Hermes "move the flight up / hide the watering / that belongs in
// plan-ahead", Hermes POSTs overrides here and the widget merges them on its
// next refresh (≤5 min). Same one-small-mutable-doc KV pattern as
// /api/curated — stored under its own key in the existing CURATED namespace,
// so no new binding is needed.
//
// Override entry: { match, score?, pane?, hide? }
//   match — case-insensitive substring of the event title, or the exact id
//   score — replaces the rules-engine importance (orders the right pane;
//           scored items float to the top of the left pane)
//   pane  — 'left' | 'right': force which pane the event lands in
//   hide  — drop the event from the card entirely

import { checkAuth, corsHeaders, json } from '../_lib/auth.js';

const KV_KEY = 'comingup-overrides';
const EMPTY = { updatedAt: null, overrides: [] };
const CACHE_TTL_S = 60;
const MAX_OVERRIDES = 50;

export function normalizeOverrides(payload, nowIso) {
  const list = payload?.overrides;
  if (!Array.isArray(list)) return { ok: false, error: 'overrides must be an array' };
  if (list.length > MAX_OVERRIDES) return { ok: false, error: `max ${MAX_OVERRIDES} overrides` };
  const overrides = [];
  for (const [i, o] of list.entries()) {
    const match = typeof o?.match === 'string' ? o.match.trim() : '';
    if (!match || match.length > 200) return { ok: false, error: `overrides[${i}].match must be 1..200 chars` };
    const entry = { match };
    if (o.score !== undefined) {
      if (typeof o.score !== 'number' || !Number.isFinite(o.score) || Math.abs(o.score) > 1000) {
        return { ok: false, error: `overrides[${i}].score must be a number within ±1000` };
      }
      entry.score = o.score;
    }
    if (o.pane !== undefined) {
      if (o.pane !== 'left' && o.pane !== 'right') {
        return { ok: false, error: `overrides[${i}].pane must be 'left' or 'right'` };
      }
      entry.pane = o.pane;
    }
    if (o.hide !== undefined) {
      if (typeof o.hide !== 'boolean') return { ok: false, error: `overrides[${i}].hide must be boolean` };
      entry.hide = o.hide;
    }
    if (entry.score === undefined && entry.pane === undefined && entry.hide === undefined) {
      return { ok: false, error: `overrides[${i}] needs at least one of score/pane/hide` };
    }
    overrides.push(entry);
  }
  return { ok: true, value: { updatedAt: nowIso, overrides } };
}

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

    const result = normalizeOverrides(payload, new Date().toISOString());
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
