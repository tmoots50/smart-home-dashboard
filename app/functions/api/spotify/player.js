import { checkAuth, corsHeaders, json } from '../../_lib/auth.js';
import { spotifyConfigured } from '../../_lib/spotify-auth.js';
import { readPlayer, sendControl, SpotifyApiError } from '../../_lib/spotify-api.js';

const ACTIONS = new Set(['play', 'pause', 'next', 'previous', 'shuffle', 'volume']);

export async function onRequest({ request, env }) {
  const cors = corsHeaders(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!['GET', 'POST'].includes(request.method)) return json({ error: 'method not allowed' }, { status: 405 }, cors);
  const authError = checkAuth(request, env);
  if (authError) return withCors(authError, cors);
  if (!spotifyConfigured(env)) return json({ error: 'Spotify not configured' }, { status: 501 }, cors);

  try {
    if (request.method === 'GET') {
      return json(await readPlayer(env), { headers: { 'cache-control': 'no-store' } }, cors);
    }
    const body = await request.json().catch(() => ({}));
    if (!ACTIONS.has(body.action)) return json({ error: 'invalid action' }, { status: 400 }, cors);
    return json(await sendControl(env, body.action, body), {}, cors);
  } catch (error) {
    const noDevice = error instanceof SpotifyApiError && error.status === 404;
    return json({ error: noDevice ? 'NO_ACTIVE_DEVICE' : error.message }, { status: noDevice ? 409 : 502 }, cors);
  }
}

function withCors(response, cors) {
  return new Response(response.body, { status: response.status, headers: { ...Object.fromEntries(response.headers), ...cors } });
}

