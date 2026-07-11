// The Web Playback SDK must receive a Spotify access token in the browser.
// This is intentionally limited to the same personal kiosk audience as the
// dashboard bearer embedded in the bundle. It is not a general OAuth service.
import { checkAuth, corsHeaders, json } from '../../_lib/auth.js';
import { getAccessToken, spotifyConfigured } from '../../_lib/spotify-auth.js';

export async function onRequest({ request, env }) {
  const cors = corsHeaders(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, { status: 405 }, cors);
  const authError = checkAuth(request, env);
  if (authError) return new Response(authError.body, { status: authError.status, headers: { ...Object.fromEntries(authError.headers), ...cors } });
  if (!spotifyConfigured(env)) return json({ error: 'Spotify not configured' }, { status: 501 }, cors);
  try {
    return json({ accessToken: await getAccessToken(env), expiresIn: 3600 }, { headers: { 'cache-control': 'no-store' } }, cors);
  } catch (error) {
    return json({ error: error.message }, { status: 502 }, cors);
  }
}

