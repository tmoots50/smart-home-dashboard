import { describe, it, expect } from 'vitest';
import { pickTheme } from './theme-mode.js';

describe('pickTheme', () => {
  describe('with sunrise/sunset data', () => {
    const sun = {
      sunrise: '2026-05-08T06:30:00',
      sunset: '2026-05-08T20:15:00',
    };

    it('returns light at noon between sunrise and sunset', () => {
      expect(pickTheme(new Date('2026-05-08T12:00:00'), sun)).toBe('light');
    });

    it('returns cosy before sunrise', () => {
      expect(pickTheme(new Date('2026-05-08T05:00:00'), sun)).toBe('cosy');
    });

    it('returns cosy after sunset', () => {
      expect(pickTheme(new Date('2026-05-08T22:00:00'), sun)).toBe('cosy');
    });

    it('flips to cosy at the exact sunset moment', () => {
      expect(pickTheme(new Date('2026-05-08T20:15:00'), sun)).toBe('cosy');
    });

    it('flips to light at the exact sunrise moment', () => {
      expect(pickTheme(new Date('2026-05-08T06:30:00'), sun)).toBe('light');
    });
  });

  describe('without sunrise/sunset data (fallback)', () => {
    it('returns light at 9am', () => {
      expect(pickTheme(new Date('2026-05-08T09:00:00'), null)).toBe('light');
    });

    it('returns cosy at 11pm', () => {
      expect(pickTheme(new Date('2026-05-08T23:00:00'), null)).toBe('cosy');
    });

    it('returns cosy at 5am', () => {
      expect(pickTheme(new Date('2026-05-08T05:00:00'), null)).toBe('cosy');
    });

    it('handles partial sun data (sunrise only) by falling back', () => {
      expect(pickTheme(new Date('2026-05-08T09:00:00'), { sunrise: '2026-05-08T06:30', sunset: null })).toBe('light');
    });
  });
});
