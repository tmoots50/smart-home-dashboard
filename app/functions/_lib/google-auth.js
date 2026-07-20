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

// `tokenName` selects between multiple Google accounts: undefined → the
// default GOOGLE_REFRESH_TOKEN (Tim's personal account, used by photos/tasks/
// all current calendars); a name like "work" → GOOGLE_REFRESH_TOKEN_WORK.
// (No calendar uses a named token today — the Instacart work calendar is
// public at free/busy level, so the default token reads it directly. The
// mechanism stays for any future account whose calendar can't be shared.)
export async function getAccessToken(env, tokenName) {
  const refreshVar = tokenName
    ? `GOOGLE_REFRESH_TOKEN_${String(tokenName).replace(/[^a-z0-9_]/gi, '').toUpperCase()}`
    : 'GOOGLE_REFRESH_TOKEN';
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env[refreshVar]) {
    throw new Error(`Google OAuth env vars not set (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ${refreshVar})`);
  }

  const key = env[refreshVar];
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now() + SAFETY_MS) return cached.token;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: key,
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
