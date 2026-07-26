// Home Assistant helper for the /api/home* CF Pages Functions.
//
// Config (CF Pages env vars — server-side, never in the bundle):
//   HA_BASE_URL          e.g. https://ha.example.ts.net (reached via Cloudflare Tunnel)
//   HA_TOKEN             a dedicated HA long-lived access token (revocable)
//   HA_ENTITIES_JSON     the allowlist + display names, shaped:
//                        { "lock": {"id":"lock.front_door","name":"Front Door"},
//                          "plugs":[{"id":"switch.living_room_lamp","name":"Living Room Lamp"}] }
//
// SAFETY: only entities named in HA_ENTITIES_JSON — plus dashboard-registered
// devices in the HOME_DEVICES KV registry — are ever read or actuated. A
// control request for any other entity id is rejected — the allowlist is the
// guard against a caller reaching arbitrary HA entities (path-traversal is the
// classic foot-gun for a proxy like this).
//
// The KV registry ("add a device from the wall") is deliberately weaker than
// the env allowlist and deliberately CONSTRAINED: only switch./light. entity
// ids are accepted (see validateDevice), so the registry can grow low-
// consequence toggles but can never add a lock, cover, or alarm. Anything
// sensitive still requires an env change + its own second factor.

const DEVICES_KEY = 'devices';
const DEVICES_MAX = 12;

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

// Is `id` an allowlisted plug (env allowlist or KV registry)?
// Returns the plug config or null.
export async function allowedPlug(env, id) {
  const envPlug = parseEntities(env).plugs.find(p => p.id === id);
  if (envPlug) return envPlug;
  const registry = await listDevices(env);
  return registry.find(p => p.id === id) || null;
}

// ───── dashboard-registered device registry (KV) ─────

// Pure validation for a registry entry. Only toggleable, low-consequence
// domains — the registry must never be a path to actuating a lock.
export function validateDevice(raw) {
  const id = (raw?.id || '').toString().trim();
  const name = (raw?.name || '').toString().trim();
  if (!/^(switch|light)\.[a-z0-9_]+$/.test(id)) {
    return { ok: false, error: 'id must be a switch.* or light.* entity id' };
  }
  if (!name || name.length > 40) {
    return { ok: false, error: 'name required (max 40 chars)' };
  }
  return { ok: true, value: { id, name } };
}

export async function listDevices(env) {
  const kv = env.HOME_DEVICES;
  if (!kv) return [];
  try {
    const raw = await kv.get(DEVICES_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function addDevice(env, device) {
  const kv = env.HOME_DEVICES;
  if (!kv) throw Object.assign(new Error('HOME_DEVICES KV unbound'), { status: 501 });
  const devices = await listDevices(env);
  if (devices.length >= DEVICES_MAX) {
    throw Object.assign(new Error(`registry full (max ${DEVICES_MAX})`), { status: 409 });
  }
  const envIds = new Set(parseEntities(env).plugs.map(p => p.id));
  if (envIds.has(device.id) || devices.some(d => d.id === device.id)) {
    throw Object.assign(new Error('device already registered'), { status: 409 });
  }
  const next = [...devices, device];
  await kv.put(DEVICES_KEY, JSON.stringify(next));
  return next;
}

export async function removeDevice(env, id) {
  const kv = env.HOME_DEVICES;
  if (!kv) throw Object.assign(new Error('HOME_DEVICES KV unbound'), { status: 501 });
  const devices = await listDevices(env);
  const next = devices.filter(d => d.id !== id);
  if (next.length === devices.length) {
    throw Object.assign(new Error('not registered (env-configured devices are removed via HA_ENTITIES_JSON)'), { status: 404 });
  }
  await kv.put(DEVICES_KEY, JSON.stringify(next));
  return next;
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
      // HA sits behind Cloudflare Access; the service token opens the door
      // (Access's non_identity policy), then HA's own Bearer auth applies.
      ...(env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET ? {
        'cf-access-client-id': env.CF_ACCESS_CLIENT_ID,
        'cf-access-client-secret': env.CF_ACCESS_CLIENT_SECRET,
      } : {}),
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

// Read the whole allowlisted surface (env allowlist + KV registry) into the
// dashboard's shape. Registry devices carry custom:true so the UI can offer
// remove on them (env-configured ones can't be removed from the wall).
export async function readHome(env) {
  const { lock, plugs } = parseEntities(env);
  const registry = await listDevices(env);
  const all = [
    ...plugs.map(p => ({ ...p, custom: false })),
    ...registry.filter(d => !plugs.some(p => p.id === d.id)).map(d => ({ ...d, custom: true })),
  ];
  const [lockState, ...plugStates] = await Promise.all([
    lock ? getState(env, lock.id) : Promise.resolve(null),
    ...all.map(p => getState(env, p.id).catch(() => null)), // one dead device ≠ dead card
  ]);
  return {
    lock: lock && lockState ? {
      id: lock.id,
      name: lock.name,
      state: lockState.state, // 'locked' | 'unlocked' | 'jammed' | 'unknown'
      battery: batteryOf(lockState),
    } : null,
    plugs: all.map((p, i) => ({
      id: p.id,
      name: p.name,
      on: plugStates[i]?.state === 'on',
      custom: p.custom,
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
