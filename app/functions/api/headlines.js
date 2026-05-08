// GET /api/headlines → { items: [{ source, title, url, publishedAt }] }
//
// Fetches a fixed list of free RSS feeds in parallel, parses each, and returns
// up to MAX_ITEMS headlines guaranteeing at least one per source. Cached at the
// CF edge for CACHE_TTL_S so we don't hammer publishers.

import { checkAuth, corsHeaders, json } from '../_lib/auth.js';
import { parseFeed, selectHeadlines } from '../_lib/rss.js';

const FEEDS = [
  { source: 'Eater ATL', url: 'https://atlanta.eater.com/rss/index.xml' },
  { source: 'Atlanta Mag', url: 'https://www.atlantamagazine.com/feed/' },
];
const MAX_ITEMS = 3;
const CACHE_TTL_S = 600; // 10 min

export async function onRequest(context) {
  const { request, env } = context;
  const cors = corsHeaders(request, env);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, { status: 405 }, cors);

  const authErr = checkAuth(request, env);
  if (authErr) return withCors(authErr, cors);

  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).origin + '/api/headlines/__cache/v2');
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

    const items = selectHeadlines(groups, MAX_ITEMS);
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
