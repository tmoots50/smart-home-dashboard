import { checkAuth, corsHeaders, json } from '../../_lib/auth.js';

export async function onRequest({ request, env }) {
  const cors = corsHeaders(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, { status: 405 }, cors);
  const auth = checkAuth(request, env); if (auth) return new Response(auth.body, { status: auth.status, headers: { ...Object.fromEntries(auth.headers), ...cors } });
  if (!env.RELAY_URL || !env.RELAY_SECRET) return json({ error: 'voice relay is not configured' }, { status: 501 }, cors);
  const body = await request.json().catch(() => ({}));
  const text = String(body.text || '').trim();
  if (!text || text.length > 1000) return json({ error: 'text must be 1..1000 characters' }, { status: 400 }, cors);
  try {
    const response = await fetch(`${env.RELAY_URL.replace(/\/$/, '')}/command`, {
      method: 'POST', signal: AbortSignal.timeout(25_000),
      headers: { 'content-type': 'application/json', 'x-relay-secret': env.RELAY_SECRET },
      body: JSON.stringify({ text }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 429) return json(data.error ? data : { error: 'rate limited' }, { status: 429 }, cors);
    if (!response.ok) return json({ error: 'relay unreachable' }, { status: 502 }, cors);
    return json(data, { headers: { 'cache-control': 'no-store' } }, cors);
  } catch (error) {
    const timeout = error.name === 'TimeoutError' || error.name === 'AbortError';
    return json({ error: timeout ? 'relay timed out' : 'relay unreachable' }, { status: timeout ? 504 : 502 }, cors);
  }
}

