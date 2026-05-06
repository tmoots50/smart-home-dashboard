// TEMPORARY diagnostic. Returns the NAMES (not values) of env vars visible to
// the Pages Function at runtime. Delete this file once env-var binding is fixed.
export async function onRequest({ env }) {
  const keys = Object.keys(env || {}).sort();
  return new Response(JSON.stringify({ count: keys.length, keys }, null, 2), {
    headers: { 'content-type': 'application/json' },
  });
}
