import { describe, it, expect } from 'vitest';
import { pickTheme } from './theme-mode.js';

describe('pickTheme', () => {
  describe('household schedule', () => {
    it('returns light at 9am', () => {
      expect(pickTheme(new Date('2026-05-08T09:00:00'), null)).toBe('light');
    });

    it('returns cosy at 11pm', () => {
      expect(pickTheme(new Date('2026-05-08T23:00:00'), null)).toBe('cosy');
    });

    it('stays light through 10:59pm', () => {
      expect(pickTheme(new Date('2026-05-08T22:59:59'))).toBe('light');
    });

    it('flips to light at 7am', () => {
      expect(pickTheme(new Date('2026-05-08T07:00:00'))).toBe('light');
    });

    it('returns cosy at 5am', () => {
      expect(pickTheme(new Date('2026-05-08T05:00:00'), null)).toBe('cosy');
    });

  });
});
