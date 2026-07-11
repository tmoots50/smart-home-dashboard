#!/usr/bin/env node
// One-time helper: mints a Google OAuth refresh token for the dashboard's
// CF Pages Functions to use. Run once on your laptop, save the output.
//
// Usage:
//   node scripts/mint-google-token.mjs
//
// You'll be prompted for the Client ID + Client Secret (or set them in env
// vars GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET to skip the prompts).
//
// What happens:
//   1. Script starts a tiny local server on 127.0.0.1:<random-port>
//   2. Prints an authorization URL (and tries to open your browser)
//   3. You sign in + grant access; Google redirects the code back to the
//      local server automatically — nothing to copy/paste
//   4. Script exchanges the code for a refresh token and prints all the env
//      var values you need for Cloudflare Pages
//
// Refresh tokens last indefinitely (until revoked) ONLY if the OAuth consent
// screen is published to "In production". If it's left in "Testing" status,
// Google expires the refresh token after 7 DAYS and every Google-backed widget
// silently falls back to mock. Publish the app first — see docs/google-setup.md
// Step 2.6.
//
// Redirect flow: this uses the loopback-IP redirect (http://127.0.0.1:<port>),
// the flow Google recommends for "Desktop app" OAuth clients. Desktop clients
// allow any loopback port with no redirect-URI registration in the console. The
// older out-of-band (OOB, urn:ietf:wg:oauth:2.0:oob) flow this script used to
// rely on was deprecated and shut down by Google — don't bring it back.

import { createServer } from 'node:http';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { spawn } from 'node:child_process';

// drive.readonly — read-only access to all Drive content (we only fetch the
//   one configured folder, but Google has no scope narrower than "all read").
// tasks — read+write access to Google Tasks.
// calendar.events — read+write access to events on all Google Calendars.
//   calendar.readonly is a strict subset of this; using .events lets Hermes
//   add, update, and delete events via the dashboard API.
//
// (photoslibrary.readonly was dropped 2026-05-06 — Google deprecated it on
//  2025-03-31 and the API now returns 403 for it. Photos moved to Drive.)
//
// IMPORTANT: if you see a 403 "insufficientPermissions" for calendar.events
// after re-minting, add the scope in Google Cloud Console → Google Auth
// Platform → Data Access → + Add Scopes, search "calendar", add
// ".../auth/calendar.events", Update → Save. Then revoke at
// myaccount.google.com/permissions and re-run this script.
const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/calendar.events',
];

const rl = createInterface({ input, output });

async function ask(label, fallback) {
  if (fallback) return fallback;
  const v = await rl.question(`${label}: `);
  return v.trim();
}

function buildAuthUrl(clientId, redirectUri) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent', // forces refresh_token return even on re-auth
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// Start a loopback server, resolve with { redirectUri, waitForCode, close }.
function startLoopbackServer() {
  return new Promise((resolve) => {
    const server = createServer();
    let onResult;
    const codePromise = new Promise((res, rej) => { onResult = { res, rej }; });

    server.on('request', (req, reply) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      if (!code && !error) { reply.writeHead(204).end(); return; } // favicon etc.
      reply.writeHead(200, { 'content-type': 'text/html' });
      reply.end(`<!doctype html><meta charset="utf8"><body style="font-family:system-ui;padding:3rem;text-align:center">
        <h2>${error ? 'Authorization failed' : 'All set ✓'}</h2>
        <p>${error ? escapeHtml(error) : 'You can close this tab and return to the terminal.'}</p></body>`);
      if (error) onResult.rej(new Error(`consent error: ${error}`));
      else onResult.res(code);
    });

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        redirectUri: `http://127.0.0.1:${port}`,
        waitForCode: () => codePromise,
        close: () => server.close(),
      });
    });
  });
}

function tryOpenBrowser(url) {
  const cmd = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'start'
    : 'xdg-open';
  try { spawn(cmd, [url], { stdio: 'ignore', detached: true, shell: process.platform === 'win32' }).unref(); }
  catch { /* best effort — the URL is printed regardless */ }
}

async function exchangeCode({ clientId, clientSecret, code, redirectUri }) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`token exchange ${res.status}: ${detail}`);
  }
  return res.json();
}

