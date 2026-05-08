// GET /api/mabel
//   → { childName, birthDate, events: [{ type, at }] }
//
// Proxies the read-only dashboard endpoint on the huckleberry-mcp Fly app.
// We never let the browser hold the Fly bearer; the CF Function holds it
// and gates its own surface with the same DASHBOARD_TOKEN that fronts every
// other dashboard backend.
//
// Configuration:
//   DASHBOARD_TOKEN              shared bearer between dashboard and this Function
//   HUCKLEBERRY_DASHBOARD_TOKEN  bearer this Function presents to the Fly app
//   HUCKLEBERRY_BASE_URL         optional override; defaults to https://huckleberry-mcp.fly.dev

import { checkAuth, corsHeaders, json } from '../_lib/auth.js';

const DEFAULT_BASE = 'https://huckleberry-mcp.fly.dev';

export async function onRequest(context) {
  const { request, env } = context;
  const cors = corsHeaders(request, env);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, { status: 405 }, cors);

  const authErr = checkAuth(request, env);
  if (authErr) {
    return new Response(authErr.body, {
      status: authErr.status,
      headers: { ...Object.fromEntries(authErr.headers), ...cors },
    });
  }

  if (!env.HUCKLEBERRY_DASHBOARD_TOKEN) {
    return json({ error: 'HUCKLEBERRY_DASHBOARD_TOKEN not set' }, { status: 500 }, cors);
  }

  const base = (env.HUCKLEBERRY_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
  const upstream = `${base}/api/dashboard/today`;

  let res;
  try {
    res = await fetch(upstream, {
      headers: { authorization: `Bearer ${env.HUCKLEBERRY_DASHBOARD_TOKEN}` },
      cache: 'no-store',
    });
  } catch (err) {
    return json({ error: 'upstream_unreachable', detail: String(err) }, { status: 502 }, cors);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return json({ error: `upstream ${res.status}`, detail }, { status: 502 }, cors);
  }

  const data = await res.json();
  return json(data, {}, {
    ...cors,
    'cache-control': 'public, max-age=60',
  });
}
