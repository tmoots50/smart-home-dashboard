import { describe, it, expect } from 'vitest';
import { parseEntities, allowedPlug, isLockEntity, validateDevice, listDevices, addDevice, removeDevice, readHome } from './ha.js';

// Minimal in-memory KV double (get/put/delete on a Map).
function fakeKv(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    get: async (k) => store.get(k) ?? null,
    put: async (k, v) => { store.set(k, v); },
    delete: async (k) => { store.delete(k); },
    _store: store,
  };
}

const ENTITIES = JSON.stringify({
  lock: { id: 'lock.front_door', name: 'Front Door' },
  plugs: [
    { id: 'switch.lamp', name: 'Lamp' },
    { id: 'switch.fan', name: 'Fan' },
  ],
});


describe('entity allowlist', () => {
  const env = { HA_ENTITIES_JSON: ENTITIES };

  it('parses lock + plugs', () => {
    const { lock, plugs } = parseEntities(env);
    expect(lock.id).toBe('lock.front_door');
    expect(plugs).toHaveLength(2);
  });

  it('allows only allowlisted plugs', async () => {
    expect(await allowedPlug(env, 'switch.lamp')).toBeTruthy();
    expect(await allowedPlug(env, 'switch.not_mine')).toBeNull();
    expect(await allowedPlug(env, 'lock.front_door')).toBeNull(); // lock is not a plug
  });

  it('also allows KV-registered devices', async () => {
    const kvEnv = {
      HA_ENTITIES_JSON: ENTITIES,
      HOME_DEVICES: fakeKv({ devices: JSON.stringify([{ id: 'switch.grow_light', name: 'Grow Light' }]) }),
    };
    expect(await allowedPlug(kvEnv, 'switch.grow_light')).toBeTruthy();
    expect(await allowedPlug(kvEnv, 'switch.not_mine')).toBeNull();
  });

  it('recognizes only the configured lock entity', () => {
    expect(isLockEntity(env, 'lock.front_door')).toBe(true);
    expect(isLockEntity(env, 'lock.back_door')).toBe(false);
  });

  it('degrades to empty on malformed JSON', () => {
    const { lock, plugs } = parseEntities({ HA_ENTITIES_JSON: '{not json' });
    expect(lock).toBeNull();
    expect(plugs).toEqual([]);
  });
});

describe('device registry', () => {
  it('validateDevice accepts only switch./light. entity ids', () => {
    expect(validateDevice({ id: 'switch.grow_light', name: 'Grow Light' }).ok).toBe(true);
    expect(validateDevice({ id: 'light.nursery', name: 'Nursery Light' }).ok).toBe(true);
    // the registry must never be able to add a lock or arbitrary entity
    expect(validateDevice({ id: 'lock.front_door', name: 'Door' }).ok).toBe(false);
    expect(validateDevice({ id: 'alarm_control_panel.home', name: 'Alarm' }).ok).toBe(false);
    expect(validateDevice({ id: 'switch.bad id!', name: 'X' }).ok).toBe(false);
    expect(validateDevice({ id: 'switch.ok', name: '' }).ok).toBe(false);
    expect(validateDevice({ id: 'switch.ok', name: 'x'.repeat(41) }).ok).toBe(false);
  });

  it('add / list / remove round-trip through KV', async () => {
    const env = { HA_ENTITIES_JSON: JSON.stringify({ plugs: [] }), HOME_DEVICES: fakeKv() };
    await addDevice(env, { id: 'switch.a', name: 'A' });
    await addDevice(env, { id: 'switch.b', name: 'B' });
    expect(await listDevices(env)).toHaveLength(2);
    await removeDevice(env, 'switch.a');
    expect(await listDevices(env)).toEqual([{ id: 'switch.b', name: 'B' }]);
  });

  it('rejects duplicates against both the registry and the env allowlist', async () => {
    const env = { HA_ENTITIES_JSON: ENTITIES, HOME_DEVICES: fakeKv() };
    await expect(addDevice(env, { id: 'switch.lamp', name: 'Dup of env' })).rejects.toThrow(/already/);
    await addDevice(env, { id: 'switch.new', name: 'New' });
    await expect(addDevice(env, { id: 'switch.new', name: 'Dup of registry' })).rejects.toThrow(/already/);
  });

  it('removeDevice refuses env-configured entities', async () => {
    const env = { HA_ENTITIES_JSON: ENTITIES, HOME_DEVICES: fakeKv() };
    await expect(removeDevice(env, 'switch.lamp')).rejects.toThrow(/not registered/);
  });

  it('readHome merges registry devices with custom:true', async () => {
    const env = {
      HA_BASE_URL: 'https://ha.test',
      HA_TOKEN: 't',
      HA_ENTITIES_JSON: ENTITIES,
      HOME_DEVICES: fakeKv({ devices: JSON.stringify([{ id: 'switch.grow_light', name: 'Grow Light' }]) }),
    };
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url) => ({
      ok: true,
      json: async () => ({ state: String(url).includes('lock.') ? 'locked' : 'on', attributes: { battery_level: 80 } }),
    });
    try {
      const home = await readHome(env);
      expect(home.plugs.map(p => [p.id, p.custom])).toEqual([
        ['switch.lamp', false],
        ['switch.fan', false],
        ['switch.grow_light', true],
      ]);
      expect(home.lock.state).toBe('locked');
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('readHome reads battery from a separate sensor entity when batteryId is configured', async () => {
    const entitiesWithBattery = JSON.stringify({
      lock: { id: 'lock.front_door', name: 'Front Door', batteryId: 'sensor.front_door_battery' },
      plugs: [{ id: 'switch.lamp', name: 'Lamp' }],
    });
    const env = {
      HA_BASE_URL: 'https://ha.test',
      HA_TOKEN: 't',
      HA_ENTITIES_JSON: entitiesWithBattery,
      HOME_DEVICES: fakeKv(),
    };
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes('sensor.front_door_battery')) return { ok: true, json: async () => ({ state: '97', attributes: {} }) };
      if (u.includes('lock.front_door')) return { ok: true, json: async () => ({ state: 'locked', attributes: {} }) };
      return { ok: true, json: async () => ({ state: 'on', attributes: {} }) };
    };
    try {
      const home = await readHome(env);
      expect(home.lock.battery).toBe(97);
      expect(home.lock.state).toBe('locked');
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('readHome falls back to lock entity attributes when no batteryId is configured', async () => {
    const env = {
      HA_BASE_URL: 'https://ha.test',
      HA_TOKEN: 't',
      HA_ENTITIES_JSON: ENTITIES, // no batteryId
      HOME_DEVICES: fakeKv(),
    };
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ state: 'locked', attributes: { battery_level: 55 } }),
    });
    try {
      const home = await readHome(env);
      expect(home.lock.battery).toBe(55);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
