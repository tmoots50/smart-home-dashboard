// TEMPORARY diagnostic. Returns the NAMES (not values) of env vars visible to
// the Pages Function at runtime. Delete this file once env-var binding is fixed.
export async function onRequest({ env }) {
  const keys = Object.keys(env || {}).sort();
  const live = {
    commit: env.CF_PAGES_COMMIT_SHA || null,
    branch: env.CF_PAGES_BRANCH || null,
    url: env.CF_PAGES_URL || null,
  };
  return new Response(JSON.stringify({ count: keys.length, live, keys }, null, 2), {
    headers: { 'content-type': 'application/json' },
  });
}
