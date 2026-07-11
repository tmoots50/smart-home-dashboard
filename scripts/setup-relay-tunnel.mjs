#!/usr/bin/env node
// Idempotently create the named Cloudflare Tunnel, install its credentials and
// ingress config on the old Mac, and create the DNS route when the API token can
// see/edit the zone. Secrets travel to SSH over stdin and are never printed.
//
// Usage:
//   source .envrc.local
//   node scripts/setup-relay-tunnel.mjs mootsproductgroup.com [ssh-host]

import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const domain = process.argv[2];
const sshHost = process.argv[3] || 'oldmac';
const tunnelName = 'hermes-relay';
if (!domain) { console.error('usage: setup-relay-tunnel.mjs DOMAIN [ssh-host]'); process.exit(1); }

const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID } = process.env;
for (const [key, value] of Object.entries({ CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID })) {
  if (!value) { console.error(`${key} required`); process.exit(1); }
}
const base = 'https://api.cloudflare.com/client/v4';
const headers = { authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`, 'content-type': 'application/json' };

async function cf(path, init = {}) {
  const response = await fetch(`${base}${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    throw new Error(`Cloudflare ${init.method || 'GET'} ${path}: ${response.status} ${JSON.stringify(body.errors || body)}`);
  }
  return body.result;
}

function ssh(command, input) {
  const result = spawnSync('ssh', ['-o', 'ConnectTimeout=8', sshHost, command], {
    input, encoding: 'utf8', stdio: input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'],
  });
  if (result.status !== 0) throw new Error(`ssh ${sshHost} failed (${result.status})`);
}

const tunnels = await cf(`/accounts/${CLOUDFLARE_ACCOUNT_ID}/cfd_tunnel?is_deleted=false`);
let tunnel = tunnels.find(item => item.name === tunnelName);
let tunnelSecret = null;
if (!tunnel) {
  tunnelSecret = randomBytes(32).toString('base64');
  tunnel = await cf(`/accounts/${CLOUDFLARE_ACCOUNT_ID}/cfd_tunnel`, {
    method: 'POST', body: JSON.stringify({ name: tunnelName, tunnel_secret: tunnelSecret }),
  });
  console.log(`created tunnel ${tunnelName} (${tunnel.id})`);
} else {
  console.log(`tunnel ${tunnelName} already exists (${tunnel.id})`);
}

const credentialPath = `/Users/tim.moots/.cloudflared/${tunnel.id}.json`;
ssh('mkdir -p ~/.cloudflared && chmod 700 ~/.cloudflared');
if (tunnelSecret) {
  const credentials = JSON.stringify({ AccountTag: CLOUDFLARE_ACCOUNT_ID, TunnelSecret: tunnelSecret, TunnelID: tunnel.id });
  ssh(`umask 077; tee '${credentialPath}' >/dev/null`, credentials);
  console.log('installed tunnel credentials on oldmac (secret not printed)');
} else {
  const check = spawnSync('ssh', ['-o', 'ConnectTimeout=8', sshHost, `test -s '${credentialPath}'`]);
  if (check.status !== 0) throw new Error(`tunnel exists but ${credentialPath} is missing; delete/recreate intentionally to recover credentials`);
}

const hostname = `relay.${domain}`;
const config = `tunnel: ${tunnel.id}\ncredentials-file: ${credentialPath}\n\ningress:\n  - hostname: ${hostname}\n    service: http://127.0.0.1:8787\n  - service: http_status:404\n`;
ssh("umask 077; tee ~/.cloudflared/config.yml >/dev/null", config);
console.log(`installed ingress config: ${hostname} -> 127.0.0.1:8787`);

const zones = await cf(`/zones?name=${encodeURIComponent(domain)}`);
if (zones.length !== 1) {
  console.log('DNS route pending: API token cannot see exactly one matching zone; add Zone Read + DNS Edit and re-run');
  process.exit(2);
}
const zone = zones[0];
const records = await cf(`/zones/${zone.id}/dns_records?type=CNAME&name=${encodeURIComponent(hostname)}`);
const target = `${tunnel.id}.cfargotunnel.com`;
if (!records.length) {
  await cf(`/zones/${zone.id}/dns_records`, {
    method: 'POST', body: JSON.stringify({ type: 'CNAME', name: hostname, content: target, proxied: true, ttl: 1 }),
  });
  console.log(`created DNS route ${hostname} -> ${target}`);
} else {
  console.log(`DNS route ${hostname} already exists`);
}

console.log('tunnel configuration ready; install/start the cloudflared service on the old Mac next');

