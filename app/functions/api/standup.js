import { checkAuth, corsHeaders, json } from '../_lib/auth.js';
import { fetchLinearStandup } from '../_lib/standup-api.js';

const CACHE_CONTROL = 'private, max-age=60, stale-if-error=300';

export async function onRequest({ request, env, waitUntil, now = new Date() }) {
  const cors = corsHeaders(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, { status: 405 }, cors);

  const auth = checkAuth(request, env);
  if (auth) {
    return new Response(auth.body, {
      status: auth.status,
      headers: { ...Object.fromEntries(auth.headers), ...cors },
    });
  }

  if (!env.LINEAR_API_KEY) {
    return json(unavailable('Linear standup is not configured.', now), {
      status: 503,
      headers: { 'cache-control': 'no-store' },
    }, cors);
  }

  const cache = globalThis.caches?.default;
  const cacheKey = new Request(request.url, { method: 'GET' });
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return withHeaders(hit, cors);
  }

  try {
    const payload = await fetchLinearStandup(env.LINEAR_API_KEY, { now });
    const response = json(payload, { headers: { 'cache-control': CACHE_CONTROL } }, cors);
    if (cache && waitUntil) {
      const cacheable = json(payload, { headers: { 'cache-control': 'public, max-age=60' } });
      waitUntil(cache.put(cacheKey, cacheable));
    }
    return response;
  } catch {
    return json(unavailable('Linear standup is temporarily unavailable.', now), {
      status: 502,
      headers: { 'cache-control': 'no-store' },
    }, cors);
  }
}

function unavailable(message, now) {
  const generatedAt = validIso(now);
  return {
    state: 'unavailable',
    source: 'linear',
    generatedAt,
    freshness: 'Linear · unavailable',
    message,
    agents: [],
    unresolved: [],
    truncated: 0,
    sourceTruncated: false,
  };
}

function validIso(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value || '');
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function withHeaders(response, extraHeaders) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(extraHeaders)) headers.set(key, value);
  return new Response(response.body, { status: response.status, headers });
}
