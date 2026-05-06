#!/usr/bin/env node
// One-time helper: lists the IDs you need for the remaining CF Pages env vars.
//   - GOOGLE_DRIVE_PHOTOS_FOLDER_ID  (which Drive folder holds your photos)
//   - GOOGLE_TASKS_LIST_TODOS_ID     (which Tasks list to use for Todos)
//   - GOOGLE_TASKS_LIST_GROCERIES_ID (which Tasks list to use for Groceries)
//   - GOOGLE_CALENDARS_JSON          (which calendars to surface in the widget)
//
// Usage:
//   node scripts/discover-google-ids.mjs
//
// You'll be prompted for the three OAuth values from mint-google-token.mjs
// (or set them as env vars and the prompts are skipped).

import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const rl = createInterface({ input, output });

async function ask(label, fallback) {
  if (fallback) return fallback;
  const v = await rl.question(`${label}: `);
  return v.trim();
}

const need = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'];
const creds = {};
for (const k of need) {
  creds[k] = await ask(k, process.env[k]);
  if (!creds[k]) { console.error(`${k} required`); process.exit(1); }
}
process.env.GOOGLE_CLIENT_ID = creds.GOOGLE_CLIENT_ID;
process.env.GOOGLE_CLIENT_SECRET = creds.GOOGLE_CLIENT_SECRET;
process.env.GOOGLE_REFRESH_TOKEN = creds.GOOGLE_REFRESH_TOKEN;

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`token refresh ${res.status}: ${detail}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function listDriveFolders(token) {
  // Lists folders in Drive. We don't try to filter to "the dashboard one" —
  // we list everything reasonable and let Tim pick by name.
  const folders = [];
  let pageToken = '';
  do {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', "mimeType = 'application/vnd.google-apps.folder' and trashed = false");
    url.searchParams.set('fields', 'nextPageToken, files(id, name, owners(displayName))');
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('orderBy', 'modifiedTime desc');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`drive folders ${res.status}: ${detail}`);
    }
    const data = await res.json();
    folders.push(...(data.files || []));
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return folders;
}

async function listTaskLists(token) {
  const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=100', {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`tasklists ${res.status}: ${detail}`);
  }
  const data = await res.json();
  return data.items || [];
}

async function listCalendars(token) {
  // Returns null when the calendar.readonly scope isn't on the token, so the
  // script can keep going (Tim may not have re-minted yet).
  const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=100', {
    headers: { authorization: `Bearer ${token}` },
  });
  if (res.status === 403) return null;
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`calendarList ${res.status}: ${detail}`);
  }
  const data = await res.json();
  return data.items || [];
}

function bar(width = 64) { return '─'.repeat(width); }

async function main() {
  console.log('Refreshing access token…');
  const token = await getAccessToken();

  console.log('\n' + bar());
  console.log('  GOOGLE DRIVE — Folders (most-recently-modified first)');
  console.log(bar());
  const folders = await listDriveFolders(token);
  if (folders.length === 0) {
    console.log('(none) — create a folder in Drive and drop your photos in it.');
  } else {
    for (const f of folders.slice(0, 30)) {
      const owner = f.owners?.[0]?.displayName ? `  [${f.owners[0].displayName}]` : '';
      console.log(`  • ${f.name}${owner}`);
      console.log(`    GOOGLE_DRIVE_PHOTOS_FOLDER_ID=${f.id}`);
    }
    if (folders.length > 30) console.log(`  …and ${folders.length - 30} more (filter by name in your terminal if needed)`);
  }

  console.log('\n' + bar());
  console.log('  GOOGLE TASKS — Lists');
  console.log(bar());
  const lists = await listTaskLists(token);
  if (lists.length === 0) {
    console.log('(none) — create at least two task lists in Google Tasks first.');
  } else {
    for (const l of lists) {
      console.log(`  • ${l.title}`);
      console.log(`    ${l.id}`);
    }
    console.log();
    console.log('  Pick the list IDs you want for Todos and Groceries:');
    console.log('    GOOGLE_TASKS_LIST_TODOS_ID=<paste-todos-id-here>');
    console.log('    GOOGLE_TASKS_LIST_GROCERIES_ID=<paste-groceries-id-here>');
  }

  console.log('\n' + bar());
  console.log('  GOOGLE CALENDAR — Calendars you can read');
  console.log(bar());
  const cals = await listCalendars(token);
  if (cals === null) {
    console.log('(scope missing) — calendar.readonly is not on this refresh token.');
    console.log('Re-run scripts/mint-google-token.mjs after revoking access at');
    console.log('https://myaccount.google.com/permissions, then re-run this script.');
  } else if (cals.length === 0) {
    console.log('(none)');
  } else {
    for (const c of cals) {
      const flags = [c.primary ? 'primary' : '', c.accessRole].filter(Boolean).join(', ');
      console.log(`  • ${c.summary}  [${flags}]`);
      console.log(`    ${c.id}`);
    }
    console.log();
    console.log('  Pick the calendars you want on the dashboard, shape as JSON:');
    console.log('    GOOGLE_CALENDARS_JSON=[{"label":"Family","id":"abc@group.calendar.google.com"},{"label":"Tim","id":"primary"}]');
  }

  console.log();
}

main()
  .then(() => rl.close())
  .catch(err => { console.error('FAILED:', err.message); rl.close(); process.exit(1); });
