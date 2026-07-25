import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, openHomeOverlay } from './home.js';
import { getMockHome } from '../lib/home-mock.js';

const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

// The four real lamp entities (mirrors HA / home-mock).
const LAMPS = [
  'switch.living_room_side_lamp',
  'switch.den_left_lamp',
  'switch.den_right_lamp',
  'switch.den_den_lamp',
];

describe('render (pure)', () => {
  it('shows lock name and state', () => {
    const html = render(getMockHome());
    expect(html).toContain('Front Door');
    expect(html).toContain('Locked');
  });

  it('renders battery when present, omits it when null', () => {
    expect(render({ lock: { id: 'l', name: 'Door', state: 'locked', battery: 42 }, plugs: [] }))
      .toContain('42%');
    expect(render({ lock: { id: 'l', name: 'Door', state: 'locked', battery: null }, plugs: [] }))
      .not.toContain('%');
  });

  it('offers Unlock when locked, Lock when unlocked', () => {
    const locked = render({ lock: { id: 'l', name: 'Door', state: 'locked', battery: 50 }, plugs: [] });
    expect(locked).toContain('data-action="unlock"');
    const unlocked = render({ lock: { id: 'l', name: 'Door', state: 'unlocked', battery: 50 }, plugs: [] });
    expect(unlocked).toContain('data-action="lock"');
  });

  it('never renders a PIN pad', () => {
    expect(render(getMockHome())).not.toContain('pinpad');
    expect(render({ lock: { id: 'l', name: 'Door', state: 'locked', battery: 50 }, plugs: [] }))
      .not.toContain('pinpad');
  });

  it('renders the four scene modes', () => {
    const html = render(getMockHome());
    for (const m of ['morning', 'evening', 'baby', 'night']) {
      expect(html).toContain(`data-mode="${m}"`);
    }
  });

  it('collapses the device list by default — count shown, tiles hidden', () => {
    const html = render(getMockHome());
    expect(html).toContain('data-action="toggle-plugs"');
    expect(html).toContain('home__devices-count">4<');   // 4 lamps
    expect(html).not.toContain('home-tile--plug');        // individual tiles not rendered
  });

  it('renders plug tiles with on/off state when expanded', () => {
    const data = { lock: { id: 'l', name: 'Door', state: 'locked', battery: null }, plugs: [
      { id: 'switch.a', name: 'Lamp A', on: true },
      { id: 'switch.b', name: 'Lamp B', on: false },
    ] };
    const html = render(data, { plugsOpen: true });
    expect(html).toContain('Lamp A');
    expect(html).toContain('is-on');
    expect(html).toContain('is-off');
    expect(html).toContain('aria-checked="true"');
  });
});

describe('openHomeOverlay (interactive, local-mock mode)', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  const source = () => ({ initial: getMockHome(), live: Promise.resolve(null) });
  const openDevices = () => click(document.querySelector('[data-action="toggle-plugs"]'));
  const isOn = (id) => document.querySelector(`[data-id="${id}"]`).className.includes('is-on');

  it('mounts and unmounts', () => {
    const close = openHomeOverlay(source(), null);
    expect(document.querySelector('.home-overlay')).toBeTruthy();
    close();
    expect(document.querySelector('.home-overlay')).toBeNull();
  });

  it('expands the collapsed device list on tap', () => {
    openHomeOverlay(source(), null);
    expect(document.querySelector('.home-tile--plug')).toBeNull();
    openDevices();
    expect(document.querySelectorAll('.home-tile--plug').length).toBe(4);
  });

  it('toggles a plug locally with no backend', () => {
    openHomeOverlay(source(), null);
    openDevices();
    const lamp = document.querySelector('[data-id="switch.den_left_lamp"]');
    expect(lamp.className).toContain('is-on');
    click(lamp);
    expect(document.querySelector('[data-id="switch.den_left_lamp"]').className).toContain('is-off');
  });

  it('unlock is one tap — no PIN — and flips the lock to unlocked', () => {
    openHomeOverlay(source(), null);
    click(document.querySelector('[data-action="unlock"]'));
    expect(document.querySelector('.pinpad')).toBeNull();
    expect(document.querySelector('.home-tile--lock').className).toContain('is-unlocked');
    expect(document.querySelector('[data-action="lock"]')).toBeTruthy();
  });

  it('Night turns every lamp off', () => {
    openHomeOverlay(source(), null);
    click(document.querySelector('[data-mode="night"]'));
    openDevices();
    for (const id of LAMPS) expect(isOn(id)).toBe(false);
  });

  it('Morning turns every lamp on (after Night)', () => {
    openHomeOverlay(source(), null);
    click(document.querySelector('[data-mode="night"]'));
    click(document.querySelector('[data-mode="morning"]'));
    openDevices();
    for (const id of LAMPS) expect(isOn(id)).toBe(true);
  });

  it('Baby leaves only the Left lamp on', () => {
    openHomeOverlay(source(), null);
    click(document.querySelector('[data-mode="baby"]'));
    openDevices();
    expect(isOn('switch.den_left_lamp')).toBe(true);
    expect(isOn('switch.den_den_lamp')).toBe(false);
    expect(isOn('switch.living_room_side_lamp')).toBe(false);
    expect(isOn('switch.den_right_lamp')).toBe(false);
  });

  it('Evening turns off only the Den lamp', () => {
    openHomeOverlay(source(), null);
    click(document.querySelector('[data-mode="evening"]'));
    openDevices();
    expect(isOn('switch.den_den_lamp')).toBe(false);
    expect(isOn('switch.den_left_lamp')).toBe(true);
    expect(isOn('switch.living_room_side_lamp')).toBe(true);
    expect(isOn('switch.den_right_lamp')).toBe(true);
  });
});

