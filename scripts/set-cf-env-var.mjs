#!/usr/bin/env node
// Update one plaintext env var on a Cloudflare Pages project, in both
// Production and Preview environments. Safely preserves all other vars.
//
// Usage:
//   CLOUDFLARE_API_TOKEN=... \
//   CLOUDFLARE_ACCOUNT_ID=... \
//   CLOUDFLARE_PAGES_PROJECT=smart-home-dashboard \
//     node scripts/set-cf-env-var.mjs KEY VALUE
//
// Token needs: Account · Cloudflare Pages · Edit scope.

const [, , key, value, ...flags] = process.argv;
if (!key || value === undefined) { console.error('usage: set-cf-env-var.mjs KEY VALUE [--secret]'); process.exit(1); }
const type = flags.includes('--secret') ? 'secret_text' : 'plain_text';

const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_PAGES_PROJECT } = process.env;
for (const [k, v] of Object.entries({ CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_PAGES_PROJECT })) {
  if (!v) { console.error(`${k} required`); process.exit(1); }
}

const base = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${CLOUDFLARE_PAGES_PROJECT}`;
const headers = { authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`, 'content-type': 'application/json' };

const getRes = await fetch(base, { headers });
if (!getRes.ok) { console.error(`GET failed ${getRes.status}: ${await getRes.text()}`); process.exit(1); }
const project = (await getRes.json()).result;

const update = {};
for (const envName of ['production', 'preview']) {
  const existing = project?.deployment_configs?.[envName]?.env_vars || {};
  update[envName] = { env_vars: { ...existing, [key]: { type, value } } };
}

const body = { deployment_configs: update };
const patchRes = await fetch(base, { method: 'PATCH', headers, body: JSON.stringify(body) });
if (!patchRes.ok) { console.error(`PATCH failed ${patchRes.status}: ${await patchRes.text()}`); process.exit(1); }
console.log(`OK. Set ${key} (${type}) on production + preview. Trigger a redeploy for it to bind.`);
