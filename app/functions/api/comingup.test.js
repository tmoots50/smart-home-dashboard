import { describe, it, expect } from 'vitest';
import { normalizeOverrides } from './comingup.js';

const NOW = '2026-07-11T12:00:00.000Z';

describe('normalizeOverrides', () => {
  it('accepts a valid mixed payload and stamps updatedAt', () => {
    const r = normalizeOverrides({ overrides: [
      { match: 'flight', score: 500 },
      { match: 'watering', hide: true },
      { match: 'dinner', pane: 'right', score: 10 },
    ] }, NOW);
    expect(r.ok).toBe(true);
    expect(r.value.updatedAt).toBe(NOW);
    expect(r.value.overrides).toHaveLength(3);
  });

  it('rejects non-array, oversized lists, and empty matches', () => {
    expect(normalizeOverrides({}, NOW).ok).toBe(false);
    expect(normalizeOverrides({ overrides: 'x' }, NOW).ok).toBe(false);
    expect(normalizeOverrides({ overrides: [{ match: '', hide: true }] }, NOW).ok).toBe(false);
    expect(normalizeOverrides({ overrides: Array.from({ length: 51 }, () => ({ match: 'x', hide: true })) }, NOW).ok).toBe(false);
  });

  it('rejects entries with no effect and bad field values', () => {
    expect(normalizeOverrides({ overrides: [{ match: 'x' }] }, NOW).ok).toBe(false);
    expect(normalizeOverrides({ overrides: [{ match: 'x', score: 'high' }] }, NOW).ok).toBe(false);
    expect(normalizeOverrides({ overrides: [{ match: 'x', score: 5000 }] }, NOW).ok).toBe(false);
    expect(normalizeOverrides({ overrides: [{ match: 'x', pane: 'middle' }] }, NOW).ok).toBe(false);
    expect(normalizeOverrides({ overrides: [{ match: 'x', hide: 'yes' }] }, NOW).ok).toBe(false);
  });

  it('strips unknown fields', () => {
    const r = normalizeOverrides({ overrides: [{ match: 'x', hide: true, evil: '<script>' }] }, NOW);
    expect(r.ok).toBe(true);
    expect(r.value.overrides[0]).toEqual({ match: 'x', hide: true });
  });
});
