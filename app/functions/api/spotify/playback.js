import { checkAuth, corsHeaders, json } from '../../_lib/auth.js';
import { spotifyConfigured } from '../../_lib/spotify-auth.js';
import { startPlayback, SpotifyApiError } from '../../_lib/spotify-api.js';

export async function onRequest({ request, env }) {
  const cors = corsHeaders(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, { status: 405 }, cors);
  const auth = checkAuth(request, env); if (auth) return new Response(auth.body, { status: auth.status, headers: { ...Object.fromEntries(auth.headers), ...cors } });
  if (!spotifyConfigured(env)) return json({ error: 'Spotify not configured' }, { status: 501 }, cors);
  const body = await request.json().catch(() => ({}));
  if (!body.contextUri && !Array.isArray(body.uris)) return json({ error: 'contextUri or uris required' }, { status: 400 }, cors);
  try { return json(await startPlayback(env, body), {}, cors); }
  catch (error) { return json({ error: error.status === 404 ? 'NO_ACTIVE_DEVICE' : error.message }, { status: error instanceof SpotifyApiError && error.status === 404 ? 409 : 502 }, cors); }
}

