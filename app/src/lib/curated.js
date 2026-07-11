// Client for /api/curated. Returns up to three current Atlanta picks as
// {initial, live} — mirrors lib/headlines.js (localStorage cache + token gate)
// so the card is never blank during dev or a short outage.
//
// Fallback chain, most-trustworthy first:
//   1. curated picks from Hermes (/api/curated .picks)
//   2. newest live RSS headline  (/api/headlines) — if Hermes hasn't posted yet
//   3. mock pick                 — dev / total outage
// So on a day Hermes is down the card still shows something real and local,
// just chosen by recency instead of taste.

import { getMockPicks } from './pick-mock.js';
import { fetchHeadlines } from './headlines.js';
import { getMockCountdowns } from './countdown-mock.js';

const TOKEN = import.meta.env.VITE_DASHBOARD_TOKEN;
const CACHE_KEY = 'picks:v3';
const CACHE_TTL_MS = 10 * 60 * 1000;

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw);
    if (Date.now() - at > CACHE_TTL_MS) return null;
    return data;
  } catch { return null; }
}

function writeCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data })); }
  catch {}
}

// RSS items carry no note; map one into the pick shape the widget renders.
function fromHeadline(h) {
  return { source: h.source, title: h.title, url: h.url || '', note: '' };
}

export async function fetchPicks() {
  let curated = [];
  let headlines = [];
  try {
    const res = await fetch('/api/curated', {
      headers: { authorization: `Bearer ${TOKEN}` },
      cache: 'no-store',
    });
    if (res.ok) curated = (await res.json()).picks ?? [];
  } catch { /* supplement entirely from RSS/mock */ }

  if (curated.filter(p => p?.title).length < 3) {
    try { headlines = (await fetchHeadlines()).map(fromHeadline); } catch {}
  }
  const picks = mergePicks(curated, headlines, getMockPicks());
  writeCache(picks);
  return picks;
}

export function mergePicks(...groups) {
  const seen = new Set();
  const result = [];
  for (const pick of groups.flat()) {
    if (!pick?.title) continue;
    const key = String(pick.url || pick.title).trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(pick);
    if (result.length === 3) break;
  }
  return result;
}

export async function fetchPick() { return (await fetchPicks())[0]; }

// Try curated → newest RSS headline → the initial frame. Never throws.
async function resolveLive(initial) {
  return fetchPicks().catch(() => initial);
}

export function getPicks() {
  const cached = readCache();
  const initial = cached ?? getMockPicks();
  const live = TOKEN ? resolveLive(initial) : Promise.resolve(initial);
  return { initial, live };
}

export function getDailyPick() {
  const { initial, live } = getPicks();
  return { initial: initial[0], live: live.then(picks => picks[0]) };
}

// ── Coming Up (Feature B): Hermes-curated events with action notes ──
//
// Trust model differs from the pick: when a curated blob EXISTS
// (generatedAt set), its comingUp is the truth even when empty — Hermes
// deciding "nothing needs prep" beats a stale mock. Only "no blob yet" or a
// failed fetch falls back to cache/mock.

const COMING_CACHE_KEY = 'comingup:v1';
const COMING_TTL_MS = 30 * 60 * 1000;

export async function fetchComingUp() {
  const res = await fetch('/api/curated', {
    headers: { authorization: `Bearer ${TOKEN}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`curated: ${res.status}`);
  const data = await res.json();
  if (!data.generatedAt) throw new Error('curated: no blob yet');
  const items = data.comingUp ?? [];
  try { localStorage.setItem(COMING_CACHE_KEY, JSON.stringify({ at: Date.now(), data: items })); } catch {}
  return items;
}

export function getComingUp() {
  let cached = null;
  try {
    const raw = localStorage.getItem(COMING_CACHE_KEY);
    if (raw) {
      const { at, data } = JSON.parse(raw);
      if (Date.now() - at <= COMING_TTL_MS) cached = data;
    }
  } catch { /* fall through to mock */ }
  const initial = cached ?? getMockCountdowns();
  const live = TOKEN ? fetchComingUp().catch(() => initial) : Promise.resolve(initial);
  return { initial, live };
}

export const isConfigured = Boolean(TOKEN);
