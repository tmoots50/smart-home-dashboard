#!/usr/bin/env node
// Spotify OAuth helper. Spotify refresh tokens do not have Google's seven-day
// testing-mode expiry, but Developer Dashboard app tokens now last six months.
// Re-run this consent flow before expiry (and whenever Spotify rotates a token).
//
// Register this exact redirect URI in the Spotify Developer Dashboard:
//   http://127.0.0.1:8899/callback

import { createServer } from 'node:http';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const PORT = 8899;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;
const SCOPES = [
  'user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing',
  'streaming', 'user-read-email', 'user-read-private',
  'playlist-read-private', 'playlist-modify-public', 'playlist-modify-private',
  'user-read-recently-played', 'user-library-read',
];
const rl = createInterface({ input, output });

async function ask(label, fallback) { return fallback || (await rl.question(`${label}: `)).trim(); }
function base64url(value) { return value.toString('base64url'); }
function openBrowser(url) {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  try { spawn(command, [url], { stdio: 'ignore', detached: true, shell: process.platform === 'win32' }).unref(); } catch {}
}
function waitForCode(expectedState) {
  return new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      const url = new URL(request.url, REDIRECT_URI);
      if (url.pathname !== '/callback') return response.writeHead(204).end();
      const error = url.searchParams.get('error');
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<body style="font:18px system-ui;padding:4rem;text-align:center"><h1>Spotify connected ✓</h1><p>You can return to the terminal.</p></body>');
      server.close();
      if (error) reject(new Error(`Spotify consent failed: ${error}`));
      else if (state !== expectedState) reject(new Error('OAuth state mismatch'));
      else if (!code) reject(new Error('Spotify returned no authorization code'));
      else resolve(code);
    });
    server.on('error', reject);
    server.listen(PORT, '127.0.0.1');
    setTimeout(() => { server.close(); reject(new Error('Timed out after 5 minutes')); }, 5 * 60_000).unref();
  });
}
async function tokenRequest(clientId, clientSecret, body) {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  if (!response.ok) throw new Error(`Token exchange ${response.status}: ${await response.text()}`);
  return response.json();
}

try {
  console.log('Spotify OAuth refresh-token mint — Smart Home Dashboard\n');
  console.log(`Before continuing, register ${REDIRECT_URI} in your Spotify app.\n`);
  const clientId = await ask('SPOTIFY_CLIENT_ID', process.env.SPOTIFY_CLIENT_ID);
  const clientSecret = await ask('SPOTIFY_CLIENT_SECRET', process.env.SPOTIFY_CLIENT_SECRET);
  if (!clientId || !clientSecret) throw new Error('Client ID and secret are required');

  const state = base64url(randomBytes(24));
  const authUrl = `https://accounts.spotify.com/authorize?${new URLSearchParams({
    client_id: clientId, response_type: 'code', redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(' '), state,
  })}`;
  console.log('Opening Spotify consent in your browser. If it does not open, use:\n');
  console.log(authUrl, '\n');
  openBrowser(authUrl);
  const code = await waitForCode(state);
  const tokens = await tokenRequest(clientId, clientSecret, { code, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code' });
  if (!tokens.refresh_token) throw new Error('Spotify returned no refresh token; revoke the app and try again');

  // A successful refresh grant proves all three values work together.
  await tokenRequest(clientId, clientSecret, { grant_type: 'refresh_token', refresh_token: tokens.refresh_token });
  console.log('\nVerified a refresh grant. Save these only in .envrc.local and Cloudflare:\n');
  console.log(`SPOTIFY_CLIENT_ID=${clientId}`);
  console.log(`SPOTIFY_CLIENT_SECRET=${clientSecret}`);
  console.log(`SPOTIFY_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log(`\nGranted scopes: ${tokens.scope || '(Spotify did not echo scopes)'}`);
} catch (error) {
  console.error(`\nFAILED: ${error.message}`);
  process.exitCode = 1;
} finally {
  rl.close();
}
