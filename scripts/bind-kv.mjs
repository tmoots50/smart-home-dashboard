#!/usr/bin/env node
// Create (if needed) a Workers KV namespace and bind it to the Pages project
// under a given binding name, in both Production and Preview. Idempotent:
// re-running with the same names is a no-op. Preserves all other bindings.
//
// Usage:
//   source .envrc.local && node scripts/bind-kv.mjs BINDING_NAME [namespace-title]
//   e.g. node scripts/bind-kv.mjs CURATED smart-home-dashboard-curated
//
// Token needs: Account · Workers KV Storage · Edit  +  Cloudflare Pages · Edit.
// Note: bindings apply to NEW deployments — push/redeploy after binding.

const [, , binding, titleArg] = process.argv;
if (!binding) { console.error('usage: bind-kv.mjs BINDING_NAME [namespace-title]'); process.exit(1); }

const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_PAGES_PROJECT } = process.env;
for (const [k, v] of Object.entries({ CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_PAGES_PROJECT })) {
  if (!v) { console.error(`${k} required`); process.exit(1); }
}

const title = titleArg || `${CLOUDFLARE_PAGES_PROJECT}-${binding.toLowerCase()}`;
const api = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}`;
const headers = { authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`, 'content-type': 'application/json' };

// 1. Find or create the namespace.
const listRes = await fetch(`${api}/storage/kv/namespaces?per_page=100`, { headers });
if (!listRes.ok) { console.error(`KV list failed ${listRes.status}: ${await listRes.text()}`); process.exit(1); }
let ns = ((await listRes.json()).result || []).find(n => n.title === title);
if (ns) {
  console.log(`namespace "${title}" exists (${ns.id})`);
} else {
  const createRes = await fetch(`${api}/storage/kv/namespaces`, {
    method: 'POST', headers, body: JSON.stringify({ title }),
  });
  if (!createRes.ok) { console.error(`KV create failed ${createRes.status}: ${await createRes.text()}`); process.exit(1); }
  ns = (await createRes.json()).result;
  console.log(`created namespace "${title}" (${ns.id})`);
}

// 2. Bind it on the Pages project (both envs), preserving existing bindings.
const projBase = `${api}/pages/projects/${CLOUDFLARE_PAGES_PROJECT}`;
const projRes = await fetch(projBase, { headers });
if (!projRes.ok) { console.error(`project GET failed ${projRes.status}: ${await projRes.text()}`); process.exit(1); }
const project = (await projRes.json()).result;

const update = {};
for (const envName of ['production', 'preview']) {
  const existing = project?.deployment_configs?.[envName]?.kv_namespaces || {};
  if (existing[binding]?.namespace_id === ns.id) {
    console.log(`${envName}: ${binding} already bound`);
    continue;
  }
  update[envName] = { kv_namespaces: { ...existing, [binding]: { namespace_id: ns.id } } };
}

if (Object.keys(update).length) {
  const patchRes = await fetch(projBase, {
    method: 'PATCH', headers, body: JSON.stringify({ deployment_configs: update }),
  });
  if (!patchRes.ok) { console.error(`PATCH failed ${patchRes.status}: ${await patchRes.text()}`); process.exit(1); }
  console.log(`bound ${binding} → ${ns.id} on: ${Object.keys(update).join(', ')}`);
}
console.log('done — remember: bindings take effect on the next deployment');
