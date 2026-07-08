import { describe, it, expect } from 'vitest';
import { normalizeCurated, isHttpUrl, PICKS_MAX, COMING_MAX } from './curated-api.js';

const NOW = '2026-07-08T10:30:00.000Z';

describe('isHttpUrl', () => {
  it('accepts http and https', () => {
    expect(isHttpUrl('https://x.com/a')).toBe(true);
    expect(isHttpUrl('http://x.com/a')).toBe(true);
  });
  it('rejects javascript:, data:, and junk', () => {
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('data:text/html,<script>')).toBe(false);
    expect(isHttpUrl('not a url')).toBe(false);
    expect(isHttpUrl(null)).toBe(false);
    expect(isHttpUrl(undefined)).toBe(false);
  });
});

describe('normalizeCurated', () => {
  it('rejects a non-object body', () => {
    expect(normalizeCurated(null, NOW).ok).toBe(false);
    expect(normalizeCurated('x', NOW).ok).toBe(false);
    expect(normalizeCurated([], NOW).ok).toBe(false);
  });

  it('stamps generatedAt and returns empty sections for {}', () => {
    const r = normalizeCurated({}, NOW);
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ generatedAt: NOW, comingUp: [], picks: [] });
  });

  it('keeps a valid pick with an http(s) link', () => {
    const r = normalizeCurated({
      picks: [{ source: 'Concert', title: 'Hozier @ Fox', url: 'https://foxtheatre.org/x', note: 'date night' }],
    }, NOW);
    expect(r.ok).toBe(true);
    expect(r.value.picks).toHaveLength(1);
    expect(r.value.picks[0]).toEqual({
      source: 'Concert', title: 'Hozier @ Fox', url: 'https://foxtheatre.org/x', note: 'date night',
    });
  });

  it('hard-rejects a pick whose url is present but not http(s) (stored-XSS guard)', () => {
    const r = normalizeCurated({
      picks: [{ title: 'x', url: 'javascript:alert(1)' }],
    }, NOW);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/http/);
  });

  it('allows a pick with no url (renders non-clickable)', () => {
    const r = normalizeCurated({ picks: [{ title: 'no link here' }] }, NOW);
    expect(r.ok).toBe(true);
    expect(r.value.picks[0].url).toBe('');
  });

  it('drops malformed picks (missing title) without failing the whole run', () => {
    const r = normalizeCurated({ picks: [{ source: 'X' }, { title: 'keep', url: 'https://x/y' }] }, NOW);
    expect(r.ok).toBe(true);
    expect(r.value.picks).toHaveLength(1);
    expect(r.value.picks[0].title).toBe('keep');
  });

  it('clamps picks and comingUp to their maxes', () => {
    const many = (n, f) => Array.from({ length: n }, (_, i) => f(i));
    const r = normalizeCurated({
      picks: many(6, i => ({ title: `p${i}`, url: 'https://x/y' })),
      comingUp: many(6, i => ({ name: `e${i}`, date: '2026-07-19' })),
    }, NOW);
    expect(r.value.picks).toHaveLength(PICKS_MAX);
    expect(r.value.comingUp).toHaveLength(COMING_MAX);
  });

  it('keeps comingUp items and drops ones missing name or date', () => {
    const r = normalizeCurated({
      comingUp: [
        { name: "Mom's birthday", date: '2026-07-19', sub: 'ATL', note: 'card', kind: 'birthday' },
        { name: 'no date' },
        { date: '2026-07-20' },
      ],
    }, NOW);
    expect(r.value.comingUp).toHaveLength(1);
    expect(r.value.comingUp[0].name).toBe("Mom's birthday");
  });
});
