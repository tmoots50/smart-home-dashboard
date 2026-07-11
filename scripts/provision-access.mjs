#!/usr/bin/env node
// One-shot Cloudflare Access provisioning for ha.mootsproductgroup.com:
//   1. Mint the "pages-functions" Access service token (or reuse if it exists)
//   2. Create the "Home Assistant" Access app (or reuse), session 730h
//   3. Policies: allow ALLOW_EMAIL (identity, OTP by default) + Service Auth
//   4. Set Pages env vars: CF_ACCESS_CLIENT_ID (plain) + CF_ACCESS_CLIENT_SECRET
//      (secret), additive; mirror both into app/.dev.vars (gitignored)
//
// The service-token secret stays inside this process: API → memory → API/.dev.vars.
// It is NEVER printed. Idempotent-ish: reuses app/token by name; secret is only
// available at token creation, so if the token exists but .dev.vars lacks the
// secret, delete the token in ZT dashboard and re-run.
//
// Usage:
//   source .envrc.local && node scripts/provision-access.mjs

import { appendFileSync, readFileSync, existsSync } from 'node:fs';

const APP_DOMAIN = 'ha.mootsproductgroup.com';
const APP_NAME = 'Home Assistant';
const TOKEN_NAME = 'pages-functions';
const ALLOW_EMAIL = 'tim.moots@gmail.com';
const SESSION = '730h';
const DEV_VARS = new URL('../app/.dev.vars', import.meta.url).pathname;

const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_PAGES_PROJECT } = process.env;
for (const [k, v] of Object.entries({ CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_PAGES_PROJECT })) {
  if (!v) { console.error(`${k} required — source .envrc.local first`); process.exit(1); }
}

const acct = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}`;
const headers = { authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`, 'content-type': 'application/json' };
async function cf(method, path, body) {
  const res = await fetch(`${acct}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json();
  if (!json.success) throw new Error(`${method} ${path}: ${JSON.stringify(json.errors)}`);
  return json.result;
}

// 1. Service token (client id/secret only returned at creation).
const tokens = await cf('GET', '/access/service_tokens');
let st = (tokens || []).find(t => t.name === TOKEN_NAME);
let clientSecret = null;
if (st) {
  console.log(`service token "${TOKEN_NAME}" already exists (${st.client_id}) — reusing; secret not re-issuable`);
} else {
  st = await cf('POST', '/access/service_tokens', { name: TOKEN_NAME, duration: '8760h' });
  clientSecret = st.client_secret;
  console.log(`service token "${TOKEN_NAME}" created (${st.client_id})`);
}

// 2. App.
const apps = await cf('GET', '/access/apps');
let app = (apps || []).find(a => a.domain === APP_DOMAIN);
if (app) {
  console.log(`access app for ${APP_DOMAIN} already exists (${app.id})`);
} else {
  app = await cf('POST', '/access/apps', {
    name: APP_NAME, domain: APP_DOMAIN, type: 'self_hosted',
    session_duration: SESSION, app_launcher_visible: false,
  });
  console.log(`access app created for ${APP_DOMAIN} (session ${SESSION})`);
}

// 3. Policies (skip if already present by name).
const policies = await cf('GET', `/access/apps/${app.id}/policies`);
const have = new Set((policies || []).map(p => p.name));
if (!have.has('tim')) {
  await cf('POST', `/access/apps/${app.id}/policies`, {
    name: 'tim', decision: 'allow', precedence: 1,
    include: [{ email: { email: ALLOW_EMAIL } }],
  });
  console.log(`policy: allow ${ALLOW_EMAIL} (email OTP login)`);
}
if (!have.has('pages-functions')) {
  await cf('POST', `/access/apps/${app.id}/policies`, {
    name: 'pages-functions', decision: 'non_identity', precedence: 2,
    include: [{ service_token: { token_id: st.id } }],
  });
  console.log('policy: service-auth for pages-functions token');
}

// 4. Pages env vars (additive) + .dev.vars mirror.
const projBase = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${CLOUDFLARE_PAGES_PROJECT}`;
const project = (await (await fetch(projBase, { headers })).json()).result;
const newVars = {
  HA_BASE_URL: { type: 'plain_text', value: `https://${APP_DOMAIN}` },
  CF_ACCESS_CLIENT_ID: { type: 'plain_text', value: st.client_id },
  ...(clientSecret ? { CF_ACCESS_CLIENT_SECRET: { type: 'secret_text', value: clientSecret } } : {}),
};
const update = {};
for (const env of ['production', 'preview']) {
  const existing = project?.deployment_configs?.[env]?.env_vars || {};
  update[env] = { env_vars: { ...existing, ...newVars } };
}
const patch = await fetch(projBase, { method: 'PATCH', headers, body: JSON.stringify({ deployment_configs: update }) });
if (!patch.ok) throw new Error(`Pages PATCH failed: ${patch.status} ${await patch.text()}`);
const after = (await (await fetch(projBase, { headers })).json()).result;
for (const env of ['production', 'preview']) {
  const vars = after?.deployment_configs?.[env]?.env_vars || {};
  console.log(`${env}: HA_BASE_URL ${vars.HA_BASE_URL ? 'set' : 'MISSING'}, CF_ACCESS_CLIENT_ID ${vars.CF_ACCESS_CLIENT_ID ? 'set' : 'MISSING'}, CF_ACCESS_CLIENT_SECRET ${vars.CF_ACCESS_CLIENT_SECRET ? 'set' : 'MISSING'}; ${Object.keys(vars).length} vars total`);
}

if (clientSecret) {
  const existing = existsSync(DEV_VARS) ? readFileSync(DEV_VARS, 'utf8') : '';
  if (!existing.includes('CF_ACCESS_CLIENT_ID=')) {
    appendFileSync(DEV_VARS, `HA_BASE_URL=https://${APP_DOMAIN}\nCF_ACCESS_CLIENT_ID=${st.client_id}\nCF_ACCESS_CLIENT_SECRET=${clientSecret}\n`);
    console.log('mirrored Access credentials into app/.dev.vars (gitignored)');
  }
}
console.log('done — Pages env changes apply on the next deployment');
