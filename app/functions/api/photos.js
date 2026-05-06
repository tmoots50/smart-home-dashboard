// GET /api/photos
//   → { photos: [{ id, url, takenAt }] }
//   Returns all images in the configured Google Photos album, sized for the
//   1080×1920 portrait target.
//
// GET /api/photos?_lists=1
//   → { albums: [{ id, title, count }] }
//   One-time discovery: list all shared albums Tim's account is in. Use the
//   `id` field as the value for the GOOGLE_PHOTOS_ALBUM_ID env var.
//
// Auth: bearer token (DASHBOARD_TOKEN). Cached at edge for 1h to stay under
// Google's quota and align with Photos baseUrl's ~60min lifetime.

import { getAccessToken } from '../_lib/google-auth.js';
import { checkAuth, corsHeaders, json } from '../_lib/auth.js';

const PHOTOS_API = 'https://photoslibrary.googleapis.com/v1';
const SIZE_SUFFIX = '=w1080-h1920'; // matches the dashboard's portrait target
const MAX_ITEMS = 500;

export async function onRequest(context) {
  const { request, env } = context;
  const cors = corsHeaders(request, env);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== 'GET') {
    return json({ error: 'method not allowed' }, { status: 405 }, cors);
  }

  const authErr = checkAuth(request, env);
  if (authErr) return new Response(authErr.body, { status: authErr.status, headers: { ...Object.fromEntries(authErr.headers), ...cors } });

  let accessToken;
  try {
    accessToken = await getAccessToken(env);
  } catch (err) {
    return json({ error: err.message }, { status: 500 }, cors);
  }

  const url = new URL(request.url);
  if (url.searchParams.get('_lists') === '1') {
    return listAlbums(accessToken, cors);
  }
  return listPhotos(accessToken, env, cors);
}

async function listAlbums(accessToken, cors) {
  const res = await fetch(`${PHOTOS_API}/sharedAlbums?pageSize=50`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return json({ error: `photos sharedAlbums ${res.status}`, detail }, { status: 502 }, cors);
  }
  const data = await res.json();
  const albums = (data.sharedAlbums || []).map(a => ({
    id: a.id,
    title: a.title,
    count: Number(a.mediaItemsCount || 0),
  }));
  return json({ albums }, {}, cors);
}

async function listPhotos(accessToken, env, cors) {
  if (!env.GOOGLE_PHOTOS_ALBUM_ID) {
    return json({ error: 'GOOGLE_PHOTOS_ALBUM_ID not set. Hit /api/photos?_lists=1 to discover album IDs.' }, { status: 500 }, cors);
  }

  const items = [];
  let pageToken = null;
  do {
    const body = { albumId: env.GOOGLE_PHOTOS_ALBUM_ID, pageSize: 100 };
    if (pageToken) body.pageToken = pageToken;
    const res = await fetch(`${PHOTOS_API}/mediaItems:search`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return json({ error: `photos search ${res.status}`, detail }, { status: 502 }, cors);
    }
    const data = await res.json();
    items.push(...(data.mediaItems || []));
    pageToken = data.nextPageToken;
  } while (pageToken && items.length < MAX_ITEMS);

  const photos = items
    .filter(i => i.mimeType?.startsWith('image/'))
    .map(i => ({
      id: i.id,
      url: `${i.baseUrl}${SIZE_SUFFIX}`,
      takenAt: i.mediaMetadata?.creationTime || null,
    }));

  return json({ photos }, {}, {
    ...cors,
    'cache-control': 'public, max-age=3600',
  });
}
