// Home Assistant helper for the /api/home* CF Pages Functions.
//
// Config (CF Pages env vars — server-side, never in the bundle):
//   HA_BASE_URL          e.g. https://ha.example.ts.net (reached via Cloudflare Tunnel)
//   HA_TOKEN             a dedicated HA long-lived access token (revocable)
//   HA_ENTITIES_JSON     the allowlist + display names, shaped:
//                        { "lock": {"id":"lock.front_door","name":"Front Door"},
//                          "plugs":[{"id":"switch.living_room_lamp","name":"Living Room Lamp"}] }
//   HOME_UNLOCK_PIN_HASH "<saltHex>:<sha256Hex>"  where hash = SHA-256(saltHex + pin)
//   HOME_LOCKOUT         (optional) KV namespace binding for unlock rate-limiting
//
// SAFETY: only entities named in HA_ENTITIES_JSON are ever read or actuated. A
// control request for any other entity id is rejected — the allowlist is the
// guard against a caller reaching arbitrary HA entities (path-traversal is the
// classic foot-gun for a proxy like this).

const MAX_FAILS = 5;
const LOCKOUT_WINDOW_S = 15 * 60;

export function haConfigured(env) {
  return Boolean(env.HA_BASE_URL && env.HA_TOKEN && env.HA_ENTITIES_JSON);
}

export function parseEntities(env) {
  try {
    const cfg = JSON.parse(env.HA_ENTITIES_JSON);
    return {
      lock: cfg.lock || null,
      plugs: Array.isArray(cfg.plugs) ? cfg.plugs : [],
    };
  } catch {
    return { lock: null, plugs: [] };
  }
}

// Is `id` an allowlisted plug? Returns the plug config or null.
export function allowedPlug(env, id) {
  return parseEntities(env).plugs.find(p => p.id === id) || null;
}

export function isLockEntity(env, id) {
  const { lock } = parseEntities(env);
  return Boolean(lock && lock.id === id);
}

async function haFetch(env, path, init = {}) {
  const res = await fetch(`${env.HA_BASE_URL}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.HA_TOKEN}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`HA ${path}: ${res.status} ${detail}`.slice(0, 300));
  }
  return res;
}

// One HA state fetch for a specific entity → { state, attributes }.
export async function getState(env, entityId) {
  const res = await haFetch(env, `/api/states/${encodeURIComponent(entityId)}`);
  return res.json();
}

// Read the whole allowlisted surface into the dashboard's shape.
export async function readHome(env) {
  const { lock, plugs } = parseEntities(env);
  const [lockState, ...plugStates] = await Promise.all([
    lock ? getState(env, lock.id) : Promise.resolve(null),
    ...plugs.map(p => getState(env, p.id)),
  ]);
  return {
    lock: lock && lockState ? {
      id: lock.id,
      name: lock.name,
      state: lockState.state, // 'locked' | 'unlocked' | 'jammed' | 'unknown'
      battery: batteryOf(lockState),
    } : null,
    plugs: plugs.map((p, i) => ({
      id: p.id,
      name: p.name,
      on: plugStates[i]?.state === 'on',
    })),
  };
}

function batteryOf(state) {
  const b = state?.attributes?.battery_level ?? state?.attributes?.battery;
  return b == null ? null : Math.round(Number(b));
}

// Call an HA service, e.g. domain='switch' service='turn_on'.
export async function callService(env, domain, service, entityId) {
  await haFetch(env, `/api/services/${domain}/${service}`, {
    method: 'POST',
    body: JSON.stringify({ entity_id: entityId }),
  });
}

// ───── PIN + lockout ─────

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPin(env, pin) {
  const stored = env.HOME_UNLOCK_PIN_HASH || '';
  const [salt, hash] = stored.split(':');
  if (!salt || !hash || !pin) return false;
  const computed = await sha256Hex(salt + pin);
  return timingSafeEqual(computed, hash);
}

// KV-backed lockout. Fails OPEN when no KV binding is present (PIN is still
// required) — log-and-allow beats blocking the family from their own door on a
// missing binding, but bind HOME_LOCKOUT in production. Tracks per-IP + global.
export async function isLockedOut(env, ip) {
  const kv = env.HOME_LOCKOUT;
  if (!kv) return false;
  const [perIp, global] = await Promise.all([
    kv.get(`fail:${ip}`), kv.get('fail:global'),
  ]);
  return Number(perIp || 0) >= MAX_FAILS || Number(global || 0) >= MAX_FAILS * 4;
}

export async function recordFail(env, ip) {
  const kv = env.HOME_LOCKOUT;
  if (!kv) return;
  await Promise.all([
    bump(kv, `fail:${ip}`),
    bump(kv, 'fail:global'),
  ]);
}

async function bump(kv, key) {
  const n = Number((await kv.get(key)) || 0) + 1;
  await kv.put(key, String(n), { expirationTtl: LOCKOUT_WINDOW_S });
}

export async function clearFails(env, ip) {
  const kv = env.HOME_LOCKOUT;
  if (!kv) return;
  await kv.delete(`fail:${ip}`);
}
