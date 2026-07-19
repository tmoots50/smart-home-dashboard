import { describe, expect, it, vi, afterEach } from 'vitest';
import { canonicalizeCalendarData, canonicalizeUpcoming, fetchMonth } from './calendar.js';

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
