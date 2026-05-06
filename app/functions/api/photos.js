// GET /api/photos
//   → { photos: [{ id, url, name }] }
//   Lists images in the configured Google Drive folder. `url` points back to
//   /api/photos/{id} which proxies the actual image bytes (Drive files aren't
//   browser-fetchable without an OAuth token, and we keep the OAuth token
//   server-side).
//
// GET /api/photos?_lists=1
//   → { folders: [{ id, name }] }
//   One-time discovery: list Drive folders to find the right ID for
//   GOOGLE_DRIVE_PHOTOS_FOLDER_ID.
//
// Auth: bearer token (DASHBOARD_TOKEN). Manifest cached at edge for 1h.

import { getAccessToken } from '../_lib/google-auth.js';
import { checkAuth, corsHeaders, json } from '../_lib/auth.js';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const MAX_ITEMS = 1000;

export async function onRequest(context) {
  const { request, env } = context;
  const cors = corsHeaders(request, env);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, { status: 405 }, cors);

  const authErr = checkAuth(request, env);
  if (authErr) return new Response(authErr.body, { status: authErr.status, headers: { ...Object.fromEntries(authErr.headers), ...cors } });

  let accessToken;
  try { accessToken = await getAccessToken(env); }
  catch (err) { return json({ error: err.message }, { status: 500 }, cors); }

  const url = new URL(request.url);
  if (url.searchParams.get('_lists') === '1') return listFolders(accessToken, cors);
  return listPhotos(accessToken, env, cors);
}

async function listFolders(accessToken, cors) {
  const u = new URL(`${DRIVE_API}/files`);
  u.searchParams.set('q', "mimeType = 'application/vnd.google-apps.folder' and trashed = false");
  u.searchParams.set('fields', 'files(id, name)');
  u.searchParams.set('pageSize', '100');
  u.searchParams.set('orderBy', 'modifiedTime desc');
  const res = await fetch(u, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return json({ error: `drive folders ${res.status}`, detail }, { status: 502 }, cors);
  }
  const data = await res.json();
  return json({ folders: (data.files || []).map(f => ({ id: f.id, name: f.name })) }, {}, cors);
}

async function listPhotos(accessToken, env, cors) {
  if (!env.GOOGLE_DRIVE_PHOTOS_FOLDER_ID) {
    return json({ error: 'GOOGLE_DRIVE_PHOTOS_FOLDER_ID not set. Hit /api/photos?_lists=1 to discover folder IDs.' }, { status: 500 }, cors);
  }

  const items = [];
  let pageToken = '';
  do {
    const u = new URL(`${DRIVE_API}/files`);
    u.searchParams.set('q', `'${env.GOOGLE_DRIVE_PHOTOS_FOLDER_ID}' in parents and mimeType contains 'image/' and trashed = false`);
    u.searchParams.set('fields', 'nextPageToken, files(id, name, mimeType, imageMediaMetadata(time))');
    u.searchParams.set('pageSize', '1000');
    if (pageToken) u.searchParams.set('pageToken', pageToken);
    const res = await fetch(u, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return json({ error: `drive list ${res.status}`, detail }, { status: 502 }, cors);
    }
    const data = await res.json();
    items.push(...(data.files || []));
    pageToken = data.nextPageToken || '';
  } while (pageToken && items.length < MAX_ITEMS);

  const photos = items.map(f => ({
    id: f.id,
    url: `/api/photos/${f.id}`,
    name: f.name,
    takenAt: f.imageMediaMetadata?.time || null,
  }));

  return json({ photos }, {}, {
    ...cors,
    'cache-control': 'public, max-age=3600',
  });
}
