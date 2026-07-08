import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHomeCard, mountHomeCard } from './home-card.js';
import { _resetToasts } from './toast.js';

const DATA = {
  lock: { id: 'lock.front_door', name: 'Front Door', state: 'locked', battery: 87 },
  plugs: [
    { id: 'switch.living_room_lamp', name: 'Living Room Lamp', on: true, custom: false },
    { id: 'switch.grow_light', name: 'Grow Light', on: false, custom: true },
  ],
};

const sourceOf = (data) => () => ({ initial: structuredClone(data), live: Promise.resolve(null) });

describe('renderHomeCard', () => {
  it('shows lock state + battery and one row per plug', () => {
    const html = renderHomeCard(DATA);
    expect(html).toContain('Front Door');
    expect(html).toContain('Locked · 87%');
    expect(html).toContain('Living Room Lamp');
    expect(html).toContain('Grow Light');
  });

  it('offers remove only on registry (custom) devices', () => {
    const html = renderHomeCard(DATA);
    expect(html.match(/data-action="remove-device"/g)).toHaveLength(1);
    expect(html).toContain('data-action="remove-device" data-id="switch.grow_light"');
  });

  it('renders the add form when adding', () => {
    const html = renderHomeCard(DATA, { adding: true });
    expect(html).toContain('data-field="name"');
    expect(html).not.toContain('data-field="id"'); // mock mode: id is derived
    const live = renderHomeCard(DATA, { adding: true, askEntityId: true });
    expect(live).toContain('data-field="id"');
  });

  it('escapes device names', () => {
    const html = renderHomeCard({ lock: null, plugs: [{ id: 'switch.x', name: '<b>x</b>', on: false }] });
    expect(html).not.toContain('<b>x</b>');
  });
});

describe('mountHomeCard', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    _resetToasts();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('toggles a plug optimistically and reverts on failure', async () => {
    const slot = document.createElement('div');
    document.body.appendChild(slot);
    const actions = { setPlug: vi.fn().mockRejectedValue(new Error('boom')), setLock: vi.fn() };
    mountHomeCard(slot, sourceOf(DATA), actions, null);
    const lamp = slot.querySelector('[data-id="switch.living_room_lamp"]');
    expect(lamp.getAttribute('aria-checked')).toBe('true');
    lamp.click();
    expect(slot.querySelector('[data-id="switch.living_room_lamp"]').getAttribute('aria-checked')).toBe('false');
    expect(actions.setPlug).toHaveBeenCalledWith('switch.living_room_lamp', false);
    await vi.advanceTimersByTimeAsync(0); // flush the rejection microtask (not the 60s refresh interval)
    expect(slot.querySelector('[data-id="switch.living_room_lamp"]').getAttribute('aria-checked')).toBe('true');
  });

  it('adds a device via the inline form (mock mode derives the entity id)', () => {
    const slot = document.createElement('div');
    document.body.appendChild(slot);
    const deviceActions = { add: vi.fn(() => Promise.resolve([])), remove: vi.fn() };
    mountHomeCard(slot, sourceOf(DATA), { setPlug: vi.fn(), setLock: vi.fn() }, deviceActions);
    slot.querySelector('[data-action="add-device"]').click();
    const name = slot.querySelector('[data-field="name"]');
    name.value = 'Grow Light 2';
    name.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(deviceActions.add).toHaveBeenCalledWith({ id: 'switch.grow_light_2', name: 'Grow Light 2' });
    expect(slot.innerHTML).toContain('Grow Light 2');
  });

  it('removes a registry device with undo — commit deferred to toast expiry', async () => {
    const slot = document.createElement('div');
    document.body.appendChild(slot);
    const deviceActions = { add: vi.fn(), remove: vi.fn(() => Promise.resolve([])) };
    mountHomeCard(slot, sourceOf(DATA), { setPlug: vi.fn(), setLock: vi.fn() }, deviceActions);

    slot.querySelector('[data-action="remove-device"]').click();
    expect(slot.innerHTML).not.toContain('Grow Light');
    expect(deviceActions.remove).not.toHaveBeenCalled();

    document.querySelector('.toast__action').click(); // undo
    expect(slot.innerHTML).toContain('Grow Light');
    vi.advanceTimersByTime(10_000);
    expect(deviceActions.remove).not.toHaveBeenCalled();

    slot.querySelector('[data-action="remove-device"]').click();
    await vi.advanceTimersByTimeAsync(5001);
    expect(deviceActions.remove).toHaveBeenCalledWith('switch.grow_light');
  });
});
