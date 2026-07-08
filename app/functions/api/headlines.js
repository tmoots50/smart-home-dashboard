// GET /api/headlines        → { items: [...] }  top MAX_ITEMS, ≥1 per source (display fallback)
// GET /api/headlines?pool=1 → { items: [...] }  up to POOL_MAX, source-balanced (Hermes candidate menu)
//
// Fetches a fixed list of free Atlanta RSS feeds in parallel and parses each.
// Default mode returns a small display list; ?pool=1 returns the full candidate
// pool for the daily taste-picker (Hermes GETs it, picks one, POSTs to
// /api/curated). Cached at the CF edge for CACHE_TTL_S so we don't hammer
// publishers. Each item: { source, title, url, publishedAt }.

import { checkAuth, corsHeaders, json } from '../_lib/auth.js';
import { parseFeed, selectHeadlines, selectPool } from '../_lib/rss.js';

// All verified fetchable with the UA below (2026-07-07). Discover Atlanta was
// evaluated and dropped: it 403s every path — homepage included — from server
// IPs (Cloudflare bot block), so a Worker fetch would fail in production too.
const FEEDS = [
  { source: 'Eater ATL', url: 'https://atlanta.eater.com/rss/index.xml' },
  { source: 'Atlanta Mag', url: 'https://www.atlantamagazine.com/feed/' },
  { source: 'On the Cheap', url: 'https://feeds.feedblitz.com/atlonthecheap' },
  { source: 'Atlanta Parent', url: 'https://www.atlantaparent.com/events/feed/' },
];
const MAX_ITEMS = 3;
const POOL_MAX = 24;
const CACHE_TTL_S = 600; // 10 min

export async function onRequest(context) {
  const { request, env } = context;
  const cors = corsHeaders(request, env);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, { status: 405 }, cors);

  const authErr = checkAuth(request, env);
  if (authErr) return withCors(authErr, cors);

  const pool = new URL(request.url).searchParams.has('pool');

  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).origin
    + `/api/headlines/__cache/${pool ? 'pool-v1' : 'v2'}`);
  const hit = await cache.match(cacheKey);
  if (hit) return withCors(hit, cors);

  try {
    const groups = await Promise.all(FEEDS.map(async (f) => {
      try {
        const res = await fetch(f.url, {
          headers: {
            // WordPress (ATL Mag) and a few CDNs 403 the default Workers UA.
            'user-agent': 'SmartHomeDashboard/1.0 (+https://smart-home-dashboard-de0.pages.dev)',
            'accept': 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.1',
          },
          cf: { cacheTtl: CACHE_TTL_S, cacheEverything: true },
        });
        if (!res.ok) return { source: f.source, items: [] };
        const xml = await res.text();
        const items = parseFeed(xml).map(i => ({ ...i, source: f.source }));
        return { source: f.source, items };
      } catch {
        return { source: f.source, items: [] };
      }
    }));

    const items = pool
      ? selectPool(groups, POOL_MAX)
      : selectHeadlines(groups, MAX_ITEMS);
    const resp = new Response(JSON.stringify({ items }), {
      headers: {
        'content-type': 'application/json',
        'cache-control': `public, max-age=${CACHE_TTL_S}`,
      },
    });
    await cache.put(cacheKey, resp.clone());
    return withCors(resp, cors);
  } catch (err) {
    return json({ error: err.message }, { status: 502 }, cors);
  }
}

function withCors(res, cors) {
  return new Response(res.body, {
    status: res.status,
    headers: { ...Object.fromEntries(res.headers), ...cors },
  });
}
