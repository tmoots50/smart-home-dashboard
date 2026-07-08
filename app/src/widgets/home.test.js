import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, openHomeOverlay } from './home.js';
import { getMockHome } from '../lib/home-mock.js';

const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

describe('render (pure)', () => {
  it('shows lock name, state, and battery', () => {
    const html = render(getMockHome());
    expect(html).toContain('Front Door');
    expect(html).toContain('Locked');
    expect(html).toContain('87%');
  });

  it('offers Unlock when locked, Lock when unlocked', () => {
    const locked = render({ lock: { id: 'l', name: 'Door', state: 'locked', battery: 50 }, plugs: [] });
    expect(locked).toContain('data-action="ask-unlock"');
    const unlocked = render({ lock: { id: 'l', name: 'Door', state: 'unlocked', battery: 50 }, plugs: [] });
    expect(unlocked).toContain('data-action="lock"');
  });

  it('renders plugs with on/off state', () => {
    const html = render(getMockHome());
    expect(html).toContain('Living Room Lamp');
    expect(html).toContain('is-on');
    expect(html).toContain('is-off');
    expect(html).toContain('aria-checked="true"');
  });

  it('shows the PIN pad only in pinMode and gates submit on length', () => {
    const base = getMockHome();
    expect(render(base)).not.toContain('pinpad');
    const short = render(base, { pinMode: true, pin: '12' });
    expect(short).toContain('pinpad');
    expect(short).toMatch(/pin-submit"[^>]*disabled/);
    const long = render(base, { pinMode: true, pin: '1234' });
    expect(long).not.toMatch(/pin-submit"[^>]*disabled/);
  });
});

describe('openHomeOverlay (interactive, local-mock mode)', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  const source = () => ({ initial: getMockHome(), live: Promise.resolve(null) });

  it('mounts and unmounts', () => {
    const close = openHomeOverlay(source(), null);
    expect(document.querySelector('.home-overlay')).toBeTruthy();
    close();
    expect(document.querySelector('.home-overlay')).toBeNull();
  });

  it('toggles a plug locally with no backend', () => {
    openHomeOverlay(source(), null);
    const lamp = document.querySelector('[data-id="switch.living_room_lamp"]');
    expect(lamp.className).toContain('is-on');
    click(lamp);
    const after = document.querySelector('[data-id="switch.living_room_lamp"]');
    expect(after.className).toContain('is-off');
  });

  it('PIN-gated unlock: pad → digits → submit flips the lock to unlocked', () => {
    openHomeOverlay(source(), null);
    click(document.querySelector('[data-action="ask-unlock"]'));
    expect(document.querySelector('.pinpad')).toBeTruthy();
    for (const d of ['1', '2', '3', '4']) {
      click(document.querySelector(`[data-action="pin-digit"][data-digit="${d}"]`));
    }
    click(document.querySelector('[data-action="pin-submit"]'));
    expect(document.querySelector('.home-tile--lock').className).toContain('is-unlocked');
    expect(document.querySelector('[data-action="lock"]')).toBeTruthy();
  });
});

describe('openHomeOverlay (live mode, with actions)', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  const source = () => ({ initial: getMockHome(), live: Promise.resolve(null) });

  it('rolls back a plug toggle if the backend rejects', async () => {
    const actions = { setPlug: vi.fn().mockRejectedValue(new Error('boom')), setLock: vi.fn() };
    openHomeOverlay(source(), actions);
    const fan = document.querySelector('[data-id="switch.nursery_sound_machine"]'); // starts off
    expect(fan.className).toContain('is-off');
    click(fan);
    // optimistic → on, then rejection reverts → off
    await Promise.resolve(); await Promise.resolve();
    expect(actions.setPlug).toHaveBeenCalledWith('switch.nursery_sound_machine', true);
    expect(document.querySelector('[data-id="switch.nursery_sound_machine"]').className).toContain('is-off');
  });

  it('sends the PIN to setLock on unlock', async () => {
    const actions = { setPlug: vi.fn(), setLock: vi.fn().mockResolvedValue({}) };
    openHomeOverlay(source(), actions);
    click(document.querySelector('[data-action="ask-unlock"]'));
    for (const d of ['9', '9', '9', '9']) {
      click(document.querySelector(`[data-action="pin-digit"][data-digit="${d}"]`));
    }
    click(document.querySelector('[data-action="pin-submit"]'));
    expect(actions.setLock).toHaveBeenCalledWith('unlock', '9999');
  });
});
