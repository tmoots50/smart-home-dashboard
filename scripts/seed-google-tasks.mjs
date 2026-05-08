#!/usr/bin/env node
// One-shot idempotent seeder for the dashboard's Google Tasks lists.
//
// Usage:
//   node --env-file=scripts/.env scripts/seed-google-tasks.mjs
//
// Or pass env vars directly:
//   GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… GOOGLE_REFRESH_TOKEN=… \
//   GOOGLE_TASKS_LIST_TODOS_ID=… GOOGLE_TASKS_LIST_GROCERIES_ID=… \
//   node scripts/seed-google-tasks.mjs
//
// Idempotent: skips any title that already exists (incomplete) in the list,
// so you can re-run safely. Order is preserved top-to-bottom via the Google
// Tasks API `previous` parameter on each insert.

// ──────────────────────────────────────────────────────────────────────────
// SEED DATA — edit here, re-run the script.
// ──────────────────────────────────────────────────────────────────────────

const TODOS = [
  // 4/29 active queue
  '4 apps',
  '8 outreaches',
  'Read product story out loud 3 times',
  'Pack up office',
  'Nanny research',
  'Schedule interviews',

  // Baby
  'Call Cigna about scam',
  'Confirm SSN arrives within 2 weeks',
  'Setup 529 Plan in GA for Mabel',
  'Steps to get birth certificate',

  // Tim
  'Book Atlanta Tech Village office',
  'Smart-enable the home',
  'Switch insurance to NOT GEICO',
  'Journal her birth story, get out baby book',
  'Help clean up our bathroom (wipe counters, wet swiffer floor, clean mirror)',
  'Purchase supplies for tablet project',
  'Sell stocks and move to index funds',
  'Natori Medical bill',
  'Garnish and gather bags',
  'Setup OpenClaw on personal comp',
  "Break out Cole's money",
  'GE stock',

  // Misc
  'Pick up Fete items',
  'Dentist ortho bill from 2024?',
  'Print emergency numbers for fridge',
];

const GROCERIES = [
  "bread - dave's bread",
  'swiss cheese',
  "turkey deli meat - boar's head",
  'chicken sausage',
  'iced coffee',
];

// ──────────────────────────────────────────────────────────────────────────

const BASE = 'https://tasks.googleapis.com/tasks/v1';

function require(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`missing env var: ${name}`);
    process.exit(1);
  }
  return v;
}

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: require('GOOGLE_CLIENT_ID'),
      client_secret: require('GOOGLE_CLIENT_SECRET'),
      refresh_token: require('GOOGLE_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`token refresh ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

async function listExisting(token, listId) {
  const url = new URL(`${BASE}/lists/${encodeURIComponent(listId)}/tasks`);
  url.searchParams.set('showCompleted', 'false');
  url.searchParams.set('maxResults', '100');
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`list ${res.status}: ${await res.text()}`);
  return ((await res.json()).items || []);
}

async function insert(token, listId, title, previous) {
  const url = new URL(`${BASE}/lists/${encodeURIComponent(listId)}/tasks`);
  if (previous) url.searchParams.set('previous', previous);
  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`insert ${res.status}: ${await res.text()}`);
  return res.json();
}

async function seedList(token, listId, items, label) {
  if (!items.length) {
    console.log(`[${label}] (empty seed — skipping)`);
    return;
  }
  console.log(`\n[${label}] checking existing items in list ${listId.slice(0, 12)}…`);
  const existing = await listExisting(token, listId);
  const existingTitles = new Set(existing.map(t => (t.title || '').trim().toLowerCase()));

  let previous = null; // we want first item at the TOP, then chain
  let added = 0, skipped = 0;
  for (const title of items) {
    if (existingTitles.has(title.trim().toLowerCase())) {
      console.log(`  · skip: ${title}`);
      skipped++;
      continue;
    }
    const created = await insert(token, listId, title, previous);
    console.log(`  + add:  ${title}`);
    previous = created.id;
    added++;
  }
  console.log(`[${label}] +${added} added, ${skipped} already present`);
}

async function main() {
  const token = await getAccessToken();
  // Only require the list ID if we actually have items to seed for it.
  if (TODOS.length) {
    await seedList(token, require('GOOGLE_TASKS_LIST_TODOS_ID'), TODOS, 'todos');
  } else {
    console.log('[todos] (empty seed — skipping)');
  }
  if (GROCERIES.length) {
    await seedList(token, require('GOOGLE_TASKS_LIST_GROCERIES_ID'), GROCERIES, 'groceries');
  } else {
    console.log('[groceries] (empty seed — skipping)');
  }
  console.log('\ndone.');
}

main().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
