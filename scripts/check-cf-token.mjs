#!/usr/bin/env node
// Probe the CF API token in .envrc.local against every permission this
// project needs, using read-only calls. Prints PASS/FAIL per scope plus the
// exact permission name to add in the token editor for each FAIL.
//
// Usage:
//   source .envrc.local && node scripts/check-cf-token.mjs
//
// Note: probes prove the scope is present at read level; the token editor
// rows below should be added as **Edit** so writes work too.

const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_PAGES_PROJECT } = process.env;
for (const [k, v] of Object.entries({ CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_PAGES_PROJECT })) {
  if (!v) { console.error(`${k} required — source .envrc.local first`); process.exit(1); }
}

const api = 'https://api.cloudflare.com/client/v4';
const acct = `${api}/accounts/${CLOUDFLARE_ACCOUNT_ID}`;
const headers = { authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` };

const PROBES = [
  ['Cloudflare Pages · Edit',
    `${acct}/pages/projects/${CLOUDFLARE_PAGES_PROJECT}`],
  ['Workers KV Storage · Edit',
    `${acct}/storage/kv/namespaces?per_page=1`],
  ['Cloudflare Tunnel · Edit',
    `${acct}/cfd_tunnel?is_deleted=false`],
  ['Access: Apps and Policies · Edit',
    `${acct}/access/apps`],
  ['Access: Organizations, Identity Providers, and Groups · Edit',
    `${acct}/access/organizations`],
  ['Access: Service Tokens · Edit',
    `${acct}/access/service_tokens`],
  ['Zone · DNS · Edit (zone: mootsproductgroup.com)',
    `${api}/zones?name=mootsproductgroup.com`],
];

let failures = 0;
for (const [label, url] of PROBES) {
  let ok = false, detail = '';
  try {
    const body = await (await fetch(url, { headers })).json();
    ok = body.success === true;
    // Zone probe: success with an empty list means "no zone visible" = missing scope.
    if (ok && url.includes('/zones?') && (body.result || []).length === 0) {
      ok = false; detail = ' (token sees no zones)';
    }
    if (!ok && !detail) detail = ` (${body.errors?.[0]?.message || 'unknown error'})`;
  } catch (e) { detail = ` (${e.message})`; }
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'}  ${label}${ok ? '' : detail}`);
  if (!ok) failures++;
}

console.log(failures === 0
  ? '\nAll scopes present — good to go.'
  : `\n${failures} missing — edit the token at dash.cloudflare.com → My Profile → API Tokens,\nadd the FAILed rows above (as Edit), keep the PASSing ones, save, re-run this script.`);
process.exit(failures === 0 ? 0 : 1);
