// POST /api/checkin → ask Nigel for a time-of-day check-in on the wall.
//
// Mirrors /api/voice/send: forwards a fixed instruction to the Old Mac relay
// (Telegram user session → @mootsfambot), which is the dashboard's only path
// to Hermes. The relay returns after Nigel's instant ACK (~seconds);
// composition continues on the Old Mac and lands as a kind:"checkin" blob on
// /api/brief, which the client polls (lib/checkin.js). So a 200 here means
// "Nigel heard you", not "the brief is up".
//
// The instruction is fixed server-side — this endpoint deliberately accepts
// no client text, so the wall button can never be repurposed into a free-form
// message channel (that's the voice path's job, with its own UX).

import { checkAuth, corsHeaders, json } from '../_lib/auth.js';

const INSTRUCTION =
  'Wall check-in button pressed: run the checkin-brief skill now — compose a '
  + 'time-of-day check-in and publish it to the dashboard. Reply with one '
  + 'short confirmation line only.';

export async function onRequest({ request, env }) {
  const cors = corsHeaders(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, { status: 405 }, cors);
  const auth = checkAuth(request, env);
  if (auth) return new Response(auth.body, { status: auth.status, headers: { ...Object.fromEntries(auth.headers), ...cors } });
  if (!env.RELAY_URL || !env.RELAY_SECRET) return json({ error: 'check-in relay is not configured' }, { status: 501 }, cors);

  try {
    const response = await fetch(`${env.RELAY_URL.replace(/\/$/, '')}/command`, {
      method: 'POST', signal: AbortSignal.timeout(25_000),
      headers: { 'content-type': 'application/json', 'x-relay-secret': env.RELAY_SECRET },
      body: JSON.stringify({ text: INSTRUCTION }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 429) return json(data.error ? data : { error: 'rate limited' }, { status: 429 }, cors);
    if (!response.ok) return json({ error: 'relay unreachable' }, { status: 502 }, cors);
    return json({ status: 'requested', reply: data.reply ?? null }, { headers: { 'cache-control': 'no-store' } }, cors);
  } catch (error) {
    const timeout = error.name === 'TimeoutError' || error.name === 'AbortError';
    return json({ error: timeout ? 'relay timed out' : 'relay unreachable' }, { status: timeout ? 504 : 502 }, cors);
  }
}
