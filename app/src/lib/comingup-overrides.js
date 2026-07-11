// Client for /api/comingup — the Hermes ordering-override doc for the
// Coming-Up card. Same {initial, live} contract as the other data adapters:
// cached copy (or nothing) instantly, live fetch swaps in. Overrides are
// OPTIONAL by design — no token, no KV doc, or a failed fetch all resolve to
// an empty list and the rules engine's baseline order stands.

const TOKEN = import.meta.env.VITE_DASHBOARD_TOKEN;
const CACHE_KEY = 'comingup:overrides:v1';
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function fetchOverrides() {
  const res = await fetch('/api/comingup', {
    headers: { authorization: `Bearer ${TOKEN}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`comingup overrides: ${res.status}`);
  const data = await res.json();
  const overrides = Array.isArray(data.overrides) ? data.overrides : [];
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: overrides })); } catch {}
  return overrides;
}

export function getOverrides() {
  let cached = null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const { at, data } = JSON.parse(raw);
      if (Date.now() - at <= CACHE_TTL_MS) cached = data;
    }
  } catch { /* fall through */ }
  const initial = cached ?? [];
  const live = TOKEN
    ? fetchOverrides().catch(() => initial)
    : Promise.resolve(initial);
  return { initial, live };
}
