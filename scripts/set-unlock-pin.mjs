#!/usr/bin/env node
// Set HOME_UNLOCK_PIN_HASH on the Pages project (Production + Preview) from a
// PIN typed at a hidden prompt — the PIN never lands in shell history, chat,
// or logs. Hash format matches functions/_lib/ha.js verifyPin():
//   "<saltHex>:<sha256Hex>"  where hash = SHA-256(saltHex + pin)
//
// Usage:
//   source .envrc.local && node scripts/set-unlock-pin.mjs
//
// Token needs: Cloudflare Pages · Edit. Preserves all other env vars.
// Note: env vars apply to NEW deployments — push/redeploy after setting.

import { createInterface } from 'node:readline';
import { webcrypto as crypto } from 'node:crypto';

const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_PAGES_PROJECT } = process.env;
for (const [k, v] of Object.entries({ CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_PAGES_PROJECT })) {
  if (!v) { console.error(`${k} required`); process.exit(1); }
}

// Hidden prompt (no echo).
function askHidden(question) {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const orig = rl._writeToOutput.bind(rl);
    rl.question(question, answer => { rl.close(); process.stdout.write('\n'); resolve(answer); });
    rl._writeToOutput = s => { if (s.includes(question)) orig(s); };
  });
}

const pin = (await askHidden('New unlock PIN (hidden): ')).trim();
const again = (await askHidden('Repeat PIN: ')).trim();
if (!pin || pin !== again) { console.error('PINs empty or mismatched — nothing changed.'); process.exit(1); }
if (!/^\d{4,8}$/.test(pin)) { console.error('PIN must be 4–8 digits — nothing changed.'); process.exit(1); }

const salt = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + pin));
const hash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
const value = `${salt}:${hash}`;

const api = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}`;
const headers = { authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`, 'content-type': 'application/json' };
const projBase = `${api}/pages/projects/${CLOUDFLARE_PAGES_PROJECT}`;

const projRes = await fetch(projBase, { headers });
if (!projRes.ok) { console.error(`project GET failed ${projRes.status}: ${await projRes.text()}`); process.exit(1); }
const project = (await projRes.json()).result;

const update = {};
for (const envName of ['production', 'preview']) {
  const existing = project?.deployment_configs?.[envName]?.env_vars || {};
  update[envName] = {
    env_vars: { ...existing, HOME_UNLOCK_PIN_HASH: { type: 'secret_text', value } },
  };
}

const patchRes = await fetch(projBase, {
  method: 'PATCH', headers, body: JSON.stringify({ deployment_configs: update }),
});
if (!patchRes.ok) { console.error(`PATCH failed ${patchRes.status}: ${await patchRes.text()}`); process.exit(1); }

// Read back: confirm the var exists and siblings survived, without printing values.
const after = (await (await fetch(projBase, { headers })).json()).result;
for (const envName of ['production', 'preview']) {
  const vars = after?.deployment_configs?.[envName]?.env_vars || {};
  console.log(`${envName}: HOME_UNLOCK_PIN_HASH ${vars.HOME_UNLOCK_PIN_HASH ? 'set' : 'MISSING'}; ${Object.keys(vars).length} env vars total`);
}
console.log('done — applies on the next deployment');
