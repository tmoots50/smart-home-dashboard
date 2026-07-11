// Spotify refresh-token -> short-lived access-token helper.
// The cache is per warm Pages Functions isolate; the refresh token remains the
// durable credential in Cloudflare's encrypted environment variables. Tokens
// issued to Developer Dashboard apps have a six-month lifetime (2026 policy),
// so invalid_grant requires re-running the consent/mint flow.

const cache = new Map();
const SAFETY_MS = 60_000;

export function spotifyConfigured(env) {
  return Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET && env.SPOTIFY_REFRESH_TOKEN);
}

export async function getAccessToken(env) {
  if (!spotifyConfigured(env)) {
    throw new Error('Spotify OAuth env vars not set (SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN)');
  }

  const key = env.SPOTIFY_REFRESH_TOKEN;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now() + SAFETY_MS) return cached.token;

  const basic = btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`);
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      authorization: `Basic ${basic}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: key }),
  });
  if (!response.ok) {
    throw new Error(`spotify token refresh ${response.status}: ${await response.text().catch(() => '')}`);
  }

  const data = await response.json();
  if (data.refresh_token && data.refresh_token !== key) {
    console.warn('Spotify returned a rotated refresh token; update SPOTIFY_REFRESH_TOKEN before the current credential is retired.');
  }
  cache.set(key, {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  });
  return data.access_token;
}
