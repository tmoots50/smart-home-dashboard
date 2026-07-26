// GET /api/photos/{id}
//   Proxies binary image bytes for one Drive file. HEIC/HEIF files are
//   transparently converted: Drive's 1600px thumbnail (always JPEG) is served
//   instead so Android WebView can display them. Bearer-token auth.
//   Cached at edge for 7 days — file IDs are immutable.

import { getAccessToken } from '../../_lib/google-auth.js';
import { checkAuth, corsHeaders } from '../../_lib/auth.js';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

export async function onRequest(context) {
  const { request, env, params } = context;
  const cors = corsHeaders(request, env);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'GET') {
    return new Response('method not allowed', { status: 405, headers: cors });
  }

  const authErr = checkAuth(request, env);
  if (authErr) return new Response(authErr.body, { status: authErr.status, headers: { ...Object.fromEntries(authErr.headers), ...cors } });

  if (!params.id || !/^[A-Za-z0-9_-]+$/.test(params.id)) {
    return new Response('bad id', { status: 400, headers: cors });
  }

  let accessToken;
  try { accessToken = await getAccessToken(env); }
  catch (err) { return new Response(err.message, { status: 500, headers: cors }); }

  // Fetch mimeType + thumbnailLink first so we can detect HEIC before
  // downloading the (potentially large) raw file.
  const metaRes = await fetch(`${DRIVE_API}/files/${params.id}?fields=mimeType,thumbnailLink`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!metaRes.ok) {
    const detail = await metaRes.text().catch(() => '');
    return new Response(`drive meta ${metaRes.status}: ${detail}`, { status: metaRes.status === 404 ? 404 : 502, headers: cors });
  }
  const { mimeType, thumbnailLink } = await metaRes.json();

  // HEIC/HEIF: serve Drive's high-res thumbnail (always JPEG) so Android
  // WebView can render it. Falls through to alt=media if thumbnail unavailable.
  if (/heic|heif/i.test(mimeType || '') && thumbnailLink) {
    const thumbUrl = thumbnailLink.replace(/=s\d+$/, '=s1600');
    const thumbRes = await fetch(thumbUrl);
    if (thumbRes.ok) {
      return new Response(thumbRes.body, {
        status: 200,
        headers: {
          ...cors,
          'content-type': 'image/jpeg',
          'cache-control': 'public, max-age=604800, immutable',
        },
      });
    }
  }

  // Non-HEIC (or thumbnail unavailable): proxy raw bytes.
  const upstream = await fetch(`${DRIVE_API}/files/${params.id}?alt=media`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    return new Response(`drive fetch ${upstream.status}: ${detail}`, { status: upstream.status === 404 ? 404 : 502, headers: cors });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...cors,
      'content-type': upstream.headers.get('content-type') || 'image/jpeg',
      'cache-control': 'public, max-age=604800, immutable',
    },
  });
}
