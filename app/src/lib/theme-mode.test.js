import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { applyTheme, pickTheme } from './theme-mode.js';

const FIXED_SUN = {
  sunrise: '2026-05-08T06:41:00-04:00',
  sunset: '2026-05-08T20:25:00-04:00',
};

describe('pickTheme', () => {
  describe('sunrise/sunset schedule', () => {
    it('returns cosy before sunrise', () => {
      expect(pickTheme(new Date('2026-05-08T06:40:59-04:00'), { sun: FIXED_SUN })).toBe('cosy');
    });

    it('flips to light exactly at sunrise', () => {
      expect(pickTheme(new Date('2026-05-08T06:41:00-04:00'), { sun: FIXED_SUN })).toBe('light');
    });

    it('stays light between sunrise and sunset', () => {
      expect(pickTheme(new Date('2026-05-08T12:00:00-04:00'), { sun: FIXED_SUN })).toBe('light');
    });

    it('stays light one second before sunset', () => {
      expect(pickTheme(new Date('2026-05-08T20:24:59-04:00'), { sun: FIXED_SUN })).toBe('light');
    });

    it('flips to cosy exactly at sunset', () => {
      expect(pickTheme(new Date('2026-05-08T20:25:00-04:00'), { sun: FIXED_SUN })).toBe('cosy');
    });

    it('stays cosy after sunset', () => {
      expect(pickTheme(new Date('2026-05-08T23:00:00-04:00'), { sun: FIXED_SUN })).toBe('cosy');
    });

    it('accepts null opts for backwards compatibility', () => {
      expect(['light', 'cosy']).toContain(pickTheme(new Date('2026-05-08T09:00:00-04:00'), null));
    });
  });
});

describe('applyTheme', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-08T12:00:00-04:00'));
    document.documentElement.dataset.theme = '';
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState({}, '', '/');
    document.documentElement.dataset.theme = '';
  });

  it('writes the computed theme to the document root', () => {
    applyTheme();
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('lets ?theme= override the automatic schedule for QA previews', () => {
    window.history.replaceState({}, '', '/?theme=cosy');
    applyTheme();
    expect(document.documentElement.dataset.theme).toBe('cosy');
  });

  it('ignores invalid lat/lon query params and falls back to home coordinates', () => {
    window.history.replaceState({}, '', '/?lat=nope&lon=also-nope');
    applyTheme();
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
