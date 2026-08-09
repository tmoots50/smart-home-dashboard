import { getMockStandup } from './standup-mock.js';

const TOKEN = import.meta.env.VITE_DASHBOARD_TOKEN;
const CACHE_KEY = 'standup:v1';
const CACHE_TTL_MS = 5 * 60 * 1000;
const STALE_MAX_MS = 24 * 60 * 60 * 1000;

const loading = () => ({
  state: 'loading',
  source: 'linear',
  freshness: 'Linear · loading',
  message: 'Loading Linear standup…',
  agents: [],
  unresolved: [],
  truncated: 0,
  sourceTruncated: false,
});

const unavailable = () => ({
  state: 'unavailable',
  source: 'linear',
  freshness: 'Linear · unavailable',
  message: 'Linear standup is temporarily unavailable.',
  agents: [],
  unresolved: [],
  truncated: 0,
  sourceTruncated: false,
});

export async function fetchStandup() {
  const response = await fetch('/api/standup', {
    headers: { authorization: `Bearer ${TOKEN}` },
    cache: 'no-store',
  });
  const data = await response.json().catch(() => null);
  if (data?.state === 'unavailable') return data;
  if (!response.ok) throw new Error(`standup: ${response.status}`);
  if (!Array.isArray(data?.agents) || data.agents.length !== 5) {
    throw new Error('standup: malformed payload');
  }
  writeCache(data);
  return data;
}

export function getStandup() {
  if (!TOKEN) {
    const initial = getMockStandup();
    return { initial, live: Promise.resolve(initial) };
  }

  const cached = readCache();
  const stale = cached.stale ? markStale(cached.stale, cached.at) : null;
  const initial = cached.fresh || stale || loading();
  const live = fetchStandup().catch(() => stale || unavailable());
  return { initial, live };
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return { fresh: null, stale: null, at: 0 };
    const { at, data } = JSON.parse(raw);
    const age = Date.now() - at;
    return {
      fresh: age <= CACHE_TTL_MS ? data : null,
      stale: age <= STALE_MAX_MS ? data : null,
      at,
    };
  } catch {
    return { fresh: null, stale: null, at: 0 };
  }
}

function writeCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data })); }
  catch {}
}

function markStale(data, at) {
  const time = new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return {
    ...data,
    state: 'stale',
    freshness: `Linear · stale since ${time}`,
    message: 'Live Linear is unavailable; showing last-known data.',
  };
}

export const isConfigured = Boolean(TOKEN);