function bar(width = 64) { return '─'.repeat(width); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

async function main() {
  console.log(bar());
  console.log('  Google OAuth refresh-token mint — Smart Home Dashboard');
  console.log(bar());
  console.log();
  console.log('You can paste the GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET below,');
  console.log('or set them as env vars before running and the prompts will be');
  console.log('skipped. Both come from the OAuth client you created in the');
  console.log('Google Cloud console (Step 3 of docs/google-setup.md).');
  console.log();

  const clientId = await ask('GOOGLE_CLIENT_ID', process.env.GOOGLE_CLIENT_ID);
  if (!clientId) { console.error('client id required'); process.exit(1); }
  const clientSecret = await ask('GOOGLE_CLIENT_SECRET', process.env.GOOGLE_CLIENT_SECRET);
  if (!clientSecret) { console.error('client secret required'); process.exit(1); }

  const server = await startLoopbackServer();
  const authUrl = buildAuthUrl(clientId, server.redirectUri);

  console.log();
  console.log(bar());
  console.log('STEP A — open this URL in your browser, sign in, grant access:');
  console.log(bar());
  console.log();
  console.log(authUrl);
  console.log();
  console.log(`(listening on ${server.redirectUri} — the code comes back automatically)`);
  console.log('Opening your browser…');
  tryOpenBrowser(authUrl);

  let code;
  try {
    code = await Promise.race([
      server.waitForCode(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timed out after 5 min waiting for consent')), 5 * 60_000)),
    ]);
  } catch (err) {
    console.error('FAILED:', err.message);
    server.close();
    process.exit(1);
  }

  console.log();
  console.log('Exchanging…');
  let tokens;
  try {
    tokens = await exchangeCode({ clientId, clientSecret, code, redirectUri: server.redirectUri });
  } catch (err) {
    console.error('FAILED:', err.message);
    server.close();
    process.exit(1);
  }
  server.close();

  if (!tokens.refresh_token) {
    console.error('No refresh_token in response. Most likely cause: this is a re-auth');
    console.error('and Google didn\'t mint a new one. Revoke the app at');
    console.error('https://myaccount.google.com/permissions and re-run.');
    console.error('Raw response:', tokens);
    process.exit(1);
  }

  // Sanity check: did Google actually grant every scope we asked for? If a
  // scope isn't registered under Data Access in Google Auth Platform, the
  // consent screen silently drops it and we end up with a partial token.
  const granted = (tokens.scope || '').split(' ').filter(Boolean);
  const missing = SCOPES.filter(s => !granted.includes(s));
  if (missing.length) {
    console.error();
    console.error(bar());
    console.error('  WARNING — Google did not grant every requested scope');
    console.error(bar());
    console.error();
    console.error('Granted scopes:');
    for (const s of granted) console.error(`  ✓ ${s}`);
    console.error();
    console.error('Missing scopes (need fixing in Google Auth Platform → Data Access):');
    for (const s of missing) console.error(`  ✗ ${s}`);
    console.error();
    console.error('Likely fix:');
    console.error('  1. Google Cloud → Google Auth Platform → Data Access');
    console.error('  2. + Add or Remove Scopes → paste the missing scope(s) into the');
    console.error('     "Manually add scopes" box → Add to Table → Update → Save');
    console.error('  3. Revoke at https://myaccount.google.com/permissions');
    console.error('  4. Re-run this script');
    console.error();
    console.error('The refresh token below WILL work for the granted scopes only.');
    console.error('API calls using a missing scope will return 403.');
    console.error();
  }

  console.log();
  console.log(bar());
  console.log('  SUCCESS — paste these into Cloudflare Pages env vars');
  console.log(bar());
  console.log();
  console.log(`GOOGLE_CLIENT_ID=${clientId}`);
  console.log(`GOOGLE_CLIENT_SECRET=${clientSecret}`);
  console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log();
  console.log('Mark the secret + refresh token as ENCRYPTED in CF Pages, on the');
  console.log('PRODUCTION scope (Preview-only was a past outage — see active-handoff.md).');
  console.log();
  console.log('You still need:');
  console.log('  DASHBOARD_TOKEN              (openssl rand -hex 32)');
  console.log('  VITE_DASHBOARD_TOKEN         (same value as DASHBOARD_TOKEN)');
  console.log('  ALLOW_ORIGIN                 (your CF Pages URL + http://localhost:5173)');
  console.log('  GOOGLE_PHOTOS_ALBUM_ID       (discover via /api/photos?_lists=1)');
  console.log('  GOOGLE_TASKS_LIST_TODOS_ID   (discover via /api/tasks/_lists)');
  console.log('  GOOGLE_TASKS_LIST_GROCERIES_ID (same)');
  console.log('  GOOGLE_CALENDARS_JSON        (discover via /api/calendar?_lists=1, then');
  console.log('                                shape as [{"label":"Family","id":"..."},...])');
  console.log();

  rl.close();
}

main().catch(err => { console.error(err); process.exit(1); });
