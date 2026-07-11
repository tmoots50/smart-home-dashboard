#!/usr/bin/env node
// Store the dashboard's HA long-lived access token: verify it against HA,
// set HA_TOKEN on the Pages project (Production + Preview), and mirror it
// into app/.dev.vars (gitignored) for local Function testing. The token is
// typed at a hidden prompt — it never lands in chat, shell history, or git.
//
// Usage:
//   source .envrc.local && node scripts/set-ha-token.mjs
//
// Token needs: Cloudflare Pages · Edit. Preserves all other env vars.
// Note: CF env vars apply to NEW deployments — push/redeploy after setting.

import { createInterface } from 'node:readline';
import { appendFileSync, readFileSync, existsSync } from 'node:fs';

const HA_LOCAL_URL = process.env.HA_LOCAL_URL || 'http://dashboard.local:8123';
const DEV_VARS = new URL('../app/.dev.vars', import.meta.url).pathname;

const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_PAGES_PROJECT } = process.env;
for (const [k, v] of Object.entries({ CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_PAGES_PROJECT })) {
  if (!v) { console.error(`${k} required`); process.exit(1); }
}

function askHidden(question) {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const orig = rl._writeToOutput.bind(rl);
    rl.question(question, answer => { rl.close(); process.stdout.write('\n'); resolve(answer); });
    rl._writeToOutput = s => { if (s.includes(question)) orig(s); };
  });
}

const token = (await askHidden('HA long-lived access token (hidden): ')).trim();
if (!token) { console.error('empty token — nothing changed'); process.exit(1); }

// 1. Verify against HA before storing anything.
const ping = await fetch(`${HA_LOCAL_URL}/api/`, { headers: { authorization: `Bearer ${token}` } })
  .catch(e => ({ ok: false, statusText: e.message }));
if (!ping.ok) { console.error(`token rejected by ${HA_LOCAL_URL} (${ping.status || ping.statusText}) — nothing changed`); process.exit(1); }
console.log(`token verified against ${HA_LOCAL_URL}`);

// 2. Set CF env var (both envs, additive).
const api = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}`;
const headers = { authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`, 'content-type': 'application/json' };
const projBase = `${api}/pages/projects/${CLOUDFLARE_PAGES_PROJECT}`;
const project = (await (await fetch(projBase, { headers })).json()).result;

const update = {};
for (const envName of ['production', 'preview']) {
  const existing = project?.deployment_configs?.[envName]?.env_vars || {};
  update[envName] = { env_vars: { ...existing, HA_TOKEN: { type: 'secret_text', value: token } } };
}
const patchRes = await fetch(projBase, { method: 'PATCH', headers, body: JSON.stringify({ deployment_configs: update }) });
if (!patchRes.ok) { console.error(`PATCH failed ${patchRes.status}: ${await patchRes.text()}`); process.exit(1); }

const after = (await (await fetch(projBase, { headers })).json()).result;
for (const envName of ['production', 'preview']) {
  const vars = after?.deployment_configs?.[envName]?.env_vars || {};
  console.log(`${envName}: HA_TOKEN ${vars.HA_TOKEN ? 'set' : 'MISSING'}; ${Object.keys(vars).length} env vars total`);
}

// 3. Mirror into app/.dev.vars for local Function testing (gitignored).
const line = `HA_TOKEN=${token}\n`;
if (existsSync(DEV_VARS) && readFileSync(DEV_VARS, 'utf8').includes('HA_TOKEN=')) {
  console.log('app/.dev.vars already has HA_TOKEN — replace it manually if rotating.');
} else {
  appendFileSync(DEV_VARS, line);
  console.log('appended HA_TOKEN to app/.dev.vars (gitignored)');
}
console.log('done — CF change applies on the next deployment');
