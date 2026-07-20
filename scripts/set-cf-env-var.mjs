#!/usr/bin/env node
// Update one env var on a Cloudflare Pages project, in both Production and
// Preview environments.
//
// Usage:
//   CLOUDFLARE_API_TOKEN=... \
//   CLOUDFLARE_ACCOUNT_ID=... \
//   CLOUDFLARE_PAGES_PROJECT=smart-home-dashboard \
//     node scripts/set-cf-env-var.mjs KEY VALUE [--secret]
//
// Token needs: Account · Cloudflare Pages · Edit scope.
//
// IMPORTANT: send ONLY the var being set. The PATCH endpoint merges env_vars
// by key, so other vars survive untouched. An earlier version of this script
// echoed the whole existing map back — but GET never returns secret_text
// VALUES, so the echo rewrote every secret as empty and WIPED them
// (2026-07-19: took out GOOGLE_REFRESH_TOKEN + CF_ACCESS_CLIENT_SECRET in
// prod). Never spread the existing env_vars into a PATCH.

const [, , key, value, ...flags] = process.argv;
if (!key || value === undefined) { console.error('usage: set-cf-env-var.mjs KEY VALUE [--secret]'); process.exit(1); }
const type = flags.includes('--secret') ? 'secret_text' : 'plain_text';

const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_PAGES_PROJECT } = process.env;
for (const [k, v] of Object.entries({ CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_PAGES_PROJECT })) {
  if (!v) { console.error(`${k} required`); process.exit(1); }
}

const base = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${CLOUDFLARE_PAGES_PROJECT}`;
const headers = { authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`, 'content-type': 'application/json' };

const body = {
  deployment_configs: {
    production: { env_vars: { [key]: { type, value } } },
    preview: { env_vars: { [key]: { type, value } } },
  },
};
const patchRes = await fetch(base, { method: 'PATCH', headers, body: JSON.stringify(body) });
if (!patchRes.ok) { console.error(`PATCH failed ${patchRes.status}: ${await patchRes.text()}`); process.exit(1); }
console.log(`OK. Set ${key} (${type}) on production + preview. Trigger a redeploy for it to bind.`);
