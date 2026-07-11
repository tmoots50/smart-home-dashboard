#!/usr/bin/env node
// Read the relay secret over SSH and bind it to Cloudflare Pages without
// printing the secret or placing it in a shell command line.
//
// Usage:
//   source .envrc.local
//   node scripts/sync-relay-cloudflare.mjs [ssh-host] [relay-url]

import { execFileSync } from 'node:child_process';

const relayHost = process.argv[2] || process.env.RELAY_HOST || 'oldmac';
const relayUrl = process.argv[3] || 'https://relay.mootsproductgroup.com';
const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_PAGES_PROJECT } = process.env;

for (const [key, value] of Object.entries({
  CLOUDFLARE_API_TOKEN,
  CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_PAGES_PROJECT,
})) {
  if (!value) {
    console.error(`${key} required`);
    process.exit(1);
  }
}

let relaySecret;
try {
  relaySecret = execFileSync('ssh', [
    relayHost,
    `awk -F= '$1 == "RELAY_SECRET" { print substr($0, index($0, "=") + 1); exit }' ~/.hermes-relay/.env`,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
} catch {
  console.error(`Could not read the relay secret from ${relayHost}.`);
  process.exit(1);
}

if (!/^[a-f0-9]{64}$/i.test(relaySecret)) {
  console.error(`The relay secret on ${relayHost} is missing or malformed.`);
  process.exit(1);
}

const base = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${CLOUDFLARE_PAGES_PROJECT}`;
const headers = {
  authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
  'content-type': 'application/json',
};

const getResponse = await fetch(base, { headers });
if (!getResponse.ok) {
  console.error(`Cloudflare project lookup failed (${getResponse.status}).`);
  process.exit(1);
}
const project = (await getResponse.json()).result;

const deploymentConfigs = {};
for (const environment of ['production', 'preview']) {
  const existing = project?.deployment_configs?.[environment]?.env_vars || {};
  deploymentConfigs[environment] = {
    env_vars: {
      ...existing,
      RELAY_URL: { type: 'plain_text', value: relayUrl },
      RELAY_SECRET: { type: 'secret_text', value: relaySecret },
    },
  };
}

const patchResponse = await fetch(base, {
  method: 'PATCH',
  headers,
  body: JSON.stringify({ deployment_configs: deploymentConfigs }),
});
relaySecret = undefined;
if (!patchResponse.ok) {
  console.error(`Cloudflare project update failed (${patchResponse.status}).`);
  process.exit(1);
}

console.log(`Set RELAY_URL and RELAY_SECRET on ${CLOUDFLARE_PAGES_PROJECT} production + preview.`);
console.log('The relay secret was not printed. Trigger a deployment to bind the new values.');
