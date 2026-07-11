import { checkAuth, corsHeaders, json } from '../../_lib/auth.js';
import { MAX_AUDIO_BYTES, transcribeAudio, validateAudio } from '../../_lib/voice-api.js';

export async function onRequest({ request, env }) {
  const cors = corsHeaders(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, { status: 405 }, cors);
  const auth = checkAuth(request, env); if (auth) return new Response(auth.body, { status: auth.status, headers: { ...Object.fromEntries(auth.headers), ...cors } });
  if (!env.AI) return json({ error: 'Workers AI binding is not configured' }, { status: 500 }, cors);
  const contentLength = Number(request.headers.get('content-length')) || 0;
  if (contentLength > MAX_AUDIO_BYTES) return json({ error: 'audio exceeds 1MB' }, { status: 413 }, cors);
  const bytes = new Uint8Array(await request.arrayBuffer());
  const validation = validateAudio(bytes);
  if (!validation.ok) return json({ error: validation.error }, { status: validation.status }, cors);
  try {
    const { transcript } = await transcribeAudio(env.AI, bytes);
    return json({ transcript }, { headers: { 'cache-control': 'no-store' } }, cors);
  } catch (error) {
    return json({ error: `transcription failed: ${error.message}` }, { status: 502 }, cors);
  }
}