describe('openHomeOverlay (live mode, with actions)', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  const source = () => ({ initial: getMockHome(), live: Promise.resolve(null) });

  it('rolls back a plug toggle if the backend rejects', async () => {
    const actions = { setPlug: vi.fn().mockRejectedValue(new Error('boom')), setLock: vi.fn() };
    openHomeOverlay(source(), actions);
    click(document.querySelector('[data-action="toggle-plugs"]')); // expand
    const lamp = document.querySelector('[data-id="switch.den_left_lamp"]'); // starts on
    expect(lamp.className).toContain('is-on');
    click(lamp);
    // optimistic → off, then rejection reverts → on
    await Promise.resolve(); await Promise.resolve();
    expect(actions.setPlug).toHaveBeenCalledWith('switch.den_left_lamp', false);
    expect(document.querySelector('[data-id="switch.den_left_lamp"]').className).toContain('is-on');
  });

  it('Night calls setPlug(false) for every lamp that was on', () => {
    const actions = { setPlug: vi.fn().mockResolvedValue({}), setLock: vi.fn() };
    openHomeOverlay(source(), actions);
    click(document.querySelector('[data-mode="night"]'));
    const offCalls = actions.setPlug.mock.calls.filter(c => c[1] === false).map(c => c[0]).sort();
    expect(offCalls).toEqual([...LAMPS].sort());
  });

  it('Baby only actuates the lamps that change (Left already on → no call)', () => {
    const actions = { setPlug: vi.fn().mockResolvedValue({}), setLock: vi.fn() };
    openHomeOverlay(source(), actions);
    click(document.querySelector('[data-mode="baby"]'));
    const ids = actions.setPlug.mock.calls.map(c => `${c[0]}:${c[1]}`).sort();
    expect(ids).toEqual([
      'switch.den_den_lamp:false',
      'switch.den_right_lamp:false',
      'switch.living_room_side_lamp:false',
    ]);
  });

  it("calls setLock('unlock') on a one-tap unlock — no PIN argument", () => {
    const actions = { setPlug: vi.fn(), setLock: vi.fn().mockResolvedValue({}) };
    openHomeOverlay(source(), actions);
    click(document.querySelector('[data-action="unlock"]'));
    expect(actions.setLock).toHaveBeenCalledWith('unlock');
  });

  it('reverts the lock if the backend rejects unlock', async () => {
    const actions = { setPlug: vi.fn(), setLock: vi.fn().mockRejectedValue(new Error('boom')) };
    openHomeOverlay(source(), actions);
    click(document.querySelector('[data-action="unlock"]'));
    // optimistic → unlocked, then rejection reverts → locked
    await Promise.resolve(); await Promise.resolve();
    expect(document.querySelector('.home-tile--lock').className).toContain('is-locked');
  });
});
