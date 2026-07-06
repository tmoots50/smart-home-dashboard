import { describe, it, expect } from 'vitest';
import { parseEntities, allowedPlug, isLockEntity, verifyPin } from './ha.js';

const ENTITIES = JSON.stringify({
  lock: { id: 'lock.front_door', name: 'Front Door' },
  plugs: [
    { id: 'switch.lamp', name: 'Lamp' },
    { id: 'switch.fan', name: 'Fan' },
  ],
});

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function makePinHash(salt, pin) {
  return `${salt}:${await sha256Hex(salt + pin)}`;
}

describe('entity allowlist', () => {
  const env = { HA_ENTITIES_JSON: ENTITIES };

  it('parses lock + plugs', () => {
    const { lock, plugs } = parseEntities(env);
    expect(lock.id).toBe('lock.front_door');
    expect(plugs).toHaveLength(2);
  });

  it('allows only allowlisted plugs', () => {
    expect(allowedPlug(env, 'switch.lamp')).toBeTruthy();
    expect(allowedPlug(env, 'switch.not_mine')).toBeNull();
    expect(allowedPlug(env, 'lock.front_door')).toBeNull(); // lock is not a plug
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

describe('verifyPin', () => {
  it('accepts the correct PIN and rejects wrong ones', async () => {
    const env = { HOME_UNLOCK_PIN_HASH: await makePinHash('a1b2c3', '135790') };
    expect(await verifyPin(env, '135790')).toBe(true);
    expect(await verifyPin(env, '000000')).toBe(false);
    expect(await verifyPin(env, '')).toBe(false);
  });

  it('rejects when no hash configured', async () => {
    expect(await verifyPin({}, '1234')).toBe(false);
    expect(await verifyPin({ HOME_UNLOCK_PIN_HASH: 'malformed' }, '1234')).toBe(false);
  });
});
