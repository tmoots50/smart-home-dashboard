import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { canonicalizeCalendarData, canonicalizeUpcoming, fetchMonth, chooseFallback } from './calendar.js';
import { getMockUpcoming } from './calendar-mock.js';

describe('calendar canonicalization (person-keyed, alias retired)', () => {
  it('preserves the real calendar label and backfills person for work feeds', () => {
    // Caroline is a real, distinct person now — no longer folded into Family.
    expect(canonicalizeUpcoming([{ id: '1', calendar: 'Caroline (Work)', person: 'Caroline' }]))
      .toEqual([{ id: '1', calendar: 'Caroline (Work)', person: 'Caroline' }]);
  });

  it('defaults person to the calendar label when the field is absent (legacy/mock events)', () => {
    expect(canonicalizeUpcoming([{ id: '2', calendar: 'Tim' }]))
      .toEqual([{ id: '2', calendar: 'Tim', person: 'Tim' }]);
  });

  it('keeps distinct person sections distinct (Caroline no longer merges into Family)', () => {
    const data = canonicalizeCalendarData({ sections: [
      { label: 'Family', events: [{ id: 'f', startsAt: '2026-07-10' }] },
      { label: 'Caroline', events: [{ id: 'c', startsAt: '2026-07-11' }] },
    ] });
    expect(data.sections).toEqual([
      { label: 'Family', events: [{ id: 'f', startsAt: '2026-07-10' }] },
      { label: 'Caroline', events: [{ id: 'c', startsAt: '2026-07-11' }] },
    ]);
  });

  it('still merges two sections that share a label', () => {
    const data = canonicalizeCalendarData({ sections: [
      { label: 'Tim', events: [{ id: 'a', startsAt: '2026-07-10' }] },
      { label: 'Tim', events: [{ id: 'b', startsAt: '2026-07-11' }] },
    ] });
    expect(data.sections).toEqual([{ label: 'Tim', events: [
      { id: 'a', startsAt: '2026-07-10' },
      { id: 'b', startsAt: '2026-07-11' },
    ] }]);
  });
});

describe('fetchMonth', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('requests [first of month, first of next month) and backfills person', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ events: [{ id: '1', calendar: 'Caroline (Work)', person: 'Caroline', startsAt: '2026-07-05T10:00:00' }] }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const events = await fetchMonth(2026, 6); // July (0-based)
    const url = fetchMock.mock.calls[0][0];
    expect(url).toContain('timeMin=' + encodeURIComponent(new Date(2026, 6, 1).toISOString()));
    expect(url).toContain('timeMax=' + encodeURIComponent(new Date(2026, 7, 1).toISOString()));
    expect(events).toEqual([{ id: '1', calendar: 'Caroline (Work)', person: 'Caroline', startsAt: '2026-07-05T10:00:00' }]);
  });

  it('throws on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 502 })));
    await expect(fetchMonth(2026, 6)).rejects.toThrow('502');
  });
});

// The 2026-08 bug: a transient fetch failure on a configured wall repainted the
// bundled mock (retired Narvar/job-search placeholders) over the real calendar.
// The fix: prefer real cache (even stale) → empty on a wall → mock only when
// there is NO token. chooseFallback is that rule, isolated + pure.
describe('chooseFallback — mock never reaches a configured wall', () => {
  const mock = () => [{ id: 'MOCK' }];

  it('serves last-known real cache over everything, even without a token', () => {
    const stale = [{ id: 'real' }];
    expect(chooseFallback(stale, { hasToken: true, empty: [], mock })).toBe(stale);
    expect(chooseFallback(stale, { hasToken: false, empty: [], mock })).toBe(stale);
  });

  it('serves EMPTY (not mock) on a configured wall when there is no cache', () => {
    expect(chooseFallback(null, { hasToken: true, empty: [], mock })).toEqual([]);
  });

  it('serves mock only in tokenless dev when there is no cache', () => {
    expect(chooseFallback(null, { hasToken: false, empty: [], mock })).toEqual([{ id: 'MOCK' }]);
  });
});

// End-to-end proof against the reported bug: with a token set and the live
// fetch rejecting (the transient CF 503), getUpcoming's live promise must NOT
// resolve to the bundled mock. Imported fresh with the env stubbed, since the
// module captures VITE_DASHBOARD_TOKEN at load.
describe('getUpcoming under a failing fetch (token set)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_DASHBOARD_TOKEN', 'test-token');
    localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('resolves to EMPTY, never the retired mock placeholders, when uncached', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('CF 503'); }));
    const { getUpcoming } = await import('./calendar.js');
    const { initial, live } = getUpcoming(90);
    const resolved = await live;
    expect(resolved).toEqual([]);
    expect(initial).toEqual([]);
    // The placeholder that was leaking onto the wall.
    expect(JSON.stringify(resolved)).not.toContain('Recruiter call');
    expect(resolved.length).not.toBe(getMockUpcoming().length);
  });

  it('serves the last-known real cache (serve-stale) when the fetch fails', async () => {
    const realEvent = { id: 'g-123', calendar: 'Family', person: 'Family', title: 'Real dentist', startsAt: '2026-08-20T14:00:00' };
    // A cache entry older than the 5-min TTL but within the 24h serve-stale window.
    localStorage.setItem('calendar:upcoming:90:v1', JSON.stringify({ at: Date.now() - 10 * 60 * 1000, data: [realEvent] }));
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('CF 503'); }));
    const { getUpcoming } = await import('./calendar.js');
    const resolved = await getUpcoming(90).live;
    expect(resolved).toEqual([realEvent]);
  });
});
