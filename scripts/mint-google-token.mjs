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
//   1. Script prints an authorization URL with the right scopes
//   2. You open it in a browser, sign in, grant access
//   3. Google shows you a one-line auth code — copy it
//   4. Paste it back into the script
//   5. Script exchanges the code for a refresh token, prints all the env
//      var values you need for Cloudflare Pages
//
// Refresh tokens last indefinitely (until revoked) ONLY if the OAuth consent
// screen is published to "In production". If it's left in "Testing" status,
// Google expires the refresh token after 7 DAYS and every Google-backed widget
// silently falls back to mock. Publish the app first — see docs/google-setup.md
// Step 2.6. One mint per setup (per re-mint after expiry/revocation).
//
// NOTE: this script uses the out-of-band (OOB) redirect. Google has been
// deprecating OOB; if the consent URL errors with "invalid_request" or the
// exchange fails, switch REDIRECT to a loopback flow (http://localhost:PORT
// with a tiny local listener) — the OAuth client must then list that redirect.

import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

// drive.readonly — read-only access to all Drive content (we only fetch the
//   one configured folder, but Google has no scope narrower than "all read").
// tasks — read+write access to Google Tasks.
// calendar.readonly — read-only access to Google Calendar (next-3-hours widget).
//
// (photoslibrary.readonly was dropped 2026-05-06 — Google deprecated it on
//  2025-03-31 and the API now returns 403 for it. Photos moved to Drive.)
const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/calendar.readonly',
];
const REDIRECT = 'urn:ietf:wg:oauth:2.0:oob'; // out-of-band: Google shows the code in-page

const rl = createInterface({ input, output });

async function ask(label, fallback) {
  if (fallback) return fallback;
  const v = await rl.question(`${label}: `);
  return v.trim();
}

function buildAuthUrl(clientId) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent', // forces refresh_token return even on re-auth
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function exchangeCode({ clientId, clientSecret, code }) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`token exchange ${res.status}: ${detail}`);
  }
  return res.json();
}

function bar(width = 64) { return '─'.repeat(width); }

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

  console.log();
  console.log(bar());
  console.log('STEP A — open this URL in your browser, sign in, grant access:');
  console.log(bar());
  console.log();
  console.log(buildAuthUrl(clientId));
  console.log();
  console.log('After granting, Google shows a page with the auth code. Copy it.');
  console.log();

  const code = await ask('Paste the auth code here');
  if (!code) { console.error('auth code required'); process.exit(1); }

  console.log();
  console.log('Exchanging…');
  let tokens;
  try {
    tokens = await exchangeCode({ clientId, clientSecret, code });
  } catch (err) {
    console.error('FAILED:', err.message);
    process.exit(1);
  }

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
  console.log('Mark the secret + refresh token as ENCRYPTED in CF Pages.');
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
