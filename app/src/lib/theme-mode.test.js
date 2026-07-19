import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { autoTheme, nextSunEvent, resolveTheme, toggleTheme, isDark } from './theme-mode.js';

// Two unambiguous Atlanta instants (absolute UTC → timezone-independent):
const DAYTIME = new Date('2026-06-21T17:00:00Z'); // ~1:00pm EDT — sun well up
const NIGHT = new Date('2026-06-22T05:00:00Z');   // ~1:00am EDT — sun well down
const OVERRIDE_KEY = 'theme:override';

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe('autoTheme (follows the sun)', () => {
  it('is fun (light) during the day', () => {
    expect(autoTheme(DAYTIME)).toBe('fun');
  });
  it('is cosy (dark) at night', () => {
    expect(autoTheme(NIGHT)).toBe('cosy');
  });
});

describe('nextSunEvent', () => {
  it('returns the soonest sun event still in the future', () => {
    const next = nextSunEvent(DAYTIME);
    expect(next.getTime()).toBeGreaterThan(DAYTIME.getTime());
    // Daytime → today's sunset, comfortably within the next 9 hours.
    expect(next.getTime() - DAYTIME.getTime()).toBeLessThan(9 * 3_600_000);
  });
});

describe('resolveTheme precedence', () => {
  it('falls back to auto when nothing is set', () => {
    expect(resolveTheme(DAYTIME)).toBe('fun');
    expect(resolveTheme(NIGHT)).toBe('cosy');
  });

  it('honors ?theme= as a dev preview when NOT in kiosk mode', () => {
    window.history.replaceState(null, '', '/?theme=cosy');
    expect(resolveTheme(DAYTIME)).toBe('cosy'); // overrides daytime auto
  });

  it('ignores a pinned ?theme= in kiosk mode (auto + toggle own the theme)', () => {
    window.history.replaceState(null, '', '/?theme=fun&kiosk=1');
    expect(resolveTheme(NIGHT)).toBe('cosy'); // auto wins, pin ignored
  });

  it('applies a live manual override over auto', () => {
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify({ theme: 'cosy', until: DAYTIME.getTime() + 3_600_000 }));
    expect(resolveTheme(DAYTIME)).toBe('cosy'); // dark forced during the day
  });

  it('drops an expired override and resumes auto (clearing storage)', () => {
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify({ theme: 'cosy', until: DAYTIME.getTime() - 1 }));
    expect(resolveTheme(DAYTIME)).toBe('fun'); // back to daytime auto
    expect(localStorage.getItem(OVERRIDE_KEY)).toBeNull();
  });
});

describe('toggleTheme', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(DAYTIME);
  });
  afterEach(() => vi.useRealTimers());

  it('flips light→dark, applies immediately, and persists an override that expires at the next sun event', () => {
    document.documentElement.dataset.theme = 'fun';
    const next = toggleTheme();

    expect(next).toBe('cosy');
    expect(document.documentElement.dataset.theme).toBe('cosy');
    expect(isDark()).toBe(true);

    const ov = JSON.parse(localStorage.getItem(OVERRIDE_KEY));
    expect(ov.theme).toBe('cosy');
    expect(ov.until).toBeGreaterThan(Date.now()); // future expiry
  });

  it('flips dark→light on the next tap', () => {
    document.documentElement.dataset.theme = 'cosy';
    expect(toggleTheme()).toBe('fun');
    expect(document.documentElement.dataset.theme).toBe('fun');
  });
});
