#!/usr/bin/env node
// Add the Workers AI binding `AI` to both Pages deployment environments while
// preserving every existing binding and environment variable.
// Usage: source .envrc.local && node scripts/bind-ai.mjs

const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_PAGES_PROJECT } = process.env;
for (const [key, value] of Object.entries({ CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_PAGES_PROJECT })) {
  if (!value) { console.error(`${key} required`); process.exit(1); }
}
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${CLOUDFLARE_PAGES_PROJECT}`;
const headers = { authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`, 'content-type': 'application/json' };
const getResponse = await fetch(endpoint, { headers });
if (!getResponse.ok) { console.error(`project GET failed ${getResponse.status}: ${await getResponse.text()}`); process.exit(1); }
const project = (await getResponse.json()).result;
const deploymentConfigs = {};
for (const name of ['production', 'preview']) {
  const existing = project.deployment_configs?.[name]?.ai_bindings || {};
  deploymentConfigs[name] = { ai_bindings: { ...existing, AI: {} } };
}
const patchResponse = await fetch(endpoint, { method: 'PATCH', headers, body: JSON.stringify({ deployment_configs: deploymentConfigs }) });
if (!patchResponse.ok) { console.error(`project PATCH failed ${patchResponse.status}: ${await patchResponse.text()}`); process.exit(1); }
const verifyResponse = await fetch(endpoint, { headers });
const verified = (await verifyResponse.json()).result;
for (const name of ['production', 'preview']) {
  if (!verified.deployment_configs?.[name]?.ai_bindings?.AI) { console.error(`${name}: AI binding read-back failed`); process.exit(1); }
  console.log(`${name}: AI bound; existing KV and env bindings preserved`);
}
console.log('done — deploy once for the binding to reach Functions');

