#!/usr/bin/env node
// One-off repair: copy a Cloudflare Pages project's PREVIEW env vars into
// PRODUCTION. Fixes the case where Production vars get nuked (e.g. by a
// transient wrangler.toml/jsonc that grabbed Production source-of-truth and
// dropped the dashboard values when removed).
//
// Reads only PLAINTEXT vars — Secrets come back masked from the GET and
// can't be copied this way; they'd need re-entering or `wrangler pages
// secret put`. This project's vars are all plaintext, so this works.
//
// Usage:
//   CLOUDFLARE_API_TOKEN=... \
//   CLOUDFLARE_ACCOUNT_ID=... \
//   CLOUDFLARE_PAGES_PROJECT=smart-home-dashboard \
//     node scripts/copy-cf-env-preview-to-prod.mjs
//
// Token needs: Account · Cloudflare Pages · Edit scope.

const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_PAGES_PROJECT } = process.env;
for (const [k, v] of Object.entries({ CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_PAGES_PROJECT })) {
  if (!v) { console.error(`${k} required`); process.exit(1); }
}

const base = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${CLOUDFLARE_PAGES_PROJECT}`;
const headers = { authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`, 'content-type': 'application/json' };

console.log(`GET  ${base}`);
const getRes = await fetch(base, { headers });
if (!getRes.ok) { console.error(`GET failed ${getRes.status}: ${await getRes.text()}`); process.exit(1); }
const project = (await getRes.json()).result;

const preview = project?.deployment_configs?.preview?.env_vars || {};
const previewKeys = Object.keys(preview);
if (previewKeys.length === 0) { console.error('No env_vars on preview — nothing to copy'); process.exit(1); }

// Filter to plaintext only — secrets come back masked and can't be re-PATCHed.
const copyable = {};
const skipped = [];
for (const [k, v] of Object.entries(preview)) {
  if (v && v.type === 'plain_text' && typeof v.value === 'string') {
    copyable[k] = { type: 'plain_text', value: v.value };
  } else {
    skipped.push(`${k} (type=${v?.type || 'unknown'})`);
  }
}
console.log(`Found ${previewKeys.length} preview vars; copying ${Object.keys(copyable).length} plaintext (skipping: ${skipped.join(', ') || 'none'})`);

const existingProd = project?.deployment_configs?.production?.env_vars || {};
console.log(`Production currently has ${Object.keys(existingProd).length} vars`);

const body = { deployment_configs: { production: { env_vars: { ...existingProd, ...copyable } } } };
console.log(`PATCH ${base}  (writing ${Object.keys(body.deployment_configs.production.env_vars).length} vars to production)`);
const patchRes = await fetch(base, { method: 'PATCH', headers, body: JSON.stringify(body) });
const patchBody = await patchRes.text();
if (!patchRes.ok) { console.error(`PATCH failed ${patchRes.status}: ${patchBody}`); process.exit(1); }
console.log('OK. Trigger a fresh deployment for the new vars to bind to Functions.');
console.log('  (Empty commit + push, or "Retry deployment" in CF dashboard.)');
