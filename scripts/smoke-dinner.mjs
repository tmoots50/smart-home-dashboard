#!/usr/bin/env node
// E2E smoke for the dinner-lane flow (Nigel's meal-planning path):
//
//   1. POST a "Dinner: …" all-day event to the Family calendar via the same
//      /api/calendar/events endpoint the Hermes calendar helpers use
//   2. GET the widget's upcoming feed and assert the event round-trips
//   3. Run the REAL lane extractor (app/src/lib/meals.js dinnersByDay) on the
//      feed and assert the meal lands on the right day, prefix stripped
//   4. DELETE the probe event and assert it's gone
//   5. Report the dinner lane for the wall's current 5-day window (info)
//
// The probe date sits ~45 days out: inside the 90-day upcoming window (so the
// feed sees it) but outside the wall's pageable week-grid range (so it never
// flashes on the tablet mid-smoke).
//
// Usage:  source .envrc.local && node scripts/smoke-dinner.mjs
// Token:  DASHBOARD_TOKEN env if set; otherwise fetched from the CF Pages
//         project env via CLOUDFLARE_* creds (the same probe agents already
//         use — no browser required).

import { dinnersByDay } from '../app/src/lib/meals.js';

const BASE = process.env.DASHBOARD_BASE || 'https://smart-home-dashboard-de0.pages.dev';

function fail(msg) { console.error(`✗ ${msg}`); process.exit(1); }
function ok(msg) { console.log(`✓ ${msg}`); }

async function resolveToken() {
  if (process.env.DASHBOARD_TOKEN) return process.env.DASHBOARD_TOKEN;
  const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_PAGES_PROJECT } = process.env;
  if (!CLOUDFLARE_API_TOKEN) fail('set DASHBOARD_TOKEN or source .envrc.local for CF creds');
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${CLOUDFLARE_PAGES_PROJECT}`,
    { headers: { authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` } },
  );
  if (!res.ok) fail(`CF API ${res.status} while resolving DASHBOARD_TOKEN`);
  const data = await res.json();
  const tok = data?.result?.deployment_configs?.production?.env_vars?.DASHBOARD_TOKEN?.value;
  if (!tok) fail('DASHBOARD_TOKEN not found in CF Pages production env');
  return tok;
}

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const TOKEN = await resolveToken();
const headers = { authorization: `Bearer ${TOKEN}` };

// Every GET carries a cache-buster: the UI window of /api/calendar/upcoming is
// edge-cached 5 min, and a smoke that reads its own stale write is no smoke.
async function getEvents(timeMin, timeMax) {
  const url = `${BASE}/api/calendar/upcoming?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&_=${Date.now()}`;
  const res = await fetch(url, { headers });
  if (!res.ok) fail(`GET upcoming ${res.status}: ${await res.text().catch(() => '')}`);
  return (await res.json()).events ?? [];
}

const today = new Date(); today.setHours(0, 0, 0, 0);
const probeDay = ymd(addDays(today, 45));
const probeMeal = `Smoke ${Date.now().toString(36)}`; // unique per run — no dupes if a prior run died mid-flight

// 1. create through Nigel's endpoint
const createRes = await fetch(`${BASE}/api/calendar/events`, {
  method: 'POST',
  headers: { ...headers, 'content-type': 'application/json' },
  body: JSON.stringify({ calendar: 'Family', summary: `Dinner: ${probeMeal}`, start: probeDay, allDay: true }),
});
if (!createRes.ok) fail(`POST event ${createRes.status}: ${await createRes.text().catch(() => '')}`);
const { id } = await createRes.json();
if (!id) fail('create returned no event id');
ok(`created "Dinner: ${probeMeal}" on ${probeDay} (id ${id})`);

try {
  // 2. the feed sees it
  const windowMin = `${probeDay}T00:00:00-04:00`;
  const windowMax = `${ymd(addDays(today, 47))}T00:00:00-04:00`;
  const events = await getEvents(windowMin, windowMax);
  const found = events.find(e => e.id === id);
  if (!found) fail('created event missing from the upcoming feed');
  if (!found.allDay) fail('created event lost its all-day flag in the feed');
  ok('event round-trips through /api/calendar/upcoming');

  // 3. the real lane extractor picks it up, prefix stripped, right day
  const lane = dinnersByDay(events);
  const meal = lane.get(probeDay);
  if (!meal) fail(`dinnersByDay has no entry for ${probeDay}`);
  if (meal.label !== probeMeal) fail(`lane label "${meal.label}" ≠ "${probeMeal}" (prefix strip broken?)`);
  ok(`lane extractor maps ${probeDay} → "${meal.label}"`);
} finally {
  // 4. clean up (runs even if an assertion failed us out via process.exit? no —
  // process.exit skips finally on the paths above that already exited; the
  // unique title keeps any orphan identifiable and harmless at +45 days out).
  const delRes = await fetch(`${BASE}/api/calendar/events/${encodeURIComponent(id)}?calendar=Family`, {
    method: 'DELETE', headers,
  });
  if (!delRes.ok && delRes.status !== 204) fail(`DELETE ${delRes.status}: ${await delRes.text().catch(() => '')}`);
  ok('probe event deleted');
}

const goneCheck = await getEvents(`${probeDay}T00:00:00-04:00`, `${ymd(addDays(today, 47))}T00:00:00-04:00`);
if (goneCheck.some(e => e.id === id)) fail('probe event still in the feed after delete');
ok('feed confirms deletion');

// 5. info: what the wall's dinner lane shows for the current window
const wallEvents = await getEvents(today.toISOString(), addDays(today, 5).toISOString());
const wallLane = dinnersByDay(wallEvents);
console.log('\nDinner lane, next 5 days:');
for (let i = 0; i < 5; i++) {
  const day = ymd(addDays(today, i));
  console.log(`  ${day}  ${wallLane.get(day)?.label ?? '—'}`);
}
console.log('\nAll dinner-flow smoke checks passed.');
