// Google OAuth refresh-token → access-token helper for CF Pages Functions.
//
// We do the OAuth dance ONCE (interactively, on Tim's laptop) to mint a refresh
// token, then store the refresh token + client_id + client_secret in CF Pages
// env vars. Each request that needs Google API access calls getAccessToken(env)
// which trades the refresh token for a short-lived access token.
//
// Caching: access tokens last 1h. We cache in-memory per-isolate. CF Pages
// Functions reuse isolates across requests when warm, so within an isolate the
// cache lives for a meaningful chunk of time. Cross-isolate sharing would need
// KV; not worth the complexity unless we see real refresh-token rate-limit hits
// (Google allows plenty for this use case).

const cache = new Map(); // refresh_token → { token, expiresAt }
const SAFETY_MS = 60_000; // refresh 1min before actual expiry

export async function getAccessToken(env) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REFRESH_TOKEN) {
    throw new Error('Google OAuth env vars not set (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN)');
  }

  const key = env.GOOGLE_REFRESH_TOKEN;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now() + SAFETY_MS) return cached.token;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`google token refresh ${res.status}: ${detail}`);
  }

  const data = await res.json();
  const token = data.access_token;
  const expiresIn = (data.expires_in ?? 3600) * 1000;
  cache.set(key, { token, expiresAt: Date.now() + expiresIn });
  return token;
}
