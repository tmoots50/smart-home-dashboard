import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { autoTheme, nextSunEvent, resolveTheme, toggleTheme, isDark } from './theme-mode.js';

// Two unambiguous Atlanta instants (absolute UTC → timezone-independent):
const DAYTIME = new Date('2026-06-21T17:00:00Z'); // ~1:00pm EDT — sun well up
const NIGHT = new Date('2026-06-22T05:00:00Z');   // ~1:00am EDT — sun well down
const OVERRIDE_KEY = 'theme:override';

beforeEach(() => {
  window.location.href = 'http://localhost/'; // dev host by default
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

  it('honors ?theme= as a dev preview on localhost', () => {
    window.history.replaceState(null, '', '/?theme=cosy');
    expect(resolveTheme(DAYTIME)).toBe('cosy'); // overrides daytime auto
  });

  it('lets a live manual override WIN over ?theme= (the toggle always takes control)', () => {
    window.history.replaceState(null, '', '/?theme=cosy');
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify({ theme: 'fun', until: DAYTIME.getTime() + 3_600_000 }));
    expect(resolveTheme(DAYTIME)).toBe('fun'); // override beats the URL param
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

  it('IGNORES a pinned ?theme= on the deployed tablet (off-localhost)', () => {
    // Reproduces Tim's Fully Kiosk URL: ?theme=cosy, no ?kiosk=1. On the
    // deployed host the pin must not block auto or the toggle.
    window.location.href = 'https://smart-home-dashboard-de0.pages.dev/?theme=cosy';
    expect(resolveTheme(DAYTIME)).toBe('fun'); // auto wins, pin ignored
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

  it('overrides a pinned ?theme= on the deployed tablet', () => {
    // The exact failure Tim hit: pinned ?theme=cosy, no kiosk. Tapping must flip.
    window.location.href = 'https://smart-home-dashboard-de0.pages.dev/?theme=cosy';
    document.documentElement.dataset.theme = 'cosy';
    expect(toggleTheme()).toBe('fun');
    expect(resolveTheme()).toBe('fun'); // and it sticks through a re-resolve
  });
});
